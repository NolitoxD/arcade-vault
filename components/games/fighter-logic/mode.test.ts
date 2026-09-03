import { describe, expect, it } from 'vitest';
import { bossFighter, ROSTER, selectableFighters } from './fighters';
import { STAGES } from './stages';
import {
  createStoryMode,
  createTournamentMode,
  modeAcceptContinue,
  modeAwardDamage,
  modeAwardRound,
  modeBoutLabel,
  modeBracketIds,
  modeChampionSubtitle,
  modeContinueMsLeft,
  modeDeclineContinue,
  modeDifficulty,
  modeIsFinale,
  modeLoseBout,
  modeOpponent,
  modePlayerId,
  modeScore,
  modeStage,
  modeStatus,
  modeStillIn,
  modeTickContinue,
  modeWinBout,
  type GameMode,
} from './mode';
import * as story from './story';
import * as tournament from './tournament';

const PLAYER_ID = selectableFighters(ROSTER)[0].id;
const BOSS = bossFighter(ROSTER);

function makeLcg(seed: number): () => number {
  let s = seed;
  return () => ((s = (s * 1103515245 + 12345) & 0x7fffffff), s / 0x7fffffff);
}

function storyMode(): GameMode {
  return { kind: 'story', state: story.createStory(ROSTER, PLAYER_ID) };
}

function tournamentMode(seed: number): GameMode {
  return {
    kind: 'tournament',
    state: tournament.createTournament(ROSTER, PLAYER_ID, STAGES, makeLcg(seed)),
  };
}

// The rng the story branch must never consult. Any call throws, so a story
// test that reached tournament.winBout would fail loudly instead of silently
// producing a plausible-looking state.
const forbiddenRng: () => number = () => {
  throw new Error('story mode must not consume the rng');
};

describe('mode — dispatch to the story branch', () => {
  it('returns the same opponent as calling story.ts directly, on every bout', () => {
    const m = storyMode();
    const direct = story.createStory(ROSTER, PLAYER_ID);

    for (let bout = 0; bout < story.BOUTS; bout++) {
      expect(modeOpponent(ROSTER, m)).toBe(story.currentOpponent(ROSTER, direct));
      modeWinBout(ROSTER, m, forbiddenRng);
      story.winBout(direct);
    }
  });

  it('returns the same stage and difficulty as story.ts, on every bout', () => {
    const m = storyMode();
    const direct = story.createStory(ROSTER, PLAYER_ID);

    for (let bout = 0; bout < story.BOUTS; bout++) {
      expect(modeStage(STAGES, m)).toBe(story.currentStage(STAGES, direct));
      expect(modeDifficulty(m)).toBe(story.currentDifficulty(direct));
      modeWinBout(ROSTER, m, forbiddenRng);
      story.winBout(direct);
    }
  });

  it('reads score and status straight off the story state', () => {
    const m = storyMode();
    expect(modeScore(m)).toBe(0);
    expect(modeStatus(m)).toBe('fighting');

    modeAwardDamage(m, 7);
    expect(modeScore(m)).toBe(7 * story.SCORE_PER_DAMAGE);

    modeAwardRound(m, true);
    expect(modeScore(m)).toBe(7 * story.SCORE_PER_DAMAGE + story.SCORE_ROUND + story.SCORE_PERFECT_ROUND);
  });

  it('labels the story bouts with both the bout number and the total padded', () => {
    const m = storyMode();
    const seen: string[] = [];

    for (let bout = 0; bout < story.BOUTS; bout++) {
      seen.push(modeBoutLabel(m));
      modeWinBout(ROSTER, m, forbiddenRng);
    }

    expect(seen[0]).toBe('COMBATE 01/08');
    expect(seen[2]).toBe('COMBATE 03/08');
    expect(seen[story.BOUTS - 1]).toBe('COMBATE 08/08');
    expect(new Set(seen).size).toBe(story.BOUTS);
  });

  it('returns the same label object every call, so no frame allocates a string', () => {
    const m = storyMode();
    expect(modeBoutLabel(m)).toBe(modeBoutLabel(m));
  });

  it('faces the boss on the last bout without any special case', () => {
    const m = storyMode();
    for (let bout = 0; bout < story.BOUTS - 1; bout++) modeWinBout(ROSTER, m, forbiddenRng);

    expect(modeOpponent(ROSTER, m)).toBe(BOSS);
    expect(modeDifficulty(m)).toBe(story.BOUTS);
  });

  it('crowns a champion after the eighth win, awarding bout plus boss bonus', () => {
    const m = storyMode();
    for (let bout = 0; bout < story.BOUTS; bout++) modeWinBout(ROSTER, m, forbiddenRng);

    expect(modeStatus(m)).toBe('champion');
    expect(modeScore(m)).toBe(story.BOUTS * story.SCORE_BOUT + story.SCORE_BOSS);
  });
});

