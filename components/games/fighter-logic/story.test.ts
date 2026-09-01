import { describe, expect, it } from 'vitest';
import { difficultyRank, fighterById, selectableFighters, ROSTER, type FighterId } from './fighters';
import { STAGES } from './stages';
import {
  acceptContinue,
  awardDamage,
  awardRound,
  BOUTS,
  createStory,
  currentDifficulty,
  currentOpponent,
  currentStage,
  CONTINUE_MS,
  declineContinue,
  loseBout,
  SCORE_BOSS,
  SCORE_BOUT,
  SCORE_PERFECT_ROUND,
  SCORE_ROUND,
  tickContinue,
  winBout,
} from './story';

const PLAYABLE_IDS = selectableFighters(ROSTER).map((f) => f.id);

function rankOf(id: FighterId): number {
  const fighter = fighterById(ROSTER, id);
  if (!fighter) throw new Error(`missing fighter ${id}`);
  return difficultyRank(fighter);
}

describe('createStory', () => {
  it('never lists the chosen fighter as a rival, for every possible choice', () => {
    for (const playerId of PLAYABLE_IDS) {
      const story = createStory(ROSTER, playerId);
      expect(story.order).not.toContain(playerId);
    }
  });

  it('has exactly eight bouts for every possible choice', () => {
    for (const playerId of PLAYABLE_IDS) {
      const story = createStory(ROSTER, playerId);
      expect(story.order).toHaveLength(BOUTS);
    }
  });

  it('orders the first seven rivals by strictly increasing difficulty and puts arquitecto eighth, for every possible choice', () => {
    for (const playerId of PLAYABLE_IDS) {
      const story = createStory(ROSTER, playerId);
      const rivals = story.order.slice(0, BOUTS - 1);
      for (let i = 1; i < rivals.length; i++) {
        expect(rankOf(rivals[i])).toBeGreaterThan(rankOf(rivals[i - 1]));
      }
      expect(story.order[BOUTS - 1]).toBe('arquitecto');
    }
  });

  it('starts fighting at bout 0 with zero score and no continues used', () => {
    const story = createStory(ROSTER, 'nova');
    expect(story.bout).toBe(0);
    expect(story.status).toBe('fighting');
    expect(story.score).toBe(0);
    expect(story.continuesUsed).toBe(0);
  });

  it('gives two stories built for different fighters independent order arrays', () => {
    const a = createStory(ROSTER, 'nova');
    const b = createStory(ROSTER, 'torre');
    expect(a.order).not.toBe(b.order);
    const snapshotA = [...a.order];
    a.order[0] = 'glitch';
    expect(b.order).not.toEqual(a.order);
    expect(b.order[0]).not.toBe(a.order[0]);
    // sanity: mutating a's copy really changed it away from its own snapshot
    expect(a.order).not.toEqual(snapshotA);
  });
});

describe('currentOpponent and currentStage', () => {
  it('resolves the opponent at the current bout from the roster', () => {
    const story = createStory(ROSTER, 'nova');
    const opponent = currentOpponent(ROSTER, story);
    expect(opponent.id).toBe(story.order[0]);
  });

  it('gives each of the eight bouts a distinct stage', () => {
    const story = createStory(ROSTER, 'nova');
    const seen = new Set<string>();
    for (let bout = 0; bout < BOUTS; bout++) {
      seen.add(currentStage(STAGES, story).id);
      winBout(story);
    }
    expect(seen.size).toBe(BOUTS);
  });
});

describe('currentDifficulty', () => {
  it('is bout + 1, so the boss is difficulty 8', () => {
    const story = createStory(ROSTER, 'nova');
    expect(currentDifficulty(story)).toBe(1);
    for (let i = 0; i < BOUTS - 1; i++) winBout(story);
    expect(story.bout).toBe(BOUTS - 1);
    expect(currentDifficulty(story)).toBe(8);
  });
});

describe('winBout', () => {
  it('advances bout and stays fighting for the first seven wins', () => {
    const story = createStory(ROSTER, 'nova');
    for (let expectedBout = 1; expectedBout <= BOUTS - 1; expectedBout++) {
      winBout(story);
      expect(story.bout).toBe(expectedBout);
      expect(story.status).toBe('fighting');
    }
  });

  it('crowns a champion on the eighth win and awards bout + boss score', () => {
    const story = createStory(ROSTER, 'nova');
    for (let i = 0; i < BOUTS - 1; i++) winBout(story);
    const scoreBeforeFinal = story.score;
    winBout(story);
    expect(story.status).toBe('champion');
    expect(story.score).toBe(scoreBeforeFinal + SCORE_BOUT + SCORE_BOSS);
  });

  it('does nothing to an eliminated story', () => {
    const story = createStory(ROSTER, 'nova');
    loseBout(story);
    declineContinue(story);
    expect(story.status).toBe('eliminated');
    const before = { ...story };
    winBout(story);
    expect(story.status).toBe('eliminated');
    expect(story.bout).toBe(before.bout);
    expect(story.score).toBe(before.score);
  });

  it('does nothing to an already-crowned champion (duplicate win event)', () => {
    const story = createStory(ROSTER, 'nova');
    for (let i = 0; i < BOUTS; i++) winBout(story);
    expect(story.status).toBe('champion');
    const scoreAfterChampion = story.score;
    winBout(story); // duplicate event, e.g. a double rAF callback firing
    expect(story.status).toBe('champion');
    expect(story.score).toBe(scoreAfterChampion);
  });
});

