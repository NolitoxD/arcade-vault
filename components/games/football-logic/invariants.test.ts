import { describe, expect, it } from 'vitest';
import { checkBank, checkFormation, checkFormations, checkGoalkeepersInBox, checkPitch, checkTeam, checkTeams } from './invariants';
import { PITCH, type PitchDef } from './pitch';
import { BANK_SIZE, FORMATION_COUNT, FORMATIONS, OUTFIELD, type Formation, type FormationSlot, type TeamDef } from './teams';
import { createPlayers } from './players';

function pitch(over: Partial<PitchDef> = {}): PitchDef {
  return { ...PITCH, ...over };
}

// A legal 8-slot formation built by hand — NOT the published one — so the
// negative tests mutate a fixture and never the content.
function legalFormation(over: Partial<Formation> = {}): Formation {
  const slots: FormationSlot[] = [
    { role: 'def', x: 0.2, y: 0.25 }, { role: 'def', x: 0.2, y: 0.5 }, { role: 'def', x: 0.2, y: 0.75 },
    { role: 'mid', x: 0.45, y: 0.25 }, { role: 'mid', x: 0.45, y: 0.5 }, { role: 'mid', x: 0.45, y: 0.75 },
    { role: 'fwd', x: 0.7, y: 0.35 }, { role: 'fwd', x: 0.7, y: 0.65 },
  ];
  return { id: '3-3-2', name: 'NORMAL', slots, ...over };
}

function team(over: Partial<TeamDef> = {}): TeamDef {
  return { id: 'espana', name: 'ESPAÑA', kit: { primary: '#d40000', secondary: '#ffcc00' }, ...over };
}

function legalBank(): TeamDef[] {
  const list: TeamDef[] = [];
  for (let i = 0; i < BANK_SIZE; i++) {
    const hex = (i * 16).toString(16).padStart(2, '0');
    list.push(team({ id: `team-${i}`, name: `EQUIPO ${i}`, kit: { primary: `#${hex}00ff`, secondary: `#ff${hex}00` } }));
  }
  return list;
}

describe('checkPitch accepts the published pitch and rejects incoherent geometry', () => {
  it('accepts PITCH', () => expect(checkPitch(PITCH)).toEqual([]));
  it('rejects a pitch taller than wide', () => {
    expect(checkPitch(pitch({ width: 1000, height: 1300 })).join(' ')).toContain('bad size');
  });
  it('rejects a non-positive height even though width is still greater', () => {
    // height: 0 also trips 'big area wider than pitch' (bigAreaWidth > height) and
    // 'bad center circle' (radius < height/2 becomes radius < 0); the assertion
    // below targets only the 'bad size' message produced by the height>0 clause.
    expect(checkPitch(pitch({ height: 0 })).join(' ')).toContain('bad size');
  });
  it('rejects a goal wider than the small area', () => {
    expect(checkPitch(pitch({ goalWidth: 360 })).join(' ')).toContain('goal wider than small area');
  });
  it('rejects a small area wider than the big area', () => {
    expect(checkPitch(pitch({ smallAreaWidth: 800 })).join(' ')).toContain('small area wider than big area');
  });
  it('rejects a big area wider than the pitch', () => {
    expect(checkPitch(pitch({ bigAreaWidth: 1400 })).join(' ')).toContain('big area wider than pitch');
  });
  it('rejects a small area deeper than the big area', () => {
    expect(checkPitch(pitch({ smallAreaDepth: 330 })).join(' ')).toContain('small area deeper than big area');
  });
  it('rejects a non-positive small area depth', () => {
    // smallAreaDepth only appears in this check and in the penalty-spot check
    // (210 <= 0 is false), so no neighbouring check is coincidentally tripped.
    expect(checkPitch(pitch({ smallAreaDepth: 0 })).join(' ')).toContain('small area deeper than big area');
  });
  it('rejects a big area past the halfway line', () => {
    expect(checkPitch(pitch({ bigAreaDepth: 1010, penaltySpotDist: 500 })).join(' ')).toContain('big area past halfway');
  });
  it('rejects a penalty spot outside the big area', () => {
    expect(checkPitch(pitch({ penaltySpotDist: 340 })).join(' ')).toContain('penalty spot outside big area');
  });
  it('rejects a penalty spot inside the small area', () => {
    expect(checkPitch(pitch({ penaltySpotDist: 90 })).join(' ')).toContain('penalty spot inside small area');
  });
  it('rejects a zero crossbar', () => {
    expect(checkPitch(pitch({ crossbarHeight: 0 })).join(' ')).toContain('bad crossbar');
  });
  it('rejects a center circle that crosses the touch lines', () => {
    expect(checkPitch(pitch({ centerCircleRadius: 700 })).join(' ')).toContain('bad center circle');
  });
  it('rejects a non-positive center circle radius', () => {
    // centerCircleRadius appears in no other check, so this cannot coincide with another failure.
    expect(checkPitch(pitch({ centerCircleRadius: 0 })).join(' ')).toContain('bad center circle');
  });
});

