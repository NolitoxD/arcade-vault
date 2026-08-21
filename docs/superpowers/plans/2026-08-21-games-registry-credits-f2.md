# Games Registry + Credits F2 + Instructions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 9 duplicated `SKIN_OPTIONS`/`keyMap`/`getSavedSkin`/score-insert blocks with a typed central games registry, implement credits phase 2 (fixed 3/6/9 thresholds, locked skins, rank badges, unlock toast) and add per-game instructions via Next 16 parallel + intercepting routes — per `specs/24-games-registry-credits-f2.md`.

**Architecture:** Pure data/logic in `lib/` (`games-registry.ts`, `credits.ts`, `scores.ts`) with vitest tests; a `useGameSkin` hook and an extended `UserContext` (credits, `refreshCredits`, `saveScore`, `lastUnlock`) feed the UI; `MobileGamepad` and the 9 play-pages consume the registry; `RankBadge`/`CreditsToast`/`InstructionsContent` are shared components; instructions routes live under `app/games/[id]/` with a `@modal` slot.

**Tech Stack:** Next.js 16 App Router (parallel/intercepting routes), React 19, TypeScript, Supabase client, vitest (46 tests today).

**Spec:** `specs/24-games-registry-credits-f2.md` (Approved, grill 2026-08-21) — authority for thresholds, tiers, texts, routes. Context report: `.superpowers/sdd/2026-08-21-games-registry-credits-f2/context-punto1.md` (file:line facts about the 9 pages, keymaps, credits F1).

## Global Constraints

