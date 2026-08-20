# SPACE INVADERS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement SPACE INVADERS (id `space-invaders`, SHOOTER, green) per `specs/23-space-invaders.md` — endless wave shooter with the classic 11×5 grid, pixel-destructible shields, bonus UFO and procedural Web Audio SFX — integrated into the arcade-vault platform.

**Architecture:** Pure game logic (wave config, formation movement/shooters, shield damage, collisions) lives in testable modules under `components/games/space-invaders-logic/`; the canvas component `components/games/SpaceInvadersGame.tsx` consumes them and follows the repo's single-component game pattern (RAF + delta time, SKINS draw-functions, React.memo). Procedural SFX live in `lib/sfx-space-invaders.ts` (Web Audio, no asset files). Play page follows the Pacman pattern (refs-based HUD, MobileGamepad, session user).

**Tech Stack:** Next.js 16 App Router, TypeScript, canvas 2D, Web Audio API, Supabase (catalog row applied by orchestrator via MCP before Task 4 verification), vitest (already installed — logic tests only).

**Spec:** `specs/23-space-invaders.md` (Approved) — the authoritative source for ALL constants: `WAVE_CONFIG` (10 rows), canvas dims, invader points, bullet/UFO speeds, shield matrix dims, SFX definitions. The old `specs/game-jam/space-invaders/01-*.md` and `02-*.md` are design reference ONLY — where they conflict with spec 23 (victory at level 10, `user_id: null`, no mobile/realtime), spec 23 wins. Executors read spec 23 alongside this plan.

## Global Constraints

- Next.js 16: read `node_modules/next/dist/docs/` before writing Next code (AGENTS.md).
- P1–P7 performance patterns from `specs/12-frogger-performance.md` are mandatory (module-level constants, zero allocations inside the RAF loop, refs for HUD, full cleanup of listeners/RAF/AudioContext).
- UI copy in Spanish; code and identifiers in English; comment density mirrors neighboring games (near zero).
- Do NOT touch Supabase, migrations, other games, `MobileGamepad.tsx`, or run `@mobile-porter`/`@skin-designer` (chained later by the orchestrator, mobile first, skins last).
- Only skin `classic` in the component (SKINS map + `skin` prop with safe fallback, structure identical to `PacmanGame.tsx`); `@skin-designer` adds `retro`/`neon` later.
- The user's `next dev` may hold port 3000 — never kill it, never start another dev server.
- Audio: procedural Web Audio ONLY — no `.mp3`/`.ogg` files, no fetches. `AudioContext` created lazily on first user interaction.
- Endless game: NO victory condition; difficulty clamps at `WAVE_CONFIG[9]` from level 10 onward.
- Commits are made by Paco — tasks end with tests/build green and the working tree verified, never with a `git commit` step.

---

### Task 1: Waves + formation logic module

**Files:**
- Create: `components/games/space-invaders-logic/formation.ts`
- Test: `components/games/space-invaders-logic/formation.test.ts`

**Interfaces:**
- Produces:
  - `const WAVE_CONFIG: readonly (readonly [number, number, number, number])[]` — 10 rows `[stepIntervalMs, enemyFireIntervalMs, ufoMultiplier, blockOffsetY]`, values verbatim from spec 23.
  - `waveFor(level: number): readonly [number, number, number, number]` — clamps `level ≥ 10` to `WAVE_CONFIG[9]`.
  - `type Invader = { col: number; row: number; alive: boolean; type: 0 | 1 | 2; animFrame: 0 | 1 }`
  - `createFormation(): Invader[]` — 55 invaders, 11 cols × 5 rows; row 0 → type 2 (octopus), row 1 → type 1 (squid), rows 2–4 → type 0 (crab).
  - `pointsFor(type: 0 | 1 | 2): number` — 10 / 20 / 30.
  - `stepInterval(level: number, aliveCount: number): number` — `waveFor(level)[0] − (55 − aliveCount) * 15`, floored at 50 ms.
  - `formationBounds(invaders: Invader[], originX: number, originY: number): { left: number; right: number; bottom: number } | null` — pixel bounds of alive invaders (null if none alive), using module constants `INV_W = 36`, `INV_H = 24`, `INV_GAP_X = 16`, `INV_GAP_Y = 14`.
  - `shooterCells(invaders: Invader[]): Invader[]` — for each column, the lowest alive invader (the eligible shooters).

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from 'vitest';
import {
  WAVE_CONFIG, waveFor, createFormation, pointsFor,
  stepInterval, formationBounds, shooterCells,
} from './formation';

