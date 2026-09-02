import { describe, expect, it } from 'vitest';
import { fighterById, selectableFighters, ROSTER, type FighterDef, type FighterId } from './fighters';
import { createStory, currentDifficulty as storyCurrentDifficulty, BOUTS, SCORE_BOSS, SCORE_BOUT as STORY_SCORE_BOUT } from './story';
import { STAGES, STAGE_COUNT } from './stages';
import {
  awardDamage,
  awardRound,
  boutLabel,
  boutWeight,
  BRACKET_SIZE,
  checkTournamentBracket,
  createTournament,
  currentDifficulty,
  currentOpponent,
  currentStage,
  drawWinner,
  loseBout,
  SCORE_BLACK_BELT,
  SCORE_BOUT,
  SCORE_PER_DAMAGE,
  SCORE_PERFECT_ROUND,
  SCORE_ROUND,
  SPREAD,
  TOURNAMENT_BOUTS,
  winBout,
  type TournamentState,
} from './tournament';

const PLAYABLE_IDS = selectableFighters(ROSTER).map((f) => f.id);

function requireFighter(id: FighterId): FighterDef {
  const fighter = fighterById(ROSTER, id);
  if (!fighter) throw new Error(`missing fighter ${id}`);
  return fighter;
}

function makeLcg(seed: number): () => number {
  let s = seed;
  return () => ((s = (s * 1103515245 + 12345) & 0x7fffffff), s / 0x7fffffff);
}

// A valid, hand-built quarters state for 'nova', used as the base for the
// fabricated negative fixtures below.
function validQuartersState(): TournamentState {
  return {
    playerId: 'nova',
    round: 'quarters',
    entrants: ['nova', 'torre', 'glitch', 'voltio', 'oxido', 'eco', 'pixel', 'brecha'],
    opponentId: 'torre',
    stageIds: [],
    status: 'fighting',
    score: 0,
  };
}

describe('createTournament', () => {
  it('seeds a bracket of exactly the 8 selectable fighters, for every possible choice', () => {
    for (const playerId of PLAYABLE_IDS) {
      const t = createTournament(ROSTER, playerId, STAGES, makeLcg(1));
      expect(checkTournamentBracket(t, ROSTER)).toEqual([]);
    }
  });

  it('starts at quarters, fighting, with 4 stageIds drawn and zero score', () => {
    const t = createTournament(ROSTER, 'nova', STAGES, makeLcg(1));
    expect(t.round).toBe('quarters');
    expect(t.status).toBe('fighting');
    expect(t.stageIds).toHaveLength(TOURNAMENT_BOUTS);
    expect(t.score).toBe(0);
  });

  it('gives two tournaments built with the same seed the exact same bracket', () => {
    const a = createTournament(ROSTER, 'nova', STAGES, makeLcg(42));
    const b = createTournament(ROSTER, 'nova', STAGES, makeLcg(42));
    expect(a.entrants).toEqual(b.entrants);
    expect(a.opponentId).toBe(b.opponentId);
  });

  it('gives two tournaments independent entrants arrays in memory, even from the same seed', () => {
    const a = createTournament(ROSTER, 'nova', STAGES, makeLcg(1));
    const b = createTournament(ROSTER, 'nova', STAGES, makeLcg(1));
    expect(a.entrants).not.toBe(b.entrants);
    const snapshotA = [...a.entrants];
    a.entrants[0] = a.entrants[0] === 'torre' ? 'oxido' : 'torre';
    expect(b.entrants).not.toEqual(a.entrants);
    expect(a.entrants).not.toEqual(snapshotA);
  });
});

describe('currentOpponent', () => {
  it('resolves the opponent id to a FighterDef from the roster', () => {
    const t = createTournament(ROSTER, 'nova', STAGES, makeLcg(1));
    const opponent = currentOpponent(ROSTER, t);
    expect(opponent.id).toBe(t.opponentId);
  });
});

