import { describe, expect, it } from 'vitest';
import { STAGE_COUNT, STAGES, stageForBout } from './stages';
import { checkStages } from './roster-invariants';

describe('the published stages', () => {
  it('publishes eight stages with no invariant problems', () => {
    expect(checkStages(STAGES)).toEqual([]);
  });
  it('has exactly eight stages', () => {
    expect(STAGES).toHaveLength(STAGE_COUNT);
  });
  it('gives every stage a different id, name, silhouette and sky', () => {
    expect(new Set(STAGES.map((s) => s.id)).size).toBe(STAGE_COUNT);
    expect(new Set(STAGES.map((s) => s.name)).size).toBe(STAGE_COUNT);
    expect(new Set(STAGES.map((s) => s.silhouette)).size).toBe(STAGE_COUNT);
    expect(new Set(STAGES.map((s) => s.sky.join('|'))).size).toBe(STAGE_COUNT);
  });
  it('puts the boss stage last, since bout 8 is its own', () => {
    expect(STAGES[STAGES.length - 1].id).toBe('nucleo');
  });
});

describe('stageForBout', () => {
  it('gives each of the eight bouts a distinct stage', () => {
    const seen = new Set<string>();
    for (let bout = 0; bout < STAGE_COUNT; bout++) {
      seen.add(stageForBout(STAGES, bout).id);
    }
    expect(seen.size).toBe(STAGE_COUNT);
  });
  it('clamps a negative bout index to the first stage', () => {
    expect(stageForBout(STAGES, -1).id).toBe(STAGES[0].id);
  });
  it('clamps an out-of-range bout index to the last stage', () => {
    expect(stageForBout(STAGES, 99).id).toBe(STAGES[STAGE_COUNT - 1].id);
  });
});