- Next.js 16: read `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/{parallel-routes,intercepting-routes,default}.md` before writing route code (AGENTS.md). APIs may differ from training data.
- Thresholds FIXED: `retro 3`, `neon 6`, `extra 9`; MAESTRO DEL VAULT = credits === catalogSize; INVITADO = no session; NOVATO < 3; JUGADOR ≥ 3; VETERANO ≥ 6.
- Lock is cosmetic only: never affects gameplay or scores. A saved locked skin resolves to the game's `base` skin silently.
- Keep each page's `localStorage` key `<id>-skin` and its current default (tetris default `retro`). No behavior change for unlocked users.
- Do NOT touch any `components/games/*.tsx` canvas except the `skin→skinKey` rename in `SpaceInvadersGame.tsx` (Task 6). Do NOT change skin drawings.
- UI copy Spanish; identifiers English; near-zero comments.
- Never run a dev server (the user's `next dev` owns :3000). `npm test` then `npm run build`, sequential.
- Commits are Paco's — tasks end with tests/build green and a verified working tree; no `git commit` steps.
- Ruling (plan): `saveScore` is exposed by `UserContext` (only place that can refresh credits) on top of a pure `insertScore(client, input)` in `lib/scores.ts`. Pages call `const { saveScore } = useUser()`.

---

### Task 1: `lib/credits.ts` — thresholds, rank, stars, unlock, resolve

**Files:**
- Create: `lib/credits.ts`
- Test: `lib/credits.test.ts`

**Interfaces:**
- Produces:
  - `type SkinTier = 'base' | 'retro' | 'neon' | 'extra'`
  - `type Rank = 'INVITADO' | 'NOVATO' | 'JUGADOR' | 'VETERANO' | 'MAESTRO DEL VAULT'`
  - `const THRESHOLDS: Record<Exclude<SkinTier,'base'>, number> = { retro: 3, neon: 6, extra: 9 }`
  - `requiredCredits(tier: SkinTier): number` — 0 for base.
  - `isUnlocked(tier: SkinTier, credits: number | null): boolean` — null credits (no session) → only base.
  - `getRank(credits: number | null, catalogSize: number): Rank`
  - `getStars(credits: number | null): string` — `'☆☆☆'`…`'★★★'` one star per threshold reached (3/6/9).
  - `resolveSkin(skins: { key: string; tier: SkinTier }[], savedKey: string | null, credits: number | null): string` — saved key if it exists and is unlocked, else the `base` key.
  - `crossedTiers(before: number | null, after: number | null): SkinTier[]` — tiers whose threshold is > before and ≤ after (for the toast).

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from 'vitest';
import {
  THRESHOLDS, requiredCredits, isUnlocked, getRank, getStars,
  resolveSkin, crossedTiers,
} from './credits';

describe('thresholds', () => {
  it('are fixed 3/6/9', () => {
    expect(THRESHOLDS).toEqual({ retro: 3, neon: 6, extra: 9 });
    expect(requiredCredits('base')).toBe(0);
    expect(requiredCredits('neon')).toBe(6);
  });
  it('unlocks at the boundary and never below', () => {
    expect(isUnlocked('base', null)).toBe(true);
    expect(isUnlocked('retro', null)).toBe(false);
    expect(isUnlocked('retro', 2)).toBe(false);
    expect(isUnlocked('retro', 3)).toBe(true);
    expect(isUnlocked('neon', 5)).toBe(false);
    expect(isUnlocked('neon', 6)).toBe(true);
    expect(isUnlocked('extra', 8)).toBe(false);
    expect(isUnlocked('extra', 9)).toBe(true);
  });
});

describe('rank and stars', () => {
  it('maps credits to ranks with MAESTRO = full catalog', () => {
    expect(getRank(null, 9)).toBe('INVITADO');
    expect(getRank(0, 9)).toBe('NOVATO');
    expect(getRank(2, 9)).toBe('NOVATO');
    expect(getRank(3, 9)).toBe('JUGADOR');
    expect(getRank(6, 9)).toBe('VETERANO');
    expect(getRank(8, 9)).toBe('VETERANO');
    expect(getRank(9, 9)).toBe('MAESTRO DEL VAULT');
    expect(getRank(13, 13)).toBe('MAESTRO DEL VAULT');
  });
  it('renders one star per threshold reached', () => {
    expect(getStars(null)).toBe('☆☆☆');
    expect(getStars(2)).toBe('☆☆☆');
    expect(getStars(3)).toBe('★☆☆');
    expect(getStars(6)).toBe('★★☆');
    expect(getStars(9)).toBe('★★★');
  });
});

describe('resolveSkin and crossedTiers', () => {
  const skins = [
    { key: 'classic', tier: 'base' as const },
    { key: 'retro', tier: 'retro' as const },
    { key: 'neon', tier: 'neon' as const },
  ];
  it('falls back to base when saved skin is locked or unknown', () => {
    expect(resolveSkin(skins, 'neon', 2)).toBe('classic');
    expect(resolveSkin(skins, 'neon', 6)).toBe('neon');
    expect(resolveSkin(skins, 'bogus', 9)).toBe('classic');
    expect(resolveSkin(skins, null, null)).toBe('classic');
  });
  it('lists tiers crossed between two credit counts', () => {
    expect(crossedTiers(2, 3)).toEqual(['retro']);
    expect(crossedTiers(2, 9)).toEqual(['retro', 'neon', 'extra']);
    expect(crossedTiers(3, 3)).toEqual([]);
    expect(crossedTiers(null, 3)).toEqual(['retro']);
  });
});
```

- [ ] **Step 2:** `npm test` → FAIL (module not found).
- [ ] **Step 3:** Implement `lib/credits.ts` as pure functions over `THRESHOLDS`; `getStars` counts `[3,6,9].filter(t => credits >= t)`.
- [ ] **Step 4:** `npm test` → PASS (46 + new). `npm run build` green.

### Task 2: `lib/games-registry.ts` — the 9 entries + `lib/scores.ts`

**Files:**
- Create: `lib/games-registry.ts`, `lib/scores.ts`
- Test: `lib/games-registry.test.ts`
- Modify: `lib/supabase/types.ts` (`GameRow.color` union add `'blue' | 'red'`)
- Reference (read only): `.superpowers/sdd/2026-08-21-games-registry-credits-f2/context-punto1.md` section "Controles por juego", `components/MobileGamepad.tsx:9-17` (`KeyMap` type), `specs/24-games-registry-credits-f2.md` "Textos de instrucciones" + "Skins por juego".

**Interfaces:**
- Consumes: `SkinTier` from Task 1; `KeyMap` type from `components/MobileGamepad.tsx` (import type only).
- Produces:
  - `type GameId = 'asteroids' | 'tetris' | 'arkanoid' | 'snake' | 'frogger' | 'pong' | 'road-fighter' | 'pacman' | 'space-invaders'`
  - `type SkinDef = { key: string; label: string; tier: SkinTier }`
  - `type KeyboardControl = { keys: string[]; action: string; special?: boolean }`
  - `type TouchControls = { keyMap: KeyMap; a?: string; b?: string }`
  - `type GameMeta = { id: GameId; skins: SkinDef[]; controls: { keyboard: KeyboardControl[]; touch: TouchControls }; instructions: { goal: string; tips: string[] }; realtime: boolean }`
  - `const GAMES: Record<GameId, GameMeta>`, `const GAME_IDS: GameId[]`, `getGame(id: string): GameMeta | undefined`, `getSkinOptions(id: GameId): SkinDef[]`, `getKeyMap(id: GameId): KeyMap`, `isGameId(id: string): id is GameId`.
  - `lib/scores.ts`: `insertScore(client: SupabaseClient, input: { gameId: GameId; playerName: string; score: number; userId: string | null }): Promise<{ error: string | null }>` — inserts `{ game_id, player_name, score, user_id }`.
- Registry content (verbatim from spec/context): skins — 8 games `classic(base)/retro/neon`, tetris `retro(base)/neon/pastel(extra)/pixel(extra)` with labels as today's pages; keyMaps — arkanoid `{left:'ArrowLeft',right:'ArrowRight'}` (NO `a`), asteroids `{up:'ArrowUp',left:'ArrowLeft',right:'ArrowRight',a:' '}` (NO `b`), frogger `{up:'w',down:'s',left:'a',right:'d'}`, pacman/road-fighter `{up:'ArrowUp',down:'ArrowDown',left:'ArrowLeft',right:'ArrowRight'}`, pong `{up:'ArrowUp',down:'ArrowDown'}`, snake `{up:'w',down:'s',left:'a',right:'d'}`, space-invaders `{left:'ArrowLeft',right:'ArrowRight',a:' '}`, tetris `{up:'ArrowUp',down:'ArrowDown',left:'ArrowLeft',right:'ArrowRight',a:'ArrowUp',b:' '}` (B = hard drop); touch labels `a`/`b` in Spanish ("DISPARAR", "ROTAR", "CAÍDA RÁPIDA"…); keyboard controls list normal + `special: true` rows (Asteroids fire Space, Tetris rotate ↑/X + hard drop Space, Road Fighter ↑ turbo ↓ freno, Space Invaders fire Space, Pong versus w/s vs ↑↓); `realtime: true` for pong, road-fighter, pacman, space-invaders; instructions copied from spec 24 texts.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from 'vitest';
import { GAMES, GAME_IDS, getGame, getKeyMap, getSkinOptions, isGameId } from './games-registry';

const KEYMAP_SLOTS = ['up', 'down', 'left', 'right', 'a', 'b'];

describe('games registry', () => {
  it('has exactly the 9 implemented games', () => {
    expect(GAME_IDS.sort()).toEqual([
      'arkanoid', 'asteroids', 'frogger', 'pacman', 'pong',
      'road-fighter', 'snake', 'space-invaders', 'tetris',
    ]);
    expect(isGameId('pacman')).toBe(true);
    expect(isGameId('galaga')).toBe(false);
    expect(getGame('galaga')).toBeUndefined();
  });
  it('every game has exactly one base skin and non-empty instructions', () => {
    for (const id of GAME_IDS) {
      const g = GAMES[id];
      expect(g.skins.filter((s) => s.tier === 'base')).toHaveLength(1);
      expect(g.instructions.goal.length).toBeGreaterThan(20);
      expect(g.instructions.tips.length).toBeGreaterThan(0);
      expect(g.controls.keyboard.length).toBeGreaterThan(0);
    }
  });
  it('keymaps only use valid slots and touch labels exist for a/b', () => {
    for (const id of GAME_IDS) {
      const { keyMap, a, b } = GAMES[id].controls.touch;
      for (const slot of Object.keys(keyMap)) expect(KEYMAP_SLOTS).toContain(slot);
      if (keyMap.a) expect(a).toBeTruthy();
      if (keyMap.b) expect(b).toBeTruthy();
      expect(getKeyMap(id)).toBe(keyMap);
    }
  });
  it('fixes the dead gamepad buttons', () => {
    expect(GAMES.arkanoid.controls.touch.keyMap.a).toBeUndefined();
    expect(GAMES.asteroids.controls.touch.keyMap.b).toBeUndefined();
    expect(GAMES.tetris.controls.touch.keyMap.b).toBe(' ');
  });
  it('tetris keeps its 4 skins with retro as base; others are classic/retro/neon', () => {
    expect(getSkinOptions('tetris').map((s) => `${s.key}:${s.tier}`)).toEqual([
      'retro:base', 'neon:neon', 'pastel:extra', 'pixel:extra',
    ]);
    expect(getSkinOptions('pacman').map((s) => `${s.key}:${s.tier}`)).toEqual([
      'classic:base', 'retro:retro', 'neon:neon',
    ]);
  });
  it('flags the realtime games', () => {
    expect(GAME_IDS.filter((id) => GAMES[id].realtime).sort()).toEqual([
      'pacman', 'pong', 'road-fighter', 'space-invaders',
    ]);
  });
});
```

- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** Implement registry + `lib/scores.ts` + the `types.ts` color union.
- [ ] **Step 4:** `npm test` → PASS; `npm run build` green.

### Task 3: Credits UI — `UserContext` extension, `RankBadge`, `CreditsToast`, `Nav`

**Files:**
- Modify: `app/context/UserContext.tsx`, `components/Nav.tsx`, `app/layout.tsx`
- Create: `components/RankBadge.tsx`, `components/CreditsToast.tsx`
- Reference: `lib/credits.ts` (T1), `lib/scores.ts` (T2), approved badge designs (below).

**Interfaces:**
- Consumes: `getRank`, `getStars`, `crossedTiers`, `Rank`, `SkinTier` (T1); `insertScore`, `GameId` (T2).
- Produces (UserContext value additions): `credits: number | null` (= gamesPlayed), `catalogSize: number`, `rank: Rank`, `refreshCredits(): Promise<void>`, `saveScore(input: { gameId: GameId; playerName: string; score: number }): Promise<{ error: string | null }>` (insertScore with current user id, then refreshCredits, then detect transition), `lastUnlock: { tiers: SkinTier[]; rank?: Rank; at: number } | null`, `clearUnlock(): void`.
- `RankBadge({ rank, size = 18 })` — inline SVG pixel-art 12×12 grid scaled to `size`; designs (approved): NOVATO grey coin (`#8a8a9a` fill, `#3a3a48` rim, `#c8c8d4` highlight); JUGADOR cyan coin (`#00f5ff`, rim `#007a80`, highlight `#c9ffff`); VETERANO magenta star (`#ff00e5`, rim `#8a0070`, highlight `#ffb3f7`); MAESTRO gold crown (`#ffd400`, rim `#8a6a00`, base `#b38f00`, gems magenta `#ff00e5` ×2 + cyan `#00f5ff`, highlight `#fff2a8`); INVITADO renders nothing. Use `shape-rendering="crispEdges"`, `aria-label={rank}`.
- `CreditsToast` — client component mounted in `app/layout.tsx` (inside providers), reads `lastUnlock`; shows for ~4 s "NUEVO SKIN DESBLOQUEADO · RETRO" per tier (joined) and/or "NUEVO RANGO · VETERANO" with `RankBadge size={32}`; pixel font style of the app (`.pixel`), neon border; calls `clearUnlock()` on dismiss/timeout.
- `Nav.tsx`: delete local `getRank`/`getStars`; use `rank`/`credits`/`catalogSize` from context + `lib/credits.getStars`; render `<RankBadge rank={rank} />` next to the username in the desktop nav and in the mobile panel.

- [ ] **Step 1:** Read `UserContext.tsx` and `Nav.tsx` fully; read `lib/credits.ts` API.
- [ ] **Step 2:** Extend `UserContext`: keep existing fields/behavior; add `refreshCredits` (re-runs the `scores` distinct game_id query for the current user); `saveScore` (needs `user`; if no user returns `{ error: 'no-session' }`); transition detection: `prev = credits` → after refresh compute `crossedTiers(prev, next)` and rank change; set `lastUnlock` only if something crossed (guard StrictMode: compute from state, not effects).
- [ ] **Step 3:** Create `RankBadge.tsx` (4 pixel maps as arrays of `[x,y,w,h,color]` rects) and `CreditsToast.tsx`; mount toast in `app/layout.tsx`.
- [ ] **Step 4:** Refactor `Nav.tsx` to `lib/credits` + badge. Same copy as today for the counter (`CRÉDITOS · NN / TT`).
- [ ] **Step 5:** `npm test` green; `npm run build` green. Structure check only (no dev server).

### Task 4: `useGameSkin` hook, `MobileGamepad` skin options + "?" button, `InstructionsContent`

**Files:**
- Create: `hooks/use-game-skin.ts`, `components/InstructionsContent.tsx`
- Modify: `components/MobileGamepad.tsx`
- Reference: `components/MobileGamepad.tsx:28-31` (hardcoded list to remove), `app/games/pacman/play/page.tsx` (current skin plumbing), registry types (T2).

**Interfaces:**
- Consumes: `getSkinOptions`, `GameId`, `GameMeta` (T2); `resolveSkin`, `isUnlocked`, `requiredCredits` (T1); `credits` from `useUser()` (T3).
- Produces:
  - `useGameSkin(id: GameId): { skinKey: string; options: (SkinDef & { locked: boolean; requiredCredits: number })[]; change: (key: string) => void }` — reads `localStorage.getItem(`${id}-skin`)` in an effect (SSR-safe), resolves via `resolveSkin`, persists on `change` (ignores locked keys), re-resolves when `credits` changes.
  - `MobileGamepad` new props: `skinOptions: { key: string; label: string; locked?: boolean; requiredCredits?: number }[]` (required; remove internal `SKIN_OPTIONS`), `onHelp?: () => void` (renders a "?" button next to PAUSA when provided). Locked options render `disabled` with label `🔒 ${label} · ${requiredCredits}`.
  - `InstructionsContent({ game }: { game: GameMeta; title: string })` — server-renderable (no hooks): goal, tips list, keyboard table (normal rows then `special` rows with a "ESPECIAL" tag), touch table (D-pad directions used + A/B labels). Spanish headings: "OBJETIVO", "CONSEJOS", "TECLADO", "TÁCTIL".

- [ ] **Step 1:** Implement hook + `InstructionsContent` + gamepad changes. The gamepad select uses `skinOptions` exactly like its old list (same markup/classes).
- [ ] **Step 2:** `npm run build` will FAIL until pages pass `skinOptions` — acceptable mid-task ONLY if Task 5/6 follow immediately; to keep the build green, make `skinOptions` optional with a default of `[]` in this task and tighten to required in Task 6 Step 3.
- [ ] **Step 3:** `npm test` green; `npm run build` green.

### Task 5: Refactor play-pages batch A (arkanoid, asteroids, frogger, pacman, pong)

**Files:**
- Modify: `app/games/{arkanoid,asteroids,frogger,pacman,pong}/play/page.tsx`
- Reference: `.superpowers/sdd/2026-08-21-games-registry-credits-f2/context-punto1.md` (line numbers of SKIN_OPTIONS/getSavedSkin/changeSkin/keyMap/insert per page).

**Interfaces:**
- Consumes: `useGameSkin` (T4), `getKeyMap`/`getGame` (T2), `saveScore` from `useUser()` (T3), `InstructionsContent` (T4), `MobileGamepad` props `skinOptions`/`onHelp` (T4).

Per page, same recipe:
- [ ] **Step 1:** Remove local `SKIN_OPTIONS`, `getSavedSkin`, `changeSkin` and `keyMap`; `const { skinKey, options, change } = useGameSkin('<id>')`; `const keyMap = getKeyMap('<id>')`; keep passing `skinKey={skinKey}` to the game component.
- [ ] **Step 2:** Desktop HUD `<select>` renders `options` (locked → `disabled` + "🔒 LABEL · N"); `onChange` → `change`.
- [ ] **Step 3:** Replace the direct `supabase.from('scores').insert(...)` with `await saveScore({ gameId, playerName: name, score })`; keep the saved-name `localStorage` behavior and modal copy; remove the now-unused `createClient` import if nothing else uses it.
- [ ] **Step 4:** Add a "?" button in the desktop HUD (next to PAUSA) and `onHelp` on `MobileGamepad`; both set `helpOpen` → overlay (`.crt-content`-style, full screen within the page) with `<InstructionsContent game={getGame('<id>')!} title="…" />` and a CERRAR button; while `helpOpen`, pass `paused={paused || helpOpen}` (pong: also honor existing mode logic; gamepad still only in solo mode).
- [ ] **Step 5:** `MobileGamepad skinOptions={options} onSkinChange={change} onHelp={...}`.
- [ ] **Step 6:** `npm test` green; `npm run build` green; grep confirms no `SKIN_OPTIONS`/`from('scores')` left in the 5 pages.

### Task 6: Refactor play-pages batch B (road-fighter, snake, space-invaders, tetris) + `skinKey` rename

**Files:**
- Modify: `app/games/{road-fighter,snake,space-invaders,tetris}/play/page.tsx`, `components/games/SpaceInvadersGame.tsx` (prop `skin` → `skinKey` only), `components/MobileGamepad.tsx` (make `skinOptions` required).

- [ ] **Step 1:** Same recipe as Task 5 for the 4 pages. Tetris: `getKeyMap('tetris')` now gives `b:' '` (hard drop) — no page-side special casing. Space Invaders: keep `paused={paused || over}` and add `|| helpOpen`.
- [ ] **Step 2:** `SpaceInvadersGame.tsx`: rename prop `skin?` → `skinKey?` (interface + destructuring + the two `SKINS[...]` lookups); page passes `skinKey={skinKey}`.
- [ ] **Step 3:** `MobileGamepad`: `skinOptions` required (remove the `[]` default from Task 4).
- [ ] **Step 4:** `npm test` green; `npm run build` green; repo-wide grep: zero `SKIN_OPTIONS` outside the registry, zero `from('scores').insert` outside `lib/scores.ts`.

### Task 7: Instructions routes, detail button, mock removal, realtime by registry, docs

**Files:**
- Create: `app/games/[id]/layout.tsx`, `app/games/[id]/@modal/default.tsx`, `app/games/[id]/@modal/(.)instructions/page.tsx`, `app/games/[id]/instructions/page.tsx`
- Modify: `app/games/[id]/page.tsx` (INSTRUCCIONES button), `app/games/[id]/LiveLeaderboard.tsx:7,25` (registry flag), `references/implemented-games.md` (+ space-invaders row)
- Delete: `app/games/[id]/play/page.tsx` (dead mock)
- Reference: Next docs (parallel-routes.md, intercepting-routes.md, default.md) — READ FIRST.

**Interfaces:**
- Consumes: `getGame`, `isGameId` (T2); `InstructionsContent` (T4).
- Produces: route `/games/[id]/instructions` (full page, server component: fetch `games` title like the detail page, `notFound()` if not a registry id) and the intercepted modal (client wrapper for close: `router.back()`, Escape, backdrop click; content = same `InstructionsContent`).

- [ ] **Step 1:** Read the three Next docs; note how `@modal` slot + `default.tsx` + `(.)` interception work in this version and whether the segment needs `layout.tsx` to accept `{ children, modal }`.
- [ ] **Step 2:** Create `layout.tsx` rendering `{children}{modal}`; `@modal/default.tsx` → `return null`; full page + intercepted modal (modal is a client component that receives the server-rendered `InstructionsContent` as children).
- [ ] **Step 3:** Detail page: add `<Link href={`/games/${id}/instructions`} className="btn ghost">INSTRUCCIONES</Link>` next to JUGAR.
- [ ] **Step 4:** Delete the mock `app/games/[id]/play/page.tsx`; `LiveLeaderboard` uses `getGame(gameId)?.realtime`.
- [ ] **Step 5:** `references/implemented-games.md` add space-invaders.
- [ ] **Step 6:** `npm test` green; `npm run build` green — verify the route manifest lists `/games/[id]/instructions` and still lists all 9 `/games/<id>/play`.

---

## Orchestrator steps (outside executor tasks)

1. After Task 7: final whole-change review (most capable model) pointed at the ledger's deferred minors.
2. `verify-plan` against spec 24. QA manual de Paco: desbloqueo real cruzando umbral (toast + candado), modal por intercepción vs URL directa, "?" en juego, móvil (hard drop Tetris), los 4 realtime.

## Self-Review (done at write time)

- Spec coverage: registry (T2), credits/rank/stars/unlock/resolve (T1), saveScore + refresh + toast + badge + Nav (T3), hook + gamepad + instructions content (T4), 9 pages + dead keymaps + skinKey (T5/T6), routes + detail button + mock removal + realtime + docs + types (T2/T7). Ruling recorded: `saveScore` in context over `insertScore` in lib.
- Placeholders: none; test code inline for T1/T2; UI tasks carry exact props/copy.
- Type consistency: `SkinTier` defined once in T1 and imported by T2; `GameId` from T2 used by T3's `saveScore`; `skinOptions` shape identical in T4/T5/T6.