describe('boutLabel', () => {
  it('gives the Spanish uppercase label for each round', () => {
    const base = validQuartersState();
    expect(boutLabel(base)).toBe('CUARTOS');
    expect(boutLabel({ ...base, round: 'semis' })).toBe('SEMIFINAL');
    expect(boutLabel({ ...base, round: 'final' })).toBe('FINAL');
    expect(boutLabel({ ...base, round: 'black-belt' })).toBe('SUPER FINAL');
  });
});

describe('winBout: bracket progression', () => {
  it('halves the entrants each round: 8 -> 4 -> 2 -> 1, then crowns a champion', () => {
    const t = createTournament(ROSTER, 'nova', STAGES, makeLcg(7));
    const rng = makeLcg(700);

    expect(t.entrants).toHaveLength(BRACKET_SIZE);
    winBout(ROSTER, t, rng);
    expect(t.round).toBe('semis');
    expect(t.entrants).toHaveLength(4);
    expect(checkTournamentBracket(t, ROSTER)).toEqual([]);

    winBout(ROSTER, t, rng);
    expect(t.round).toBe('final');
    expect(t.entrants).toHaveLength(2);
    expect(checkTournamentBracket(t, ROSTER)).toEqual([]);

    winBout(ROSTER, t, rng);
    expect(t.round).toBe('black-belt');
    expect(t.entrants).toEqual(['nova']);
    expect(t.opponentId).toBe('arquitecto');
    expect(checkTournamentBracket(t, ROSTER)).toEqual([]);
    expect(t.status).toBe('fighting');

    winBout(ROSTER, t, rng);
    expect(t.status).toBe('champion');
  });

  it('takes exactly 4 wins for the player to become champion, for every possible choice', () => {
    for (const playerId of PLAYABLE_IDS) {
      const t = createTournament(ROSTER, playerId, STAGES, makeLcg(3));
      const rng = makeLcg(300);
      let wins = 0;
      while (t.status === 'fighting') {
        winBout(ROSTER, t, rng);
        wins++;
      }
      expect(wins).toBe(TOURNAMENT_BOUTS);
      expect(t.status).toBe('champion');
    }
  });

  it('never puts arquitecto in the bracket and always makes it the black-belt rival, for every possible choice', () => {
    for (const playerId of PLAYABLE_IDS) {
      const t = createTournament(ROSTER, playerId, STAGES, makeLcg(9));
      const rng = makeLcg(900);
      while (t.status === 'fighting') {
        expect(t.entrants).not.toContain('arquitecto');
        if (t.round === 'black-belt') expect(t.opponentId).toBe('arquitecto');
        else expect(t.opponentId).not.toBe('arquitecto');
        winBout(ROSTER, t, rng);
      }
    }
  });

  it('produces the exact same bracket through every round with the same seeds', () => {
    const a = createTournament(ROSTER, 'nova', STAGES, makeLcg(11));
    const b = createTournament(ROSTER, 'nova', STAGES, makeLcg(11));
    const rngA = makeLcg(1100);
    const rngB = makeLcg(1100);

    while (a.status === 'fighting') {
      winBout(ROSTER, a, rngA);
      winBout(ROSTER, b, rngB);
      expect(a.round).toBe(b.round);
      expect(a.entrants).toEqual(b.entrants);
      expect(a.opponentId).toBe(b.opponentId);
    }
    expect(a.status).toBe('champion');
  });

  it('does nothing to an eliminated tournament', () => {
    const t = createTournament(ROSTER, 'nova', STAGES, makeLcg(5));
    loseBout(t);
    expect(t.status).toBe('eliminated');
    const before = { ...t, entrants: [...t.entrants] };
    winBout(ROSTER, t, makeLcg(500));
    expect(t.status).toBe('eliminated');
    expect(t.round).toBe(before.round);
    expect(t.entrants).toEqual(before.entrants);
  });

  it('does nothing to an already-crowned champion (duplicate win event)', () => {
    // Hand-built: status is already 'champion' but the round is still an
    // intermediate one ('quarters'). A black-belt-round champion fixture
    // wouldn't do here — winBout would take the round==='black-belt'
    // branch either way and never touch entrants, so a missing guard would
    // stay invisible. Here, without the guard, round !== 'black-belt' would
    // send it straight into the halving branch: entrants would drop from 8
    // to 4 and round would advance to 'semis' — a real, observable
    // mutation that status alone would not catch (this branch never
    // reassigns status, so `status` stays 'champion' with or without the
    // guard).
    const t: TournamentState = { ...validQuartersState(), status: 'champion' };
    const before = { entrants: [...t.entrants], round: t.round };
    winBout(ROSTER, t, makeLcg(1300)); // duplicate event, e.g. a double rAF callback firing
    expect(t.status).toBe('champion');
    expect(t.entrants).toEqual(before.entrants);
    expect(t.round).toBe(before.round);
  });
});