describe('mode — dispatch to the tournament branch', () => {
  it('returns the same opponent, stage and difficulty as tournament.ts directly', () => {
    const m = tournamentMode(4242);
    const direct = tournament.createTournament(ROSTER, PLAYER_ID, STAGES, makeLcg(4242));

    const rngA = makeLcg(77);
    const rngB = makeLcg(77);
    for (let bout = 0; bout < tournament.TOURNAMENT_BOUTS; bout++) {
      expect(modeOpponent(ROSTER, m)).toBe(tournament.currentOpponent(ROSTER, direct));
      expect(modeStage(STAGES, m)).toBe(tournament.currentStage(STAGES, direct));
      expect(modeDifficulty(m)).toBe(tournament.currentDifficulty(direct));
      expect(modeBoutLabel(m)).toBe(tournament.boutLabel(direct));
      modeWinBout(ROSTER, m, rngA);
      tournament.winBout(ROSTER, direct, rngB);
    }
  });

  it('passes the roster through to winBout, so the drawn bracket matches', () => {
    const m = tournamentMode(909);
    const direct = tournament.createTournament(ROSTER, PLAYER_ID, STAGES, makeLcg(909));

    modeWinBout(ROSTER, m, makeLcg(31));
    tournament.winBout(ROSTER, direct, makeLcg(31));

    expect(m.state).toEqual(direct);
  });

  it('labels the four rounds CUARTOS, SEMIFINAL, FINAL and SUPER FINAL', () => {
    const m = tournamentMode(1234);
    const rng = makeLcg(55);
    const seen: string[] = [];

    for (let bout = 0; bout < tournament.TOURNAMENT_BOUTS; bout++) {
      seen.push(modeBoutLabel(m));
      modeWinBout(ROSTER, m, rng);
    }

    expect(seen).toEqual(['CUARTOS', 'SEMIFINAL', 'FINAL', 'SUPER FINAL']);
  });

  it('scores with the tournament constants, not the story ones', () => {
    const m = tournamentMode(1);
    modeAwardDamage(m, 7);
    modeAwardRound(m, true);

    expect(modeScore(m)).toBe(
      7 * tournament.SCORE_PER_DAMAGE + tournament.SCORE_ROUND + tournament.SCORE_PERFECT_ROUND,
    );
  });
});

describe('mode — the CONTINUE is decided by the status, not by the mode', () => {
  it('leaves the story in continue with the full countdown after a loss', () => {
    const m = storyMode();
    modeLoseBout(m);

    expect(modeStatus(m)).toBe('continue');
    expect(modeContinueMsLeft(m)).toBe(story.CONTINUE_MS);
  });

  it('eliminates the tournament immediately, with no countdown to tick', () => {
    const m = tournamentMode(2);
    modeLoseBout(m);

    expect(modeStatus(m)).toBe('eliminated');
    expect(modeContinueMsLeft(m)).toBe(0);
  });

  it('ticks the story countdown down to elimination, exactly like story.ts', () => {
    const m = storyMode();
    const direct = story.createStory(ROSTER, PLAYER_ID);
    modeLoseBout(m);
    story.loseBout(direct);

    modeTickContinue(m, 4_000);
    story.tickContinue(direct, 4_000);
    expect(modeContinueMsLeft(m)).toBe(direct.continueMsLeft);
    expect(modeStatus(m)).toBe(direct.status);

    modeTickContinue(m, story.CONTINUE_MS);
    story.tickContinue(direct, story.CONTINUE_MS);
    expect(modeStatus(m)).toBe('eliminated');
    expect(m.state).toEqual(direct);
  });

  it('accepts a story continue back into the fight and counts it', () => {
    const m = storyMode();
    modeLoseBout(m);
    modeAcceptContinue(m);

    expect(modeStatus(m)).toBe('fighting');
    expect(modeContinueMsLeft(m)).toBe(0);
    expect(m.kind === 'story' && m.state.continuesUsed).toBe(1);
  });

  it('declines a story continue into elimination', () => {
    const m = storyMode();
    modeLoseBout(m);
    modeDeclineContinue(m);

    expect(modeStatus(m)).toBe('eliminated');
  });

  it('never resurrects an eliminated tournament through the continue helpers', () => {
    const m = tournamentMode(3);
    modeLoseBout(m);

    modeTickContinue(m, 5_000);
    modeAcceptContinue(m);
    modeDeclineContinue(m);

    expect(modeStatus(m)).toBe('eliminated');
  });
});