describe('waves', () => {
  it('has 10 rows with spec endpoints', () => {
    expect(WAVE_CONFIG).toHaveLength(10);
    expect(WAVE_CONFIG[0]).toEqual([800, 2000, 1, 0]);
    expect(WAVE_CONFIG[9]).toEqual([150, 400, 3, 130]);
  });
  it('clamps beyond level 10', () => {
    expect(waveFor(10)).toEqual(WAVE_CONFIG[9]);
    expect(waveFor(37)).toEqual(WAVE_CONFIG[9]);
    expect(waveFor(1)).toEqual(WAVE_CONFIG[0]);
  });
});

describe('formation', () => {
  it('creates 55 invaders with classic type layout', () => {
    const f = createFormation();
    expect(f).toHaveLength(55);
    expect(f.filter((i) => i.type === 2)).toHaveLength(11); // octopus row 0
    expect(f.filter((i) => i.type === 1)).toHaveLength(11); // squid row 1
    expect(f.filter((i) => i.type === 0)).toHaveLength(33); // crabs rows 2-4
    expect(f.every((i) => i.alive)).toBe(true);
  });
  it('scores 10/20/30 by type', () => {
    expect(pointsFor(0)).toBe(10);
    expect(pointsFor(1)).toBe(20);
    expect(pointsFor(2)).toBe(30);
  });
  it('accelerates 15ms per kill with a 50ms floor', () => {
    expect(stepInterval(1, 55)).toBe(800);
    expect(stepInterval(1, 54)).toBe(785);
    expect(stepInterval(1, 1)).toBe(50); // 800 - 54*15 = -10 → floor
  });
  it('bounds shrink when edge columns die and null when empty', () => {
    const f = createFormation();
    const full = formationBounds(f, 0, 0)!;
    for (const i of f) if (i.col === 0) i.alive = false;
    const trimmed = formationBounds(f, 0, 0)!;
    expect(trimmed.left).toBeGreaterThan(full.left);
    for (const i of f) i.alive = false;
    expect(formationBounds(f, 0, 0)).toBeNull();
  });
  it('shooters are the lowest alive invader per column', () => {
    const f = createFormation();
    let shooters = shooterCells(f);
    expect(shooters).toHaveLength(11);
    expect(shooters.every((i) => i.row === 4)).toBe(true);
    for (const i of f) if (i.col === 3 && i.row === 4) i.alive = false;
    shooters = shooterCells(f);
    expect(shooters.find((i) => i.col === 3)!.row).toBe(3);
  });
});
```

- [ ] **Step 2:** Run `npm test` → expect FAIL (module not found).
- [ ] **Step 3:** Implement `formation.ts` — all constants (`INV_W`, `INV_H`, `INV_GAP_X`, `INV_GAP_Y`, `INV_POINTS`, `STEP_ACCEL_PER_KILL_MS = 15`, `STEP_INTERVAL_FLOOR_MS = 50`) at module level; pure functions, no classes.
- [ ] **Step 4:** Run `npm test` → PASS. `npm run build` still green.

### Task 2: Shields + collision module

**Files:**
- Create: `components/games/space-invaders-logic/shields.ts`
- Test: `components/games/space-invaders-logic/shields.test.ts`

**Interfaces:**
- Consumes: nothing from Task 1 (independent module).
- Produces:
  - `const SHIELD_COLS = 22`, `const SHIELD_ROWS = 16`, `const SHIELD_PX = 3` (logical pixel size in canvas px).
  - `type Shield = { x: number; y: number; pixels: Uint8Array }` — `pixels.length === 22 * 16`, 1 = intact.
  - `createShields(canvasW: number, y: number): Shield[]` — 4 shields evenly spaced, classic arch shape (bottom-center notch carved out, top corners rounded by clearing 2-px triangles).
  - `shieldHitTest(s: Shield, px: number, py: number): number` — index of the intact logical pixel at canvas point, or −1 (bounding-box check first — P-pattern, no per-pixel scan when outside).
  - `damageShield(s: Shield, index: number, radius?: number): void` — clears the hit pixel plus neighbors within `radius` (default 1) for a bite-like crater.
  - `aabb(x1: number, y1: number, w1: number, h1: number, x2: number, y2: number, w2: number, h2: number): boolean` — shared rect overlap helper (bullets vs invaders/cannon/UFO).

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from 'vitest';
import {
  SHIELD_COLS, SHIELD_ROWS, createShields,
  shieldHitTest, damageShield, aabb,
} from './shields';

describe('shields', () => {
  it('creates 4 shields with mostly intact arch-shaped pixels', () => {
    const shields = createShields(600, 560);
    expect(shields).toHaveLength(4);
    for (const s of shields) {
      expect(s.pixels).toHaveLength(SHIELD_COLS * SHIELD_ROWS);
      const intact = s.pixels.reduce((a, b) => a + b, 0);
      expect(intact).toBeGreaterThan(SHIELD_COLS * SHIELD_ROWS * 0.6);
      expect(intact).toBeLessThan(SHIELD_COLS * SHIELD_ROWS); // notch carved
    }
  });
  it('hit test maps canvas points to pixel index and misses outside bbox', () => {
    const [s] = createShields(600, 560);
    expect(shieldHitTest(s, s.x + 1, s.y + 1) >= -1).toBe(true); // corner may be rounded
    const center = shieldHitTest(s, s.x + 33, s.y + 10);
    expect(center).toBeGreaterThanOrEqual(0);
    expect(shieldHitTest(s, s.x - 5, s.y)).toBe(-1);
    expect(shieldHitTest(s, 0, 0)).toBe(-1);
  });
  it('damage clears the pixel and its crater, and hits stop landing there', () => {
    const [s] = createShields(600, 560);
    const idx = shieldHitTest(s, s.x + 33, s.y + 10);
    damageShield(s, idx);
    expect(s.pixels[idx]).toBe(0);
    expect(shieldHitTest(s, s.x + 33, s.y + 10)).toBe(-1);
  });
});

describe('aabb', () => {
  it('detects overlap and separation', () => {
    expect(aabb(0, 0, 10, 10, 5, 5, 10, 10)).toBe(true);
    expect(aabb(0, 0, 10, 10, 20, 0, 5, 5)).toBe(false);
    expect(aabb(0, 0, 10, 10, 10, 0, 5, 5)).toBe(false); // touching edges don't collide
  });
});
```