describe('loseBout', () => {
  it('eliminates immediately, without any continue state', () => {
    const t = createTournament(ROSTER, 'nova', STAGES, makeLcg(1));
    loseBout(t);
    expect(t.status).toBe('eliminated');
  });

  it('does nothing to a tournament that is not fighting, exercising the mutating path', () => {
    // loseBout's only mutation is `status = 'eliminated'`, so calling it
    // again on an already-eliminated tournament ('eliminated' -> repeat
    // 'eliminated') is idempotent even without the guard — that scenario
    // can't tell a missing guard from a working one. This hand-built
    // fixture (status forced to 'champion', no real 4-win playthrough
    // needed — see the end-to-end version right below) exercises the one
    // route that is actually observable: without the guard, loseBout
    // would overwrite 'champion' with 'eliminated'.
    const t: TournamentState = { ...validQuartersState(), status: 'champion' };
    loseBout(t);
    expect(t.status).toBe('champion');
  });

  it('does nothing to an already-crowned champion', () => {
    const t = createTournament(ROSTER, 'nova', STAGES, makeLcg(15));
    const rng = makeLcg(1500);
    while (t.status === 'fighting') winBout(ROSTER, t, rng);
    expect(t.status).toBe('champion');
    loseBout(t);
    expect(t.status).toBe('champion');
  });
});

// ── The weighted draw, with the spec's own numbers ─────────────────────────
//
// eco is the roster's weakest difficultyRank (16.2) and glitch the strongest
// (18.0); brecha (16.7) and torre (16.5) are neighbors in the table. See
// boutWeight for the formula.

describe('boutWeight', () => {
  it('gives the weakest fighter in the roster weight 1 and the strongest weight 1 + SPREAD', () => {
    expect(boutWeight(requireFighter('eco'), ROSTER)).toBeCloseTo(1, 10);
    expect(boutWeight(requireFighter('glitch'), ROSTER)).toBeCloseTo(1 + SPREAD, 10);
  });

  it('gives the extreme pair (glitch vs eco) exactly the 80% figure from the spec', () => {
    const wGlitch = boutWeight(requireFighter('glitch'), ROSTER);
    const wEco = boutWeight(requireFighter('eco'), ROSTER);
    expect(wGlitch / (wGlitch + wEco)).toBeCloseTo(0.8, 10);
  });

  it('gives a neighboring pair (brecha vs torre) exactly the 55/45 figure from the spec', () => {
    const wBrecha = boutWeight(requireFighter('brecha'), ROSTER);
    const wTorre = boutWeight(requireFighter('torre'), ROSTER);
    expect(wBrecha / (wBrecha + wTorre)).toBeCloseTo(0.55, 10);
  });

  it('recomputes min and max from whatever roster it receives, never hard-coded', () => {
    // Within this smaller roster, torre (16.5) is the weakest and oxido
    // (16.9) the strongest — neither is the extreme in the full 8-fighter
    // ROSTER, so this only passes if the range comes from the parameter.
    const customRoster = [requireFighter('torre'), requireFighter('oxido')];
    expect(boutWeight(requireFighter('torre'), customRoster)).toBeCloseTo(1, 10);
    expect(boutWeight(requireFighter('oxido'), customRoster)).toBeCloseTo(1 + SPREAD, 10);
  });

  it('does not divide by zero when every fighter in the roster shares the same rank', () => {
    const flatRoster: FighterDef[] = [requireFighter('nova'), { ...requireFighter('nova'), id: 'torre' }];
    expect(boutWeight(requireFighter('nova'), flatRoster)).toBeCloseTo(1, 10);
  });
});

