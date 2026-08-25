# KARATE CHAMP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement KARATE CHAMP (id `karate-champ`, FIGHTING, gold) per `specs/25-karate-champ.md` — point-based fighting vs an endless CPU ladder, 8 direction+button techniques, board-break bonus every 3 opponents — born on the central registry (spec 24: locks, instructions, saveScore, realtime).

**Architecture:** Pure logic in `components/games/karate-logic/` (`techniques.ts`, `scoring.ts`, `ai.ts`, `bonus.ts`) with vitest suites; canvas component `components/games/KarateChampGame.tsx` (static poses pre-baked per skin, RAF + delta, SKINS classic-only); play-page mirrors the spec-24 pattern exactly (useGameSkin, getKeyMap, saveScore, "?" overlay, SFX mute); one new registry entry feeds skins/controls/instructions/realtime.

**Tech Stack:** Next.js 16 App Router, TypeScript, canvas 2D, Web Audio (procedural SFX), Supabase (row applied by orchestrator via MCP), vitest (58 tests today).

**Spec:** `specs/25-karate-champ.md` (Approved) — authority for ALL constants: techniques table (8 rows: input/points/height/notes), `OPPONENT_CONFIG` (10 rows verbatim), score values (500/1000/2000/timeBonus), bonus boards (1000/2000/4000), instructions text, INSERT SQL. Executors read the spec alongside their brief; constants named here are defined there verbatim.

## Global Constraints