- [ ] **Step 2:** Run `npm test` → expect FAIL.
- [ ] **Step 3:** Implement `shields.ts`. `createShields` builds one template `Uint8Array` and copies it per shield (no shared reference).
- [ ] **Step 4:** Run `npm test` → PASS. `npm run build` green.

### Task 3: Procedural SFX module

**Files:**
- Create: `lib/sfx-space-invaders.ts`
- Test: `lib/sfx-space-invaders.test.ts`

**Interfaces:**
- Produces:
  - `type SfxName = 'march' | 'shoot' | 'invader_hit' | 'player_hit' | 'ufo' | 'ufo_hit' | 'level_clear' | 'game_over'`
  - `class SpaceInvadersSFX` with `init(): void`, `play(name: SfxName, level?: number): void`, `stop(name: SfxName): void`, `setMuted(muted: boolean): void`, `dispose(): void`.
  - `export const sfxSpaceInvaders: SpaceInvadersSFX` — singleton.
- Sound design: sections 1a–1l of `specs/game-jam/space-invaders/02-space-invaders-sfx.md` verbatim (march = 4-note cycle 110/130/110/87 Hz × `1 + (level−1)*0.05`, square wave; shoot = filtered white-noise burst 30 ms; invader_hit = 400→80 Hz square 120 ms; player_hit = noise + 300→80 Hz sine 600 ms; ufo = 440 Hz sine + 8 Hz LFO, continuous until `stop('ufo')`; ufo_hit = 800→200 Hz 250 ms; level_clear = C4-E4-G4-C5 triangle arpeggio; game_over = 5-note chromatic descent). Master gain 0.4.