describe('drawWinner: statistical weighting over a large controlled sample', () => {
  it('the extreme favorite (glitch) beats the weakest fighter (eco) around 80% of the time', () => {
    const rng = makeLcg(2024);
    const trials = 10_000;
    let glitchWins = 0;
    for (let i = 0; i < trials; i++) {
      if (drawWinner('glitch', 'eco', ROSTER, rng) === 'glitch') glitchWins++;
    }
    const ratio = glitchWins / trials;
    expect(ratio).toBeGreaterThan(0.78);
    expect(ratio).toBeLessThan(0.82);
  });

  it('two neighboring fighters (brecha vs torre) land close to 55/45', () => {
    const rng = makeLcg(2025);
    const trials = 10_000;
    let brechaWins = 0;
    for (let i = 0; i < trials; i++) {
      if (drawWinner('brecha', 'torre', ROSTER, rng) === 'brecha') brechaWins++;
    }
    const ratio = brechaWins / trials;
    expect(ratio).toBeGreaterThan(0.52);
    expect(ratio).toBeLessThan(0.58);
  });
});

// ── The invariant net, each with a fabricated negative case ────────────────

describe('checkTournamentBracket: accepts every legal state produced by the module', () => {
  it('reports no problems for a hand-built valid quarters state', () => {
    expect(checkTournamentBracket(validQuartersState(), ROSTER)).toEqual([]);
  });
});

describe('checkTournamentBracket rejects what it is there to reject', () => {
  it('rejects a bracket missing one of the eight selectable fighters', () => {
    const bad: TournamentState = {
      ...validQuartersState(),
      entrants: ['nova', 'torre', 'glitch', 'voltio', 'oxido', 'eco', 'pixel'], // brecha dropped, size 7
    };
    const problems = checkTournamentBracket(bad, ROSTER).join(' ');
    expect(problems).toContain('entrants size 7 for round quarters');
    expect(problems).toContain('not exactly the 8 selectable fighters');
  });

  it('rejects a bracket where the player is missing', () => {
    const bad: TournamentState = {
      ...validQuartersState(),
      entrants: ['torre', 'glitch', 'voltio', 'oxido', 'eco', 'pixel', 'brecha', 'torre'], // nova dropped
    };
    expect(checkTournamentBracket(bad, ROSTER).join(' ')).toContain('player missing from entrants');
  });

  it('rejects a bracket with the same fighter twice', () => {
    const bad: TournamentState = {
      ...validQuartersState(),
      entrants: ['nova', 'torre', 'glitch', 'voltio', 'oxido', 'eco', 'pixel', 'nova'], // brecha dropped, nova twice
    };
    expect(checkTournamentBracket(bad, ROSTER).join(' ')).toContain('duplicate entrant nova');
  });

  it('rejects a bracket that includes arquitecto', () => {
    const bad: TournamentState = {
      ...validQuartersState(),
      entrants: ['nova', 'torre', 'glitch', 'voltio', 'oxido', 'eco', 'pixel', 'arquitecto'], // brecha dropped
    };
    expect(checkTournamentBracket(bad, ROSTER).join(' ')).toContain('arquitecto in the bracket');
  });

  it('rejects a black-belt round whose opponent is not arquitecto', () => {
    const bad: TournamentState = {
      playerId: 'nova', round: 'black-belt', entrants: ['nova'],
      opponentId: 'torre', stageIds: [], status: 'fighting', score: 0,
    };
    expect(checkTournamentBracket(bad, ROSTER).join(' ')).toContain('black-belt opponent is not arquitecto');
  });

  it('rejects arquitecto as the opponent outside the black-belt round', () => {
    const bad: TournamentState = { ...validQuartersState(), opponentId: 'arquitecto' };
    expect(checkTournamentBracket(bad, ROSTER).join(' ')).toContain('arquitecto faced outside black-belt (round quarters)');
  });

  it('rejects a round whose entrants were not halved (semis stuck at 8)', () => {
    const bad: TournamentState = { ...validQuartersState(), round: 'semis', opponentId: 'torre' };
    expect(checkTournamentBracket(bad, ROSTER).join(' ')).toContain('entrants size 8 for round semis');
  });
});

