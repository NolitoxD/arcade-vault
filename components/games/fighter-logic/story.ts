import { bossFighter, difficultyRank, fighterById, selectableFighters, type FighterDef, type FighterId } from './fighters';
import { stageForBout, type StageDef } from './stages';

export const BOUTS = 8;
export const CONTINUE_MS = 10_000;

export const SCORE_PER_DAMAGE = 10;
export const SCORE_ROUND = 2_000;
export const SCORE_PERFECT_ROUND = 1_000;
export const SCORE_BOUT = 8_000;
export const SCORE_BOSS = 20_000;

export type StoryStatus = 'fighting' | 'continue' | 'champion' | 'eliminated';

export type StoryState = {
  playerId: FighterId;
  order: FighterId[];
  bout: number;
  status: StoryStatus;
  continueMsLeft: number;
  continuesUsed: number;
  score: number;
};

export function createStory(roster: readonly FighterDef[], playerId: FighterId): StoryState {
  const rivals = selectableFighters(roster)
    .filter((f) => f.id !== playerId)
    .sort((a, b) => difficultyRank(a) - difficultyRank(b))
    .map((f) => f.id);
  const boss = bossFighter(roster);

  return {
    playerId,
    order: [...rivals, boss.id],
    bout: 0,
    status: 'fighting',
    continueMsLeft: 0,
    continuesUsed: 0,
    score: 0,
  };
}

export function currentOpponent(roster: readonly FighterDef[], story: StoryState): FighterDef {
  const id = story.order[story.bout];
  const fighter = fighterById(roster, id);
  if (!fighter) throw new Error(`fighter not found in roster: ${id}`);
  return fighter;
}

export function currentStage(stages: readonly StageDef[], story: StoryState): StageDef {
  return stageForBout(stages, story.bout);
}

export function currentDifficulty(story: StoryState): number {
  return story.bout + 1;
}

export function winBout(story: StoryState): void {
  if (story.status !== 'fighting') return;

  if (story.bout === BOUTS - 1) {
    story.status = 'champion';
    story.score += SCORE_BOUT + SCORE_BOSS;
    return;
  }

  story.score += SCORE_BOUT;
  story.bout += 1;
}

export function loseBout(story: StoryState): void {
  if (story.status !== 'fighting') return;

  story.status = 'continue';
  story.continueMsLeft = CONTINUE_MS;
}

export function tickContinue(story: StoryState, dtMs: number): void {
  if (story.status !== 'continue') return;

  story.continueMsLeft = Math.max(0, story.continueMsLeft - dtMs);
  if (story.continueMsLeft === 0) {
    story.status = 'eliminated';
  }
}

export function acceptContinue(story: StoryState): void {
  if (story.status !== 'continue') return;

  story.status = 'fighting';
  story.continueMsLeft = 0;
  story.continuesUsed += 1;
}

export function declineContinue(story: StoryState): void {
  if (story.status !== 'continue') return;

  story.status = 'eliminated';
}

export function awardDamage(story: StoryState, damage: number): void {
  if (story.status !== 'fighting') return;

  story.score += damage * SCORE_PER_DAMAGE;
}

export function awardRound(story: StoryState, perfect: boolean): void {
  if (story.status !== 'fighting') return;

  story.score += SCORE_ROUND + (perfect ? SCORE_PERFECT_ROUND : 0);
}