describe('mode — a full story run through the layer equals one through story.ts', () => {
  it('produces an identical state after the same sequence of calls', () => {
    const m = storyMode();
    const direct = story.createStory(ROSTER, PLAYER_ID);

    // A run with a loss, a continue taken, a decline avoided, damage and
    // rounds scored on the way — every mutating call the component makes.
    for (let bout = 0; bout < 3; bout++) {
      modeAwardDamage(m, 11);
      story.awardDamage(direct, 11);
      modeAwardRound(m, bout % 2 === 0);
      story.awardRound(direct, bout % 2 === 0);
      modeWinBout(ROSTER, m, forbiddenRng);
      story.winBout(direct);
    }

    modeLoseBout(m);
    story.loseBout(direct);
    modeTickContinue(m, 3_500);
    story.tickContinue(direct, 3_500);
    modeAcceptContinue(m);
    story.acceptContinue(direct);

    for (let bout = 3; bout < story.BOUTS; bout++) {
      modeAwardDamage(m, 9);
      story.awardDamage(direct, 9);
      modeAwardRound(m, false);
      story.awardRound(direct, false);
      modeWinBout(ROSTER, m, forbiddenRng);
      story.winBout(direct);
    }

    expect(m.state).toEqual(direct);
    expect(modeScore(m)).toBe(direct.score);
    expect(modeStatus(m)).toBe('champion');
  });
});

describe('mode — the constructors the component calls, one per run', () => {
  it('builds the same story state as story.ts for the chosen fighter', () => {
    const m = createStoryMode(ROSTER, PLAYER_ID);

    expect(m.kind).toBe('story');
    expect(m.state).toEqual(story.createStory(ROSTER, PLAYER_ID));
    expect(modePlayerId(m)).toBe(PLAYER_ID);
  });

  it('builds the same bracket as tournament.ts for the same seed', () => {
    const m = createTournamentMode(ROSTER, PLAYER_ID, STAGES, makeLcg(8181));

    expect(m.kind).toBe('tournament');
    expect(m.state).toEqual(tournament.createTournament(ROSTER, PLAYER_ID, STAGES, makeLcg(8181)));
    expect(modePlayerId(m)).toBe(PLAYER_ID);
    expect(modeBoutLabel(m)).toBe('CUARTOS');
  });

  it('reports the player the component must put on screen, in both modes', () => {
    const other = selectableFighters(ROSTER)[3].id;

    expect(modePlayerId(createStoryMode(ROSTER, other))).toBe(other);
    expect(modePlayerId(createTournamentMode(ROSTER, other, STAGES, makeLcg(5)))).toBe(other);
  });
});