- [ ] **Step 1: Write the failing tests** — every method must be a safe no-op before `init()`/without `AudioContext` (vitest has no Web Audio):

```ts
import { describe, expect, it } from 'vitest';
import { SpaceInvadersSFX } from './sfx-space-invaders';

describe('SpaceInvadersSFX without AudioContext', () => {
  it('all methods are safe no-ops before init', () => {
    const sfx = new SpaceInvadersSFX();
    expect(() => {
      sfx.play('march', 3);
      sfx.play('shoot');
      sfx.stop('ufo');
      sfx.setMuted(true);
      sfx.dispose();
    }).not.toThrow();
  });
  it('init without AudioContext global does not throw', () => {
    const sfx = new SpaceInvadersSFX();
    expect(() => sfx.init()).not.toThrow();
  });
});
```

- [ ] **Step 2:** Run `npm test` → expect FAIL.
- [ ] **Step 3:** Implement the class: `init()` guards `typeof AudioContext === 'undefined'`; every `play`/`stop` early-returns when `this.ctx` is null; noise via `AudioBufferSourceNode` with 2048 random samples; `march` keeps a `marchStep` 0–3 cycle; `setMuted` ramps `masterGain` to 0/0.4 with `setTargetAtTime`; `dispose()` stops the UFO node and closes the context. Export both the class (for tests) and the singleton.
- [ ] **Step 4:** Run `npm test` → PASS. `npm run build` green.

### Task 4: SpaceInvadersGame.tsx canvas component

**Files:**
- Create: `components/games/SpaceInvadersGame.tsx`
- Reference (read, do not modify): `components/games/PacmanGame.tsx`, `specs/12-frogger-performance.md`

**Interfaces:**
- Consumes: everything from Tasks 1–3 (`createFormation`, `waveFor`, `stepInterval`, `formationBounds`, `shooterCells`, `pointsFor`, `createShields`, `shieldHitTest`, `damageShield`, `aabb`, `sfxSpaceInvaders`).
- Produces:

```ts
interface SpaceInvadersGameProps {
  paused: boolean;
  muted?: boolean;
  skin?: string; // 'classic' only for now; safe fallback to classic
  onScoreChange: (score: number) => void;
  onLivesChange: (lives: number) => void;
  onLevelChange: (level: number) => void;
  onGameOver: (finalScore: number) => void;
}
export default React.memo(SpaceInvadersGame);
```

Behavior (all constants from spec 23): canvas 600×700; RAF loop with delta accumulator; cannon ←→/A-D + Space (single player bullet in flight, 400 px/s); enemy bullets from `shooterCells` at the level's fire interval (220 px/s); formation steps horizontally at `stepInterval(level, alive)`, edge → one step down + reverse, each step toggles `animFrame` and fires `sfx.play('march', level)`; bullets vs shields (`shieldHitTest`/`damageShield`, bullet stops), vs invaders (`pointsFor`), vs cannon (life lost, 3 lives); UFO every 20–30 s random, 120 px/s, points `[50,100,150,300][rand] * waveFor(level)[2]` shown at hit position ~800 ms; wave cleared → `level + 1`, formation resets at `waveFor(level)[3]` offset, `sfx.play('level_clear')`; endless (no victory); game over on lives 0 or formation bottom reaching cannon row → `onLivesChange(0)` then `onGameOver(score)` + `sfx.play('game_over')`; in-canvas HUD (score TL, session hi-score TC, lives icons BL, level BR); `paused` skips `update()` but keeps `draw()`; `muted` → `sfx.setMuted`; `sfx.init()` on first keydown; cleanup removes listeners, cancels RAF, `sfx.stop('ufo')` + `sfx.dispose()`. SKINS map with `classic` draw functions (pixel-art invaders in green palette, two anim frames), `skin` prop falls back to `classic`.