describe('checkFormation', () => {
  it('accepts the legal fixture', () => expect(checkFormation(legalFormation())).toEqual([]));
  it('rejects seven slots', () => {
    const f = legalFormation();
    expect(checkFormation({ ...f, id: '3-3-1', slots: f.slots.slice(0, OUTFIELD - 1) }).join(' ')).toContain('slot count 7');
  });
  it('rejects nine slots', () => {
    const f = legalFormation();
    expect(checkFormation({ ...f, id: '3-3-3', slots: [...f.slots, { role: 'fwd', x: 0.7, y: 0.5 }] }).join(' ')).toContain('slot count 9');
  });
  it('rejects a goalkeeper smuggled into the slots', () => {
    const f = legalFormation();
    const slots = [...f.slots];
    slots[0] = { role: 'gk' as never, x: 0.2, y: 0.25 };
    expect(checkFormation({ ...f, slots }).join(' ')).toContain('goalkeeper in formation');
  });
  it('rejects a slot outside the pitch', () => {
    const f = legalFormation();
    const slots = [...f.slots];
    slots[4] = { role: 'mid', x: 1.05, y: 0.5 };
    expect(checkFormation({ ...f, slots }).join(' ')).toContain('slot 4 out of pitch');
  });
  it('rejects a slot that leaves the pitch once the attack strategy shifts it', () => {
    const f = legalFormation();
    const slots = [...f.slots];
    slots[7] = { role: 'fwd', x: 0.93, y: 0.65 };   // 0.93 + 0.12 > 1
    expect(checkFormation({ ...f, slots }).join(' ')).toContain('slot 7 leaves pitch under strategy');
  });
  it('rejects a slot that leaves the pitch once the defend strategy shifts it', () => {
    const f = legalFormation();
    const slots = [...f.slots];
    slots[0] = { role: 'def', x: 0.08, y: 0.25 };   // 0.08 - 0.12 < 0
    expect(checkFormation({ ...f, slots }).join(' ')).toContain('slot 0 leaves pitch under strategy');
  });
  it('rejects two slots on the same point', () => {
    const f = legalFormation();
    const slots = [...f.slots];
    slots[3] = { ...slots[4] };
    expect(checkFormation({ ...f, slots }).join(' ')).toContain('duplicate slot position');
  });
  it('rejects an id that does not describe the slots', () => {
    expect(checkFormation(legalFormation({ id: '4-3-1' })).join(' ')).toContain('id does not match slots');
  });
});