describe('loseBout, acceptContinue and declineContinue', () => {
  it('arms the countdown without moving the bout', () => {
    const story = createStory(ROSTER, 'nova');
    const boutBeforeLoss = story.bout;
    loseBout(story);
    expect(story.status).toBe('continue');
    expect(story.continueMsLeft).toBe(CONTINUE_MS);
    expect(story.bout).toBe(boutBeforeLoss);
  });

  it('does not dethrone a champion (duplicate lose event after the final win)', () => {
    const story = createStory(ROSTER, 'nova');
    for (let i = 0; i < BOUTS; i++) winBout(story);
    expect(story.status).toBe('champion');
    loseBout(story);
    expect(story.status).toBe('champion');
  });

  it('does not reset an already-running countdown (duplicate lose event)', () => {
    const story = createStory(ROSTER, 'nova');
    loseBout(story);
    tickContinue(story, 4_000);
    expect(story.continueMsLeft).toBe(CONTINUE_MS - 4_000);
    loseBout(story); // duplicate event, e.g. a handler registered twice
    expect(story.status).toBe('continue');
    expect(story.continueMsLeft).toBe(CONTINUE_MS - 4_000);
  });

  it('acceptContinue resumes the same bout with the score intact and one more continue used', () => {
    const story = createStory(ROSTER, 'nova');
    winBout(story); // bout 1, some score banked
    const boutBeforeLoss = story.bout;
    const scoreBeforeLoss = story.score;
    loseBout(story);
    acceptContinue(story);
    expect(story.status).toBe('fighting');
    expect(story.bout).toBe(boutBeforeLoss);
    expect(story.score).toBe(scoreBeforeLoss);
    expect(story.continuesUsed).toBe(1);
  });

  it('declineContinue eliminates the run immediately', () => {
    const story = createStory(ROSTER, 'nova');
    loseBout(story);
    declineContinue(story);
    expect(story.status).toBe('eliminated');
  });

  it('acceptContinue does nothing to a fighting story', () => {
    const story = createStory(ROSTER, 'nova');
    acceptContinue(story);
    expect(story.status).toBe('fighting');
    expect(story.continuesUsed).toBe(0);
  });

  it('does not eliminate an in-progress fight (stray decline handler)', () => {
    const story = createStory(ROSTER, 'nova');
    declineContinue(story);
    expect(story.status).toBe('fighting');
  });
});

describe('tickContinue', () => {
  it('eliminates the run exactly when the countdown reaches zero', () => {
    const story = createStory(ROSTER, 'nova');
    loseBout(story);
    tickContinue(story, CONTINUE_MS);
    expect(story.continueMsLeft).toBe(0);
    expect(story.status).toBe('eliminated');
  });

  it('stays in continue one millisecond before the countdown reaches zero', () => {
    const story = createStory(ROSTER, 'nova');
    loseBout(story);
    tickContinue(story, CONTINUE_MS - 1);
    expect(story.continueMsLeft).toBe(1);
    expect(story.status).toBe('continue');
  });

  it('does nothing while fighting (no countdown armed yet)', () => {
    const story = createStory(ROSTER, 'nova');
    tickContinue(story, CONTINUE_MS);
    expect(story.status).toBe('fighting');
    expect(story.continueMsLeft).toBe(0);
  });
});

describe('scoring', () => {
  it('awardDamage converts damage into score at SCORE_PER_DAMAGE per point', () => {
    const story = createStory(ROSTER, 'nova');
    awardDamage(story, 10);
    expect(story.score).toBe(100);
  });

  it('awardRound(true) awards the round bonus plus the perfect bonus', () => {
    const story = createStory(ROSTER, 'nova');
    awardRound(story, true);
    expect(story.score).toBe(SCORE_ROUND + SCORE_PERFECT_ROUND);
  });

  it('awardRound(false) awards only the round bonus', () => {
    const story = createStory(ROSTER, 'nova');
    awardRound(story, false);
    expect(story.score).toBe(SCORE_ROUND);
  });

  it('does not add damage score to a story that already became champion (late event)', () => {
    const story = createStory(ROSTER, 'nova');
    for (let i = 0; i < BOUTS; i++) winBout(story);
    expect(story.status).toBe('champion');
    const scoreAfterChampion = story.score;
    awardDamage(story, 10);
    expect(story.score).toBe(scoreAfterChampion);
  });

  it('does not add round score to an eliminated story (late event)', () => {
    const story = createStory(ROSTER, 'nova');
    loseBout(story);
    declineContinue(story);
    expect(story.status).toBe('eliminated');
    awardRound(story, true);
    expect(story.score).toBe(0);
  });
});