// ── Step 2: scenarios and difficulty ────────────────────────────────────

describe('createTournament: stage draw', () => {
  it('draws 3 distinct non-repeating stages plus nucleo as the 4th slot', () => {
    const t = createTournament(ROSTER, 'nova', STAGES, makeLcg(1));
    expect(t.stageIds).toHaveLength(TOURNAMENT_BOUTS);
    const drawnThree = t.stageIds.slice(0, 3);
    expect(new Set(drawnThree).size).toBe(3);
  });

  it('always reserves the 4th slot for nucleo, for every possible player choice', () => {
    for (const playerId of PLAYABLE_IDS) {
      const t = createTournament(ROSTER, playerId, STAGES, makeLcg(1));
      expect(t.stageIds[3]).toBe('nucleo');
      expect(t.stageIds.slice(0, 3)).not.toContain('nucleo');
    }
  });

  it('draws the 3 stages only from the first seven (non-nucleo) stages', () => {
    const nonNucleoIds = STAGES.filter((s) => s.id !== 'nucleo').map((s) => s.id);
    expect(nonNucleoIds).toHaveLength(STAGE_COUNT - 1);
    const t = createTournament(ROSTER, 'nova', STAGES, makeLcg(1));
    for (const id of t.stageIds.slice(0, 3)) {
      expect(nonNucleoIds).toContain(id);
    }
  });

  it('gives two tournaments built with the same seed the exact same stageIds', () => {
    const a = createTournament(ROSTER, 'nova', STAGES, makeLcg(42));
    const b = createTournament(ROSTER, 'nova', STAGES, makeLcg(42));
    expect(a.stageIds).toEqual(b.stageIds);
  });
});

describe('currentStage', () => {
  it('resolves the current round stage id to a StageDef from the given stages', () => {
    const t = createTournament(ROSTER, 'nova', STAGES, makeLcg(1));
    expect(currentStage(STAGES, t).id).toBe(t.stageIds[0]);
  });

  it('follows the round through the whole bracket: quarters -> semis -> final -> nucleo', () => {
    const t = createTournament(ROSTER, 'nova', STAGES, makeLcg(7));
    const rng = makeLcg(700);

    expect(currentStage(STAGES, t).id).toBe(t.stageIds[0]);
    winBout(ROSTER, t, rng);
    expect(currentStage(STAGES, t).id).toBe(t.stageIds[1]);
    winBout(ROSTER, t, rng);
    expect(currentStage(STAGES, t).id).toBe(t.stageIds[2]);
    winBout(ROSTER, t, rng);
    expect(currentStage(STAGES, t).id).toBe('nucleo');
  });
});

describe('currentDifficulty', () => {
  it('returns 3, 5, 7 and 8 for quarters, semis, final and black-belt — not 1..4', () => {
    const base = validQuartersState();
    expect(currentDifficulty(base)).toBe(3);
    expect(currentDifficulty({ ...base, round: 'semis' })).toBe(5);
    expect(currentDifficulty({ ...base, round: 'final' })).toBe(7);
    expect(currentDifficulty({ ...base, round: 'black-belt' })).toBe(8);
  });

  it('gives the black-belt bout the exact same difficulty as the boss bout in story mode', () => {
    const story = createStory(ROSTER, 'nova');
    const bossStory = { ...story, bout: BOUTS - 1 };
    expect(storyCurrentDifficulty(bossStory)).toBe(8);
    const blackBelt: TournamentState = { ...validQuartersState(), round: 'black-belt' };
    expect(currentDifficulty(blackBelt)).toBe(storyCurrentDifficulty(bossStory));
  });
});

// ── Step 3: tournament scoring ──────────────────────────────────────────