describe('mode — the tournament can never reach the CONTINUE phase', () => {
  it('never reports continue at any point of a winning run', () => {
    const m = createTournamentMode(ROSTER, PLAYER_ID, STAGES, makeLcg(606));
    const rng = makeLcg(21);

    for (let bout = 0; bout < tournament.TOURNAMENT_BOUTS; bout++) {
      expect(modeStatus(m)).not.toBe('continue');
      modeAwardDamage(m, 5);
      modeAwardRound(m, false);
      modeWinBout(ROSTER, m, rng);
    }

    expect(modeStatus(m)).toBe('champion');
  });

  it('goes straight to eliminated on a loss in every round, with no countdown', () => {
    for (let losingRound = 0; losingRound < tournament.TOURNAMENT_BOUTS; losingRound++) {
      const m = createTournamentMode(ROSTER, PLAYER_ID, STAGES, makeLcg(700 + losingRound));
      const rng = makeLcg(9);
      for (let bout = 0; bout < losingRound; bout++) modeWinBout(ROSTER, m, rng);

      modeLoseBout(m);

      expect(modeStatus(m)).toBe('eliminated');
      expect(modeContinueMsLeft(m)).toBe(0);
    }
  });
});

describe('mode — the champion panel subtitle', () => {
  it('stays empty for the story, exactly as the v1 panel drew it', () => {
    expect(modeChampionSubtitle(createStoryMode(ROSTER, PLAYER_ID))).toBe('');
  });

  it('names the black belt for the tournament', () => {
    const m = createTournamentMode(ROSTER, PLAYER_ID, STAGES, makeLcg(12));

    expect(modeChampionSubtitle(m)).toBe('CINTURÓN NEGRO');
  });
});

describe('mode — the bracket the screen paints', () => {
  it('gives the story no bracket at all, so the phase never exists for it', () => {
    const m = createStoryMode(ROSTER, PLAYER_ID);

    expect(modeBracketIds(m)).toBeNull();
    expect(modeIsFinale(m)).toBe(false);
  });

  it('gives the tournament the eight seeded fighters, the player among them', () => {
    const m = createTournamentMode(ROSTER, PLAYER_ID, STAGES, makeLcg(3));
    const ids = modeBracketIds(m);

    expect(ids).not.toBeNull();
    expect(ids).toHaveLength(selectableFighters(ROSTER).length);
    expect(ids).toContain(PLAYER_ID);
    expect(ids).not.toContain(BOSS.id);
  });

  it('hands back the tournament array itself, so a run never rebuilds it', () => {
    const m = createTournamentMode(ROSTER, PLAYER_ID, STAGES, makeLcg(4));

    expect(modeBracketIds(m)).toBe(modeBracketIds(m));
  });

  it('reports everyone still in at the quarters and four out at the semis', () => {
    const m = createTournamentMode(ROSTER, PLAYER_ID, STAGES, makeLcg(5));
    const ids = modeBracketIds(m);
    if (ids === null) throw new Error('the tournament must have a bracket');

    for (const id of ids) expect(modeStillIn(m, id)).toBe(true);

    modeWinBout(ROSTER, m, makeLcg(500));

    let alive = 0;
    for (const id of ids) if (modeStillIn(m, id)) alive++;
    expect(alive).toBe(4);
    expect(modeStillIn(m, PLAYER_ID)).toBe(true);
  });

  it('flags the finale only on the super final, and the rival there is the boss', () => {
    const m = createTournamentMode(ROSTER, PLAYER_ID, STAGES, makeLcg(6));
    const rng = makeLcg(600);

    expect(modeIsFinale(m)).toBe(false);
    modeWinBout(ROSTER, m, rng);
    expect(modeIsFinale(m)).toBe(false);
    modeWinBout(ROSTER, m, rng);
    expect(modeIsFinale(m)).toBe(false);
    modeWinBout(ROSTER, m, rng);

    expect(modeIsFinale(m)).toBe(true);
    expect(modeOpponent(ROSTER, m).id).toBe(BOSS.id);
    expect(modeBoutLabel(m)).toBe('SUPER FINAL');
  });

  it('keeps the boss out of the bracket even when he is the rival', () => {
    const m = createTournamentMode(ROSTER, PLAYER_ID, STAGES, makeLcg(7));
    const rng = makeLcg(700);
    while (!modeIsFinale(m)) modeWinBout(ROSTER, m, rng);

    expect(modeBracketIds(m)).not.toContain(BOSS.id);
    expect(modeStillIn(m, BOSS.id)).toBe(false);
  });
});