- Combat is POINT-based (no health bars): first to 2 points or leader at 30 s; tie → golden point (next clean technique wins).
- One lost match = game over (`onLivesChange(0)` then `onGameOver(score)`).
- Mobile reachability is a hard constraint: every technique must be dir+A or dir+B (dpad + 2 buttons). Keyboard: ←→/A-D move, ↑↓/W-S modifiers, J = kick (A), K = punch (B), Space alias of J.
- P1–P7 performance patterns (spec 12): module constants, zero allocations in the RAF loop, pre-baked pose sprites (Space Invaders pattern), refs for HUD, full cleanup.
- Registry is the single source: no local SKIN_OPTIONS/keyMap/insert in the play-page — `useGameSkin('karate-champ')`, `getKeyMap('karate-champ')`, `saveScore` from `useUser()`.
- Do NOT touch other games, other registry entries beyond adding `karate-champ` + updating registry-test asserts, MobileGamepad, hook, credits, instructions routes.
- Do NOT run `@mobile-porter`/`@skin-designer` (orchestrator chains them). Only skin `classic` in the SKINS map (pure-addition structure for retro/neon).
- UI copy Spanish; identifiers English; near-zero comments. Never run a dev server (:3000 is the user's). `npm test` then `npm run build`, sequential.
- Commits are Paco's — no `git commit` steps; tasks end with tests/build green.
- Audio: procedural only (`lib/sfx-karate-champ.ts`), AudioContext deferred to first interaction, safe no-ops without it.

---

### Task 1: `techniques.ts` + `scoring.ts` — combat core

**Files:**
- Create: `components/games/karate-logic/techniques.ts`, `components/games/karate-logic/scoring.ts`
- Test: `components/games/karate-logic/techniques.test.ts`, `components/games/karate-logic/scoring.test.ts`
- Reference: `specs/25-karate-champ.md` "Tabla de técnicas" (verbatim: ids kebab-case from names, points, heights; startupMs/recoveryMs/range: pick values honoring the spec's fast/slow/short/long notes and document them as module constants).

**Interfaces:**
- Produces:
  - `type Dir = 'neutral' | 'up' | 'down' | 'forward'`
  - `type TechButton = 'a' | 'b'`
  - `type Height = 'high' | 'mid' | 'low'`
  - `type Technique = { id: string; input: { dir: Dir; button: TechButton }; name: string; points: 0.5 | 1; range: number; startupMs: number; recoveryMs: number; height: Height }`
  - `const TECHNIQUES: Technique[]` — exactly 8, per the spec table.
  - `resolveTechnique(dir: Dir, button: TechButton): Technique` — total function over the 8 combos.
  - `type FighterState = { x: number; facing: 1 | -1; blockingHeight: Height | null; busyUntilMs: number }`
  - `landsHit(attacker: FighterState, defender: FighterState, t: Technique, nowMs: number): boolean` — distance ≤ t.range AND defender.blockingHeight !== t.height AND attacker not busy.
  - `scoring.ts`: `SCORE_PER_POINT = { half: 500, full: 1000 }`, `OPPONENT_BONUS = 2000`, `timeBonus(remainingMs): number` (100 per remaining second, floored), `type MatchState = { playerPoints: number; cpuPoints: number; roundMs: number; goldenPoint: boolean }`, `applyPoint(state, who: 'player' | 'cpu', points: 0.5 | 1): MatchState`, `matchWinner(state): 'player' | 'cpu' | null` — 2 points wins; at roundMs ≥ 30000 the leader wins, tie → `goldenPoint: true` and next point wins regardless of value.

- [ ] **Step 1: Write the failing tests**

```ts
// techniques.test.ts
import { describe, expect, it } from 'vitest';
import { TECHNIQUES, resolveTechnique, landsHit } from './techniques';

describe('techniques table', () => {
  it('has exactly 8 techniques, one per dir+button combo', () => {
    expect(TECHNIQUES).toHaveLength(8);
    const combos = new Set(TECHNIQUES.map((t) => `${t.input.dir}+${t.input.button}`));
    expect(combos.size).toBe(8);
  });
  it('full-point techniques are slower than their half-point siblings', () => {
    const full = TECHNIQUES.filter((t) => t.points === 1);
    const half = TECHNIQUES.filter((t) => t.points === 0.5);
    expect(full).toHaveLength(4);
    const minFull = Math.min(...full.map((t) => t.startupMs));
    const maxHalf = Math.max(...half.map((t) => t.startupMs));
    expect(minFull).toBeGreaterThan(maxHalf);
  });
  it('resolves every combo', () => {
    expect(resolveTechnique('up', 'a').name).toBe('Patada alta');
    expect(resolveTechnique('neutral', 'b').points).toBe(0.5);
  });
});

describe('landsHit', () => {
  const t = resolveTechnique('neutral', 'b'); // corto alcance
  const attacker = { x: 100, facing: 1 as const, blockingHeight: null, busyUntilMs: 0 };
  it('requires range', () => {
    const far = { x: 100 + t.range + 50, facing: -1 as const, blockingHeight: null, busyUntilMs: 0 };
    expect(landsHit(attacker, far, t, 0)).toBe(false);
    const near = { ...far, x: 100 + t.range - 5 };
    expect(landsHit(attacker, near, t, 0)).toBe(true);
  });
  it('is blocked by matching height only', () => {
    const near = { x: 100 + t.range - 5, facing: -1 as const, blockingHeight: t.height, busyUntilMs: 0 };
    expect(landsHit(attacker, near, t, 0)).toBe(false);
    expect(landsHit(attacker, { ...near, blockingHeight: t.height === 'high' ? 'low' : 'high' }, t, 0)).toBe(true);
  });
  it('attacker in recovery cannot hit', () => {
    const near = { x: 100 + t.range - 5, facing: -1 as const, blockingHeight: null, busyUntilMs: 0 };
    expect(landsHit({ ...attacker, busyUntilMs: 500 }, near, t, 100)).toBe(false);
  });
});
```

```ts
// scoring.test.ts
import { describe, expect, it } from 'vitest';
import { SCORE_PER_POINT, OPPONENT_BONUS, timeBonus, applyPoint, matchWinner } from './scoring';

describe('scoring', () => {
  it('score constants per spec', () => {
    expect(SCORE_PER_POINT).toEqual({ half: 500, full: 1000 });
    expect(OPPONENT_BONUS).toBe(2000);
    expect(timeBonus(12_400)).toBe(1200);
  });
  const base = { playerPoints: 0, cpuPoints: 0, roundMs: 0, goldenPoint: false };
  it('wins at 2 points', () => {
    let s = applyPoint(base, 'player', 1);
    expect(matchWinner(s)).toBeNull();
    s = applyPoint(s, 'player', 1);
    expect(matchWinner(s)).toBe('player');
  });
  it('half points accumulate', () => {
    let s = applyPoint(base, 'cpu', 0.5);
    s = applyPoint(s, 'cpu', 0.5);
    s = applyPoint(s, 'cpu', 0.5);
    s = applyPoint(s, 'cpu', 0.5);
    expect(matchWinner(s)).toBe('cpu');
  });
  it('leader wins at 30s; tie goes to golden point where any point decides', () => {
    const lead = { ...base, playerPoints: 1, cpuPoints: 0.5, roundMs: 30_000 };
    expect(matchWinner(lead)).toBe('player');
    const tie = { ...base, playerPoints: 1, cpuPoints: 1, roundMs: 30_000 };
    expect(matchWinner(tie)).toBeNull();
    const golden = applyPoint({ ...tie, goldenPoint: true }, 'cpu', 0.5);
    expect(matchWinner(golden)).toBe('cpu');
  });
});
```

- [ ] **Step 2:** `npm test` → FAIL (modules not found).
- [ ] **Step 3:** Implement both modules; `matchWinner` sets/reads `goldenPoint` per the test semantics (a tie at 30 s yields null + the caller flips `goldenPoint` via `applyPoint`'s state; make `applyPoint` mark a winner-deciding flag `lastPointBy` if needed — keep the public shape exactly as tested).
- [ ] **Step 4:** `npm test` → PASS; `npm run build` green.

### Task 2: `ai.ts` + `bonus.ts`

**Files:**
- Create: `components/games/karate-logic/ai.ts`, `components/games/karate-logic/bonus.ts`
- Test: `components/games/karate-logic/ai.test.ts`, `components/games/karate-logic/bonus.test.ts`
- Reference: spec 25 `OPPONENT_CONFIG` (10 rows verbatim) and bonus rules.

**Interfaces:**
- Consumes: `Technique`, `Dir`, `TechButton`, `Height` from Task 1.
- Produces:
  - `const OPPONENT_CONFIG: readonly (readonly [number, number, number, number])[]` — 10 rows `[reactionMs, aggression, blockChance, fullPointBias]` verbatim from spec.
  - `opponentFor(level: number)` — clamps 10+.
  - `type AiAction = { move: 'approach' | 'retreat' | 'idle'; block: Height | null; attack: { dir: Dir; button: TechButton } | null }`
  - `decide(level: number, ctx: { distance: number; playerAttacking: boolean; playerAttackHeight: Height | null; cpuBusy: boolean }, rng: () => number): AiAction` — pure; blockChance gates blocking the incoming height; aggression gates attacking when in range; fullPointBias picks a 1-point technique; never attacks while `cpuBusy`.
  - `bonus.ts`: `const BOARD_SCORES = [1000, 2000, 4000]`, `barPhase(elapsedMs, boardIndex): number` (0..1 oscillating, period shrinks per board: 1200/900/650 ms), `const GREEN_ZONE: [number, number] = [0.4, 0.6]`, `hitQuality(phase): 'hit' | 'miss'`.

- [ ] **Step 1: Write the failing tests**

```ts
// ai.test.ts
import { describe, expect, it } from 'vitest';
import { OPPONENT_CONFIG, opponentFor, decide } from './ai';

const always = () => 0; // rng below every threshold
const never = () => 0.999;

describe('opponent config', () => {
  it('has 10 rows with spec endpoints and clamps', () => {
    expect(OPPONENT_CONFIG).toHaveLength(10);
    expect(OPPONENT_CONFIG[0]).toEqual([600, 0.3, 0.2, 0.2]);
    expect(OPPONENT_CONFIG[9]).toEqual([180, 0.8, 0.65, 0.5]);
    expect(opponentFor(37)).toEqual(OPPONENT_CONFIG[9]);
  });
});

describe('decide', () => {
  it('blocks the incoming height when rng passes blockChance', () => {
    const a = decide(10, { distance: 40, playerAttacking: true, playerAttackHeight: 'high', cpuBusy: false }, always);
    expect(a.block).toBe('high');
    const b = decide(1, { distance: 40, playerAttacking: true, playerAttackHeight: 'high', cpuBusy: false }, never);
    expect(b.block).toBeNull();
  });
  it('attacks in range when rng passes aggression, never while busy', () => {
    const atk = decide(10, { distance: 40, playerAttacking: false, playerAttackHeight: null, cpuBusy: false }, always);
    expect(atk.attack).not.toBeNull();
    const busy = decide(10, { distance: 40, playerAttacking: false, playerAttackHeight: null, cpuBusy: true }, always);
    expect(busy.attack).toBeNull();
  });
  it('approaches when far', () => {
    const a = decide(1, { distance: 400, playerAttacking: false, playerAttackHeight: null, cpuBusy: false }, never);
    expect(a.move).toBe('approach');
  });
});
```

```ts
// bonus.test.ts
import { describe, expect, it } from 'vitest';
import { BOARD_SCORES, barPhase, GREEN_ZONE, hitQuality } from './bonus';

describe('bonus boards', () => {
  it('scores 1000/2000/4000', () => {
    expect(BOARD_SCORES).toEqual([1000, 2000, 4000]);
  });
  it('bar oscillates 0..1 and speeds up per board', () => {
    expect(barPhase(0, 0)).toBeCloseTo(0);
    expect(barPhase(600, 0)).toBeCloseTo(1); // half of 1200ms period reaches the top
    expect(barPhase(1200, 0)).toBeCloseTo(0); // full period returns
    expect(barPhase(325, 2)).toBeCloseTo(1); // 650ms period board 3
  });
  it('hit inside the green zone only', () => {
    expect(hitQuality((GREEN_ZONE[0] + GREEN_ZONE[1]) / 2)).toBe('hit');
    expect(hitQuality(GREEN_ZONE[0] - 0.05)).toBe('miss');
    expect(hitQuality(GREEN_ZONE[1] + 0.05)).toBe('miss');
  });
});
```

- [ ] **Step 2:** `npm test` → FAIL. **Step 3:** implement (triangle-wave `barPhase`). **Step 4:** `npm test` → PASS; build green.

### Task 3: Registry entry + types + cover CSS

**Files:**
- Modify: `lib/games-registry.ts` (add `karate-champ` to `GameId` + `GAMES`), `lib/games-registry.test.ts` (asserts: 10 ids include `karate-champ`; realtime set gains it; its skins classic/retro/neon; its keyMap `{up:'ArrowUp',down:'ArrowDown',left:'ArrowLeft',right:'ArrowRight',a:'j',b:'k'}` with labels `a:'PATADA'`, `b:'PUÑO'`), `lib/supabase/types.ts` (`cat` union + `'FIGHTING'`; `color` union + `'gold'`), `app/globals.css` (`.cover-karate-champ` + `::after`, gold/red karate motif following sibling `.cover-*` pattern).

**Interfaces:**
- Registry entry content verbatim from spec 25: instructions goal + 4 tips; keyboard controls rows — normal: ←→/A-D "Moverse / esquivar", ↑↓/W-S "Modificador de técnica"; special: J/Espacio "Patada (combinar con dirección)", K "Puño (combinar con dirección)"; realtime `true`.

- [ ] **Step 1:** Update `games-registry.test.ts` first (10 ids, keyMap, skins, realtime) → `npm test` FAIL.
- [ ] **Step 2:** Add the entry + types unions + CSS class. `npm test` PASS; `npm run build` green.

### Task 4: `lib/sfx-karate-champ.ts`

**Files:**
- Create: `lib/sfx-karate-champ.ts`
- Test: `lib/sfx-karate-champ.test.ts`
- Reference: `lib/sfx-space-invaders.ts` (mirror the class pattern: init/play/stop/setMuted/dispose, master gain 0.4, deferred AudioContext, safe no-ops).

**Interfaces:**
- `type KarateSfx = 'whoosh' | 'hit' | 'block' | 'half_point' | 'full_point' | 'gong' | 'board_break' | 'board_miss' | 'game_over'`
- `class KarateChampSFX` + singleton `sfxKarateChamp`. Sound design (procedural): whoosh = bandpass noise sweep 80 ms; hit = 200→60 Hz square 100 ms + noise tick; block = short 800 Hz triangle 50 ms; half_point = two ascending notes; full_point = four-note fanfare; gong = 110 Hz sine with long 1.2 s decay + detuned partial; board_break = noise burst + 150→50 Hz drop; board_miss = descending two notes; game_over = 5-note chromatic descent (reuse the SI recipe).

- [ ] **Step 1:** Test verbatim pattern from `lib/sfx-space-invaders.test.ts` (safe no-ops pre-init, init without AudioContext global doesn't throw) adapted to the class name → FAIL → implement → PASS; build green.

### Task 5: `KarateChampGame.tsx`

**Files:**
- Create: `components/games/KarateChampGame.tsx`
- Reference (read, do not modify): `components/games/SpaceInvadersGame.tsx` (structural authority: module constants, SKINS map + baked sprites, refs, RAF + delta clamp 50 ms, memo export, cleanup), all four karate-logic modules, `lib/sfx-karate-champ.ts`.

**Interfaces:**
- Props: `{ paused: boolean; muted?: boolean; skinKey?: string; onScoreChange; onLivesChange; onLevelChange; onGameOver }` — `React.memo` default export.
- Behavior (constants from spec 25): canvas 800×500; two fighters (player white gi left, CPU red gi right) drawn from pre-baked pose sprites (idle, walk ×2, block high/mid/low, one pose per technique, hit-stun) per skin; keyboard: ArrowLeft/ArrowRight + A/D move, ArrowUp/ArrowDown + W/S held as dir modifier, J/Space = A-button, K = B-button; on button press → `resolveTechnique(heldDir, button)` → attacker enters startup/active/recovery timeline; on active frame → `landsHit` → `applyPoint` + score += `SCORE_PER_POINT` + referee banner ("¡MEDIO PUNTO!"/"¡PUNTO!") + `sfx.play('half_point'|'full_point')`; fighters reset to corners after each point; CPU driven by `decide(level, ctx, rng)` every `reactionMs`; round timer 30 s (HUD) → `matchWinner` (golden point banner "PUNTO DE ORO"); match win → `OPPONENT_BONUS` + `timeBonus` + `onLevelChange(level+1)` + gong; every 3rd win → bonus phase (barPhase bar, A to strike, 3 boards, BOARD_SCORES, `board_break`/`board_miss`); match loss → `onLivesChange(0)`, `onGameOver(score)`, `game_over` sfx; HUD in-canvas: score TL, match points as flags TC, timer under it, rival level BR; `paused` skips update keeps draw; `muted` → setMuted; `init()` on first keydown; full cleanup (listeners, RAF, dispose).
- Zero allocations per frame: fighters/timers as scratch state, banner strings from a fixed table, no array methods in the loop.

- [ ] **Step 1:** Read SpaceInvadersGame.tsx fully + relevant Next client-component docs; mirror the skeleton.
- [ ] **Step 2:** Implement per the behavior block. Poses are simple 2-color pixel figures baked per skin at load (classic palette; SKINS structured so retro/neon are pure additions).
- [ ] **Step 3:** `npm test` green (logic suites untouched); `npm run build` green (component compiles unused).

### Task 6: Play-page

**Files:**
- Create: `app/games/karate-champ/play/page.tsx`
- Reference (read, do not modify): `app/games/space-invaders/play/page.tsx` — mirror EXACTLY (refs HUD, PAUSA, SFX mute button `av_sfx_muted`, `useGameSkin('karate-champ')`, `getKeyMap`, saveScore, "?" + InstructionsContent overlay via `getGame('karate-champ')!`, `paused={paused || over || helpOpen}`, MobileGamepad with `skinOptions`/`onSkinChange`/`onHelp`, game-over modal, `dynamic(ssr:false)`, CRT wrapper `aspectRatio: '8 / 5'`).

- [ ] **Step 1:** Implement the page (labels: "KARATE CHAMP · CRT-80"; lives display: single "COMBATE" indicator since one loss ends the run — mirror road-fighter's single-life display if present, else a simple ● ).
- [ ] **Step 2:** `npm test` green; `npm run build` green; route in manifest; grep: no local SKIN_OPTIONS/keyMap/insert.

---

## Orchestrator steps (outside executor tasks)

1. Before Task 6 verification: apply the `games` INSERT from spec 25 via Supabase MCP; version the migration file with the EXACT server version. (Types union from Task 3 must land first.)
2. After Task 6: chain `@mobile-porter` (verify pattern) then `@skin-designer` (retro + neon on the SKINS map).
3. Cover: real gameplay capture → `public/covers/karate-champ.png` + UPDATE migration.
4. Final whole-change review (most capable model) + `verify-plan` against spec 25. Gameplay QA is Paco's (hidden pane freezes RAF).

## Self-Review (done at write time)

- Spec coverage: techniques/scoring (T1), AI/bonus (T2), registry+types+cover CSS (T3), SFX (T4), canvas (T5), page (T6), migration/chain/cover/gate (orchestrator). Credits X/10 needs no code (catalogSize from DB).
- Placeholders: none — test code inline for T1/T2/T4-pattern; T5/T6 carry exact behavior/props.
- Type consistency: `Dir`/`TechButton`/`Height`/`Technique` defined in T1 and imported by T2/T5; `AiAction` shape used in T5's CPU driver; keyMap `a:'j'/b:'k'` consistent between T3 registry and T5 key handling (J/K listeners + Space alias).