describe('winBout: score', () => {
  it('awards SCORE_BOUT per win, plus SCORE_BLACK_BELT on the black-belt win', () => {
    const t = createTournament(ROSTER, 'nova', STAGES, makeLcg(7));
    const rng = makeLcg(700);

    winBout(ROSTER, t, rng); // quarters -> semis
    expect(t.score).toBe(SCORE_BOUT);
    winBout(ROSTER, t, rng); // semis -> final
    expect(t.score).toBe(SCORE_BOUT * 2);
    winBout(ROSTER, t, rng); // final -> black-belt
    expect(t.score).toBe(SCORE_BOUT * 3);
    winBout(ROSTER, t, rng); // black-belt -> champion
    expect(t.score).toBe(SCORE_BOUT * 4 + SCORE_BLACK_BELT);
  });

  it('does not add score twice on a duplicate champion win event', () => {
    const t = createTournament(ROSTER, 'nova', STAGES, makeLcg(13));
    const rng = makeLcg(1300);
    while (t.status === 'fighting') winBout(ROSTER, t, rng);
    const scoreAtChampion = t.score;
    winBout(ROSTER, t, rng); // duplicate event, e.g. a double rAF callback firing
    expect(t.score).toBe(scoreAtChampion);
  });

  it('does not add score to an eliminated tournament', () => {
    const t = createTournament(ROSTER, 'nova', STAGES, makeLcg(5));
    loseBout(t);
    winBout(ROSTER, t, makeLcg(500));
    expect(t.score).toBe(0);
  });
});

describe('awardDamage', () => {
  it('converts damage into score at SCORE_PER_DAMAGE per point', () => {
    const t = createTournament(ROSTER, 'nova', STAGES, makeLcg(1));
    awardDamage(t, 10);
    expect(t.score).toBe(10 * SCORE_PER_DAMAGE);
  });

  it('does nothing to a tournament that is not fighting', () => {
    const t = createTournament(ROSTER, 'nova', STAGES, makeLcg(1));
    loseBout(t);
    awardDamage(t, 10);
    expect(t.score).toBe(0);
  });
});

describe('awardRound', () => {
  it('awards SCORE_ROUND for a normal round win', () => {
    const t = createTournament(ROSTER, 'nova', STAGES, makeLcg(1));
    awardRound(t, false);
    expect(t.score).toBe(SCORE_ROUND);
  });

  it('adds SCORE_PERFECT_ROUND on top for a perfect round', () => {
    const t = createTournament(ROSTER, 'nova', STAGES, makeLcg(1));
    awardRound(t, true);
    expect(t.score).toBe(SCORE_ROUND + SCORE_PERFECT_ROUND);
  });

  it('does nothing to a tournament that is not fighting', () => {
    const t = createTournament(ROSTER, 'nova', STAGES, makeLcg(1));
    loseBout(t);
    awardRound(t, true);
    expect(t.score).toBe(0);
  });
});

// The test that protects both modes coexisting in the same vault-fighter
// leaderboard: a perfect run of either mode has to cap at the identical
// number, or one mode would dominate the table just by existing.
describe('tournament vs story ceiling', () => {
  it('a perfect tournament (4 bouts) and a perfect story (8 bouts) cap at the exact same 84,000', () => {
    const tournamentCeiling = TOURNAMENT_BOUTS * SCORE_BOUT + SCORE_BLACK_BELT;
    const storyCeiling = BOUTS * STORY_SCORE_BOUT + SCORE_BOSS;
    expect(tournamentCeiling).toBe(84_000);
    expect(storyCeiling).toBe(84_000);
    expect(tournamentCeiling).toBe(storyCeiling);
  });

  it('a played-out perfect tournament actually reaches 84,000 via winBout alone', () => {
    const t = createTournament(ROSTER, 'nova', STAGES, makeLcg(21));
    const rng = makeLcg(2100);
    while (t.status === 'fighting') winBout(ROSTER, t, rng);
    expect(t.status).toBe('champion');
    expect(t.score).toBe(84_000);
  });
});