describe('checkFormations', () => {
  function three(): Formation[] {
    const a = legalFormation();
    const b = legalFormation({ id: '3-2-3', slots: a.slots.map((s, i) => (i === 5 ? { ...s, role: 'fwd', x: 0.7, y: 0.5 } : s)) });
    const c = legalFormation({ id: '4-3-1', slots: a.slots.map((s, i) => (i === 7 ? { ...s, role: 'def', x: 0.2, y: 0.9 } : s)) });
    return [a, b, c];
  }
  it('accepts three distinct legal formations', () => expect(checkFormations(three())).toEqual([]));
  it('rejects two formations', () => {
    expect(checkFormations(three().slice(0, 2)).join(' ')).toContain('formation count 2');
  });
  it('rejects a duplicated id', () => {
    const fs = three();
    fs[2] = { ...fs[2], id: fs[0].id, slots: fs[0].slots };
    expect(checkFormations(fs).join(' ')).toContain('duplicate formation id 3-3-2');
  });
  it('propagates a per-formation problem with the offender id', () => {
    const fs = three();
    fs[1] = { ...fs[1], slots: fs[1].slots.slice(0, 6) };
    expect(checkFormations(fs).join(' ')).toContain('3-2-3: slot count 6');
  });
  it('FORMATION_COUNT is the three of the spec', () => expect(FORMATION_COUNT).toBe(3));
});

describe('checkTeam', () => {
  it('accepts a legal team', () => expect(checkTeam(team())).toEqual([]));
  it('rejects an id that is not kebab-case', () => {
    expect(checkTeam(team({ id: 'Espana' })).join(' ')).toContain('bad id');
  });
  it('rejects a lowercase or empty name', () => {
    expect(checkTeam(team({ name: 'España' })).join(' ')).toContain('bad name');
    expect(checkTeam(team({ name: '' })).join(' ')).toContain('bad name');
  });
  it('rejects a kit color that is not #rrggbb', () => {
    expect(checkTeam(team({ kit: { primary: 'red', secondary: '#ffcc00' } })).join(' ')).toContain('bad kit color');
    expect(checkTeam(team({ kit: { primary: '#d40000', secondary: '#fc0' } })).join(' ')).toContain('bad kit color');
  });
  it('rejects a kit whose two colors are equal', () => {
    expect(checkTeam(team({ kit: { primary: '#d40000', secondary: '#d40000' } })).join(' ')).toContain('kit colors equal');
  });
});

describe('checkTeams / checkBank', () => {
  it('accepts a legal bank', () => {
    expect(checkTeams(legalBank())).toEqual([]);
    expect(checkBank(legalBank())).toEqual([]);
  });
  it('rejects a duplicated id', () => {
    const bank = legalBank();
    bank[5] = { ...bank[5], id: bank[2].id };
    expect(checkTeams(bank).join(' ')).toContain('duplicate id team-2');
  });
  it('rejects two teams wearing the same kit', () => {
    const bank = legalBank();
    bank[9] = { ...bank[9], kit: { ...bank[3].kit } };
    expect(checkTeams(bank).join(' ')).toContain('duplicate kit team-9');
  });
  it('propagates a per-team problem with the offender id', () => {
    const bank = legalBank();
    bank[4] = { ...bank[4], name: 'minusculas' };
    expect(checkTeams(bank).join(' ')).toContain('team-4: bad name');
  });
  it('checkBank rejects fifteen teams while checkTeams does not count', () => {
    const bank = legalBank().slice(0, BANK_SIZE - 1);
    expect(checkTeams(bank)).toEqual([]);
    expect(checkBank(bank).join(' ')).toContain('bank size 15');
  });
});

describe('checkGoalkeepersInBox (criterion 9b)', () => {
  it('accepts freshly created players', () => {
    expect(checkGoalkeepersInBox(createPlayers([FORMATIONS[0], FORMATIONS[0]], PITCH), [1, -1], PITCH)).toEqual([]);
  });
  it('rejects a goalkeeper wandering to midfield', () => {
    const ps = createPlayers([FORMATIONS[0], FORMATIONS[0]], PITCH);
    ps[9].x = 900;
    expect(checkGoalkeepersInBox(ps, [1, -1], PITCH).join(' ')).toContain('goalkeeper 9 outside big area');
  });
  it('rejects a goalkeeper inside the WRONG box (its own box moves with attackDir)', () => {
    const ps = createPlayers([FORMATIONS[0], FORMATIONS[0]], PITCH);
    expect(checkGoalkeepersInBox(ps, [-1, 1], PITCH).join(' ')).toContain('goalkeeper 0 outside big area');
  });
});