- [ ] **Step 1:** Read `PacmanGame.tsx` in full and `node_modules/next/dist/docs/` sections relevant to client components; mirror the structural skeleton (refs, module constants, SKINS map, memo export).
- [ ] **Step 2:** Implement the component per the behavior block above. Zero allocations inside the loop: bullets in pre-sized pools (player 1, enemies max 11), reused scratch objects, no array spread/map in `update`/`draw`.
- [ ] **Step 3:** `npm test` (Tasks 1–3 suites still green) and `npm run build` → PASS (component unused yet, must compile).

### Task 5: Play page + platform integration

**Files:**
- Create: `app/games/space-invaders/play/page.tsx`
- Modify: `app/games/[id]/LiveLeaderboard.tsx:7` (add `'space-invaders'` to `REALTIME_GAMES`)
- Reference (read, do not modify): `app/games/pacman/play/page.tsx`

**Interfaces:**
- Consumes: `SpaceInvadersGame` (Task 4 props), `useUser()` from `app/context/UserContext`, `createClient` from `lib/supabase/client`, `MobileGamepad`.
- Produces: route `/games/space-invaders/play` (already login-gated by spec 20 middleware).

- [ ] **Step 1:** Implement the page mirroring the Pacman play page structure: `dynamic(() => import('@/components/games/SpaceInvadersGame'), { ssr: false })`; HUD React via refs (`scoreEl`, `livesEl`, `levelEl` — no state per frame); PAUSA button toggling `paused`; SFX mute button (speaker SVG, state initialized from `localStorage.getItem('av_sfx_muted') === 'true'`, persists on toggle, passed as `muted` prop) — independent from the Nav music mute; `SKIN_OPTIONS = [{ key: 'classic', label: 'Classic' }, { key: 'retro', label: 'Retro' }, { key: 'neon', label: 'Neon' }]` with `localStorage` key `space-invaders-skin` (deliberate last duplication — see spec 23 Decisions); `MobileGamepad` mapped to left/right + FIRE (Space); game-over modal inserting `{ game_id: 'space-invaders', player_name, score, user_id: user.id }` and link back to `/games/space-invaders`. UI copy in Spanish.
- [ ] **Step 2:** Add `'space-invaders'` to `REALTIME_GAMES`.
- [ ] **Step 3:** `npm test` and `npm run build` → PASS. Verify `/games/space-invaders/play` renders (structure + first frame only — hidden Browser pane freezes RAF; gameplay QA is Paco's).

---

## Orchestrator steps (outside executor tasks)

1. **Before Task 4 verification:** apply the `games` INSERT from spec 23 via Supabase MCP; version the migration file with the EXACT server version string.
2. **After Task 5:** chain `@mobile-porter` (fine-tuning) then `@skin-designer` (retro + neon).
3. **Cover:** take a real gameplay screenshot, add the asset, UPDATE the `cover` column to its `/` path.
4. **Gate:** run `verify-plan` against spec 23 before declaring done. Commits and gameplay QA are Paco's.

## Self-Review (done at write time)

- Spec coverage: every spec-23 Scope item maps to Tasks 1–5 or an orchestrator step; endless clamp (T1), shields (T2), 8 SFX (T3), gameplay/HUD/pause (T4), page/realtime/mute/credits-by-side-effect (T5). Credits need no code — spec 22 counts distinct games from `scores`.
- Placeholders: none; all test code inline, constants either verbatim or referenced to spec 23 by name.
- Type consistency: `Invader`/`Shield` shapes, `waveFor` tuple, `SfxName`, and `SpaceInvadersGameProps` are used with identical names across tasks.
