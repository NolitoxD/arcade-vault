# Vault Fighter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir VAULT FIGHTER como juego nº13 del Vault y segunda entrada FIGHTING: ocho luchadores propios con `fuerza`/`velocidad`/`alcance` y una magia cada uno, combates **al mejor de 5 asaltos** por barras de vida, y **modo historia** de 8 combates (los 7 rivales que no elegiste + EL ARQUITECTO, jefe no seleccionable) con 8 fondos. Bloqueo (← mantenido), agacharse (↓ mantenido), barra de magia que se carga peleando y se lanza con un **tercer botón**, CONTINUE arcade al perder, CAMPEÓN/ELIMINADO con `GameOverModal`. El **modo torneo queda fuera de la v1** (v1.5).

**Architecture:** Toda la lógica vive en `components/games/fighter-logic/` como funciones puras **que reciben por parámetro el luchador, el roster, la tabla de magias, los escenarios y el estado del combate** — ningún módulo lee un roster, un perfil ni un combate de ámbito de módulo. Lo único a nivel de módulo son tablas de constantes (`ROSTER`, `TECHNIQUES`, `MAGIC_SPECS`, `STAGES`) y buffers de scratch sin estado entre llamadas. Las funciones que se llaman dentro del bucle escriben en **out-params** en vez de devolver objetos nuevos. `VaultFighterGame.tsx` es una cáscara de render: crea el `BoutState`, los `MagicRuntime`, el `StoryState` y los out-params **una vez** y en cada frame llama a `stepMagic`/`resolveHit`/`decide`. La play-page es el espejo de la de Bubble y reutiliza `components/GameOverModal.tsx` tal cual (`variant="victory"` para CAMPEÓN, `variant="defeat"` para ELIMINADO). Hereda de `karate-logic/` el **esquema de entrada** (8 técnicas = 2 botones × 4 direcciones) y la **forma** de su IA, pero no lo modifica: ver Task 4.

**Tech Stack:** TypeScript estricto, React 19.2.4, Next.js 16.2.6, canvas 2D, vitest 4.1.11, Supabase.

**Spec:** `specs/29-vault-fighter.md` (Approved, grill hecho 2026-09-01) · Hereda de `specs/25-karate-champ.md` · Plan de referencia: `docs/superpowers/plans/2026-08-28-bubble.md`

---

## Global Constraints

- **Commits: SOLO el dueño.** Ninguna tarea ejecuta `git add` ni `git commit`. Cada tarea termina dejando el working tree **verificado** (`npm test`, `npx tsc --noEmit`, `npm run build`) y **propone el mensaje de commit exacto**. Si hace falta `--no-verify`, se avisa.
- **Nunca arrancar `next dev`**: el dueño tiene el suyo. La verificación es siempre `npm test`, `npx tsc --noEmit` y `npm run build`. Nada de "lo he visto funcionar en el navegador".
- **Next.js 16.2.6**: leer `node_modules/next/dist/docs/` antes de tocar cualquier API de Next. Este plan casi no las toca (lógica pura + canvas); las excepciones son la play-page (Task 11) y el `dynamic(..., { ssr: false })`.
- **Comentarios y nombres de tests en inglés** (convención del repo). El plan, el spec y el chat, en castellano. Los textos de cara al jugador (nombres de luchador, instrucciones, HUD), en castellano.
- **Ficheros y carpetas en kebab-case**; componentes React en PascalCase; variables y funciones en camelCase; TypeScript estricto (nada de `any`, nada de `!` gratuito, nada de `as` para tapar un tipo).
- **Nada de estado global compartido.** El `roster`, el `BoutState`, el `MagicRuntime`, el `StoryState`, la tabla de escenarios y la fuente de aleatoriedad (`rng: () => number`) **se pasan siempre por parámetro**. Es la lección más cara de Kong: allí tres funciones seguían leyendo el array global `LADDERS` en vez del layout inyectado, no rompía nada mientras todos los mapas eran iguales, y apareció **tres veces** (Tasks 3, 4 y 5). Aquí el equivalente exacto es una función de daño o de IA que lea `ROSTER` o `MAGIC_SPECS` en vez del `FighterDef` que se le pasa: **prohibido**. Mientras los ocho luchadores no estén escritos (Tasks 1-5) todos "se parecen", que es justo cuando ese fallo es invisible. Los buffers de scratch sí pueden vivir en el módulo, porque no llevan estado entre llamadas.
- **Los invariantes van ANTES que el contenido.** La Task 1 monta la red de invariantes de luchador con **un solo luchador escrito** (NOVA) y el jefe; los otros siete llegan en la Task 6 con la red ya en verde. En Kong los mapas se dibujaron antes que su red y costaron 2 rondas de arreglo y 4 defectos bloqueantes; en Bubble la red fue primero y los 8 mapas pasaron **a la primera**. Si al escribir un luchador salta un invariante, **se corrige el luchador, nunca el invariante**.
- **Un invariante vale por lo que RECHAZA.** Por cada comprobación de `roster-invariants.ts` hay **un test negativo** con un dato fabricado que la incumple y demuestra que la comprobación falla. Un invariante sin test negativo es decorativo.
- **Reutilizar `components/GameOverModal.tsx`.** Ya existe con `variant: 'defeat' | 'victory'`, sin nada específico de ningún juego, y con `.modal--victory` en `app/globals.css`. **No se escribe otro modal**: CAMPEÓN es `variant="victory"` y ELIMINADO es `variant="defeat"`.
- **Sin asignación de memoria en el bucle de render** (spec 12): `resolveHit`, `decide` y `stepMagic` escriben en out-params creados una vez; nada de `filter`/`map`/spread/objetos literales/`new` dentro de `update()`; los strings del HUD se precalculan y solo se regeneran al cambiar el número.
- **Los 8 fondos se hornean a canvas offscreen**, uno por combate, y se rehornean **solo** al cambiar de combate o de skin. Nunca por frame.
- **Suite actual: 222 tests verdes en 27 ficheros** (verificado hoy con `npx vitest run`). No se admiten regresiones.
- **Refactor y funcionalidad van en tareas distintas.** La generalización de la IA (Task 4) y el tercer botón del mando (Task 9) son tareas propias por eso mismo.
- **Si un test existente cambia de valor esperado, eso es un bug que hay que INVESTIGAR, no una expectativa que actualizar.** En la ejecución de Bubble hubo dos intentos de ablandar una aserción para ponerla en verde; el segundo escaló a BLOCKED y resultó ser el escenario mal montado, no la regla. Ante una expectativa que no cuadra: responder **BLOCKED** con la medición, no relajar el test. Las **dos únicas** excepciones son listas hard-codeadas que crecen con el catálogo, y están declaradas por adelantado en las Tasks 9 y 11.
- **`lib/games-registry.test.ts` lleva a mano tres listas que rompen seguro** al añadir el juego nº13: los ids (`has exactly the 12 implemented games`), los realtime (`flags the realtime games`) y **`KEYMAP_SLOTS`, que hoy es `['up','down','left','right','a','b']` y no admite `c`**. Se actualizan **en la misma tarea** que las toca (9 y 11) o la suite se pone roja.

---

## File Structure

| Fichero | Responsabilidad |
|---|---|
| `components/games/fighter-logic/fighters.ts` | Tipos `FighterId`/`MagicId`/`MagicKind`/`FighterDef`, constantes de presupuesto (`STAT_BUDGET`, `ROSTER_SIZE`), tabla `ROSTER` y consultas puras (`fighterById`, `selectableFighters`, `bossFighter`, `difficultyRank`) |
| `components/games/fighter-logic/fighters.test.ts` | El `ROSTER` publicado pasa `checkRoster`; consultas; el jefe no es seleccionable |
| `components/games/fighter-logic/roster-invariants.ts` | `checkFighter`, `checkRoster`, `checkStages` — devuelven `string[]` de problemas, patrón `map-invariants.ts` |
| `components/games/fighter-logic/roster-invariants.test.ts` | Cada invariante con su **test negativo** sobre un roster fabricado que lo incumple |
| `components/games/fighter-logic/techniques.ts` | Las 8 técnicas con **daño** (no puntos), altura, alcance y tiempos; escalado por `fuerza`/`velocidad`/`alcance` del atacante; `resolveHit` con bloqueo y agachado |
| `components/games/fighter-logic/techniques.test.ts` | Tabla completa, escalado por stats, bloqueo por altura, agachado esquiva altas y come bajas, no se ataca bloqueando |
| `components/games/fighter-logic/combat.ts` | `BoutState`/`CombatantState`, vida, asaltos al mejor de 5, barra de magia (carga al dar y al recibir, se reinicia por asalto), `roundWinner`/`boutWinner` |
| `components/games/fighter-logic/combat.test.ts` | KO, fin de tiempo, 3 asaltos, empates, carga y reinicio de la magia |
| `components/games/fighter-logic/ai.ts` | `AiProfile` **derivado del luchador** (no del nivel), `profileFor(def, difficulty)`, `decide(profile, ctx, rng, out)` con bloqueo, agachado y magia |
| `components/games/fighter-logic/ai.test.ts` | Monotonía del perfil respecto a stats y dificultad; determinismo con rng sembrado; cero asignaciones (out-param) |
| `components/games/fighter-logic/magic.ts` | Las **4 mecánicas** (proyectil, área, estado propio, estado del rival), `MAGIC_SPECS` (9 tablas de parámetros), `castMagic`, `stepMagic`, `absorbWithShield` |
| `components/games/fighter-logic/magic.test.ts` | Una mecánica por bloque de tests, con specs fabricadas primero y las 9 reales después |
| `components/games/fighter-logic/stages.ts` | `StageDef` y los 8 escenarios (paleta + silueta), `stageForBout` |
| `components/games/fighter-logic/stages.test.ts` | Los 8 publicados pasan `checkStages`; `stageForBout` cubre los 8 combates sin repetir |
| `components/games/fighter-logic/story.ts` | Modo historia: orden de rivales, jefe al final, el elegido nunca es rival, CONTINUE con cuenta atrás, CAMPEÓN/ELIMINADO, puntuación |
| `components/games/fighter-logic/story.test.ts` | 8 combates, el elegido ausente, orden de dificultad creciente, CONTINUE acepta/rechaza/expira, puntuación |
| `lib/sfx-vault-fighter.ts` + `.test.ts` | SFX procedurales WebAudio, patrón exacto de `lib/sfx-kong.ts`, singleton `sfxVaultFighter` |
| `components/games/VaultFighterGame.tsx` | Canvas 800×500, pantalla de selección, fondos horneados, esqueleto compartido con paleta y proporciones por luchador, HUD de vidas/asaltos/magia |
| `app/games/vault-fighter/play/page.tsx` | Play-page espejo de la de Bubble + `GameOverModal` (CAMPEÓN/ELIMINADO) + `setTrackOverride` |
| `components/MobileGamepad.tsx` | **Modificado**: `KeyMap.c?`, botón C opcional que solo se pinta si `keyMap.c` existe, y prop `cLit` para encenderlo |
| `lib/games-registry.ts` | **Modificado**: `TouchControls.c?`, `GameId` a 13, entrada `vault-fighter` |
| `lib/games-registry.test.ts` | **Rompe seguro**: ids, realtime y `KEYMAP_SLOTS` hard-codeados → se actualizan en la misma tarea |
| `lib/supabase/types.ts` | **Modificado**: `'silver'` NO está hoy en la unión de `GameRow.color` (el spec da por hecho que sí) |
| `supabase/migrations/<ts>_add_vault_fighter_game.sql` | Fila `vault-fighter` en `games` (`cat: 'FIGHTING'`, `color: 'silver'`) |
| `app/globals.css` | `.cover-vault-fighter` **solo si** el PNG no está en `public/covers/` (ver Task 11) |
| `references/implemented-games.md` | Fila `vault-fighter` |

---

## Task 1: `fighters.ts` + `roster-invariants.ts` — la red antes que el contenido

**Files:**
- Create: `components/games/fighter-logic/fighters.ts`
- Create: `components/games/fighter-logic/roster-invariants.ts`
- Create: `components/games/fighter-logic/stages.ts` (**solo el tipo `StageDef` y `STAGES = []`**; los 8 escenarios son la Task 7)
- Test: `components/games/fighter-logic/roster-invariants.test.ts`
- Test: `components/games/fighter-logic/fighters.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces:

```ts
// components/games/fighter-logic/fighters.ts
export type FighterId =
  | 'nova' | 'torre' | 'glitch' | 'voltio' | 'oxido'
  | 'eco' | 'pixel' | 'brecha' | 'arquitecto';

export type MagicId =
  | 'destello' | 'muro' | 'salto-de-fase' | 'descarga' | 'corrosion'
  | 'onda' | 'duplicado' | 'sismico' | 'reinicio';

export type MagicKind = 'projectile' | 'area' | 'self-state' | 'foe-state';

export type FighterPalette = { body: string; trim: string; accent: string };

export type FighterDef = {
  id: FighterId;
  name: string;        // display, mayúsculas: 'NOVA'
  strength: number;    // 1..10 — fuerza
  speed: number;       // 1..10 — velocidad
  reach: number;       // 1..10 — alcance
  magic: MagicId;
  boss: boolean;       // el jefe está EXENTO del presupuesto de 15
  palette: FighterPalette;
  build: number;       // 0.9..1.1, proporción del esqueleto compartido
};

export const STAT_MIN = 1;
export const STAT_MAX = 10;
export const STAT_BUDGET = 15;   // los 8 seleccionables suman EXACTAMENTE 15
export const ROSTER_SIZE = 8;    // seleccionables, sin contar al jefe

export const ROSTER: readonly FighterDef[];   // Task 1: NOVA + ARQUITECTO. Task 6: los 9.

export function statTotal(def: FighterDef): number;
export function fighterById(roster: readonly FighterDef[], id: string): FighterDef | undefined;
export function selectableFighters(roster: readonly FighterDef[]): FighterDef[];
export function bossFighter(roster: readonly FighterDef[]): FighterDef;
export function difficultyRank(def: FighterDef): number;   // determinista; ordena la historia
```

```ts
// components/games/fighter-logic/roster-invariants.ts
import type { FighterDef, MagicKind } from './fighters';
import type { StageDef } from './stages';   // solo el tipo

export type MagicKindTable = Readonly<Record<string, MagicKind>>;

export function checkFighter(def: FighterDef, kinds: MagicKindTable): string[];
export function checkRoster(roster: readonly FighterDef[], kinds: MagicKindTable): string[];
export function checkStages(stages: readonly StageDef[]): string[];
```

`checkFighter` (por luchador, vale con un roster de uno):
1. `strength`/`speed`/`reach` enteros dentro de `[STAT_MIN, STAT_MAX]` → `stat out of range`
2. **no jefe ⇒ `statTotal === STAT_BUDGET`** → `budget 14` / `budget 18` (el número real, para que el mensaje diga qué pasa)
3. jefe ⇒ `statTotal > STAT_BUDGET` (debe ser superior, y está documentado) → `boss not superior`
4. su `magic` existe en la tabla de mecánicas → `magic without mechanic`
5. `build` en `[0.9, 1.1]`, `name` en mayúsculas y no vacío, los 3 colores de `palette` en formato `#rrggbb` → `bad palette` / `bad name` / `bad build`

`checkRoster` (sobre la tabla entera, se aplica al `ROSTER` real en la Task 6):
6. exactamente `ROSTER_SIZE` seleccionables y **exactamente un** jefe → `roster size N` / `boss count N`
7. ids únicos y magias únicas — **ningún luchador comparte magia** → `duplicate id x` / `duplicate magic x`
8. `difficultyRank` **estrictamente distinto** para los 8 seleccionables → `duplicate difficulty rank` (sin esto el orden de la historia no sería determinista)
9. cada luchador pasa `checkFighter` (prefijando su id en el mensaje)

`checkStages`: exactamente 8, ids únicos, siluetas únicas, colores `#rrggbb`, y ningún par de escenarios con el **mismo** `sky` — la 9d del spec ("los 8 fondos existen y son distintos entre sí").

`difficultyRank(def) = def.strength * 1.1 + def.speed * 1.3 + def.reach * 1.0`. Con los 8 sumando 15 el total no distingue a nadie, así que la dificultad la marca **cómo** se reparte: velocidad pesa más que fuerza y fuerza más que alcance, porque un rival rápido castiga más que uno fuerte. Es una función pura del `FighterDef` que se le pasa — **no** una tabla paralela que haya que mantener a mano.

> `roster-invariants.ts` importa **solo tipos** de `stages.ts`. La Task 1 crea `stages.ts` con el tipo `StageDef` y un array `STAGES` **vacío**; los 8 escenarios llegan en la Task 7. Así la red está escrita antes que el contenido sin dejar imports rotos.

- [ ] **Step 1: Escribir los tests que fallan**

```ts
// components/games/fighter-logic/roster-invariants.test.ts
import { describe, expect, it } from 'vitest';
import { checkFighter, checkRoster, checkStages, type MagicKindTable } from './roster-invariants';
import { ROSTER_SIZE, STAT_BUDGET, type FighterDef } from './fighters';
import type { StageDef } from './stages';

const KINDS: MagicKindTable = {
  destello: 'foe-state', muro: 'self-state', 'salto-de-fase': 'foe-state',
  descarga: 'projectile', corrosion: 'foe-state', onda: 'projectile',
  duplicado: 'area', sismico: 'area', reinicio: 'self-state',
};

function mk(over: Partial<FighterDef> = {}): FighterDef {
  return {
    id: 'nova', name: 'NOVA', strength: 5, speed: 5, reach: 5,
    magic: 'destello', boss: false, build: 1,
    palette: { body: '#e8f4ff', trim: '#00f5ff', accent: '#ffffff' },
    ...over,
  } as FighterDef;
}

// Un roster fabricado de 8 + jefe, todos legales, para mutarlo en los negativos.
const IDS = ['nova','torre','glitch','voltio','oxido','eco','pixel','brecha'] as const;
const MAGICS = ['destello','muro','salto-de-fase','descarga','corrosion','onda','duplicado','sismico'] as const;
function legalRoster(): FighterDef[] {
  // reparto que suma 15 y da 8 rangos de dificultad distintos
  const stats: [number, number, number][] = [
    [5,5,5],[9,2,4],[3,9,3],[4,8,3],[7,4,4],[3,3,9],[4,7,4],[8,3,4],
  ];
  const list = IDS.map((id, i) =>
    mk({ id, name: id.toUpperCase(), magic: MAGICS[i],
         strength: stats[i][0], speed: stats[i][1], reach: stats[i][2] }));
  list.push(mk({ id: 'arquitecto', name: 'EL ARQUITECTO', magic: 'reinicio',
                 boss: true, strength: 8, speed: 7, reach: 7 }));
  return list;
}

describe('checkFighter accepts a legal fighter', () => {
  it('reports no problems for a 5/5/5 fighter', () => {
    expect(checkFighter(mk(), KINDS)).toEqual([]);
  });
  it('reports no problems for the boss above the budget', () => {
    expect(checkFighter(mk({ id: 'arquitecto', name: 'EL ARQUITECTO', magic: 'reinicio',
      boss: true, strength: 8, speed: 7, reach: 7 }), KINDS)).toEqual([]);
  });
});

describe('checkFighter rejects what it is there to reject', () => {
  it('rejects a roster fighter under the budget', () => {
    const problems = checkFighter(mk({ strength: 4, speed: 4, reach: 4 }), KINDS);
    expect(problems.join(' ')).toContain('budget 12');
  });
  it('rejects a roster fighter over the budget', () => {
    const problems = checkFighter(mk({ strength: 6, speed: 6, reach: 6 }), KINDS);
    expect(problems.join(' ')).toContain('budget 18');
  });
  it('rejects a stat above 10 even when the total is 15', () => {
    const problems = checkFighter(mk({ strength: 11, speed: 3, reach: 1 }), KINDS);
    expect(problems.join(' ')).toContain('stat out of range');
  });
  it('rejects a stat below 1 even when the total is 15', () => {
    expect(checkFighter(mk({ strength: 0, speed: 5, reach: 10 }), KINDS).join(' '))
      .toContain('stat out of range');
  });
  it('rejects a non-integer stat', () => {
    expect(checkFighter(mk({ strength: 5.5, speed: 4.5, reach: 5 }), KINDS).join(' '))
      .toContain('stat out of range');
  });
  it('rejects a magic with no mechanic behind it', () => {
    const problems = checkFighter(mk({ magic: 'teletransporte' as never }), KINDS);
    expect(problems.join(' ')).toContain('magic without mechanic');
  });
  it('rejects a boss that is not superior to the roster', () => {
    const problems = checkFighter(mk({ id: 'arquitecto', boss: true, strength: 5, speed: 5, reach: 5 }), KINDS);
    expect(problems.join(' ')).toContain('boss not superior');
  });
  it('rejects a broken palette', () => {
    expect(checkFighter(mk({ palette: { body: 'blue', trim: '#00f5ff', accent: '#fff' } }), KINDS).join(' '))
      .toContain('bad palette');
  });
});

describe('checkRoster accepts a legal roster', () => {
  it('reports no problems', () => {
    expect(checkRoster(legalRoster(), KINDS)).toEqual([]);
  });
  it('counts exactly ROSTER_SIZE selectable fighters plus one boss', () => {
    expect(legalRoster().filter((f) => !f.boss)).toHaveLength(ROSTER_SIZE);
    expect(legalRoster().filter((f) => f.boss)).toHaveLength(1);
  });
});

describe('checkRoster rejects what it is there to reject', () => {
  it('rejects a roster of seven selectable fighters', () => {
    const r = legalRoster().filter((f) => f.id !== 'brecha');
    expect(checkRoster(r, KINDS).join(' ')).toContain('roster size 7');
  });
  it('rejects a roster with two bosses', () => {
    const r = legalRoster();
    r[0] = { ...r[0], boss: true, strength: 8, speed: 7, reach: 7 };
    expect(checkRoster(r, KINDS).join(' ')).toContain('boss count 2');
  });
  it('rejects a roster with no boss', () => {
    const r = legalRoster().filter((f) => !f.boss);
    expect(checkRoster(r, KINDS).join(' ')).toContain('boss count 0');
  });
  it('rejects duplicated ids', () => {
    const r = legalRoster();
    r[1] = { ...r[1], id: 'nova' };
    expect(checkRoster(r, KINDS).join(' ')).toContain('duplicate id nova');
  });
  it('rejects two fighters sharing the same magic', () => {
    const r = legalRoster();
    r[1] = { ...r[1], magic: 'destello' };
    expect(checkRoster(r, KINDS).join(' ')).toContain('duplicate magic destello');
  });
  it('rejects two fighters with the same difficulty rank', () => {
    const r = legalRoster();
    r[1] = { ...r[1], strength: 5, speed: 5, reach: 5 };   // clon de NOVA en stats
    expect(checkRoster(r, KINDS).join(' ')).toContain('duplicate difficulty rank');
  });
  it('propagates a per-fighter problem with the offender id', () => {
    const r = legalRoster();
    r[3] = { ...r[3], strength: 1, speed: 1, reach: 1 };
    expect(checkRoster(r, KINDS).join(' ')).toContain('voltio');
  });
});

// checkStages: la Task 7 publica los 8; aquí solo se prueba la comprobación.
function stage(over: Partial<StageDef> = {}): StageDef {
  return {
    id: 'arranque', name: 'SALA DE ARRANQUE', sky: ['#0a0a18', '#1b2340'],
    ground: '#141a2c', accent: '#00f5ff', silhouette: 'towers',
    ...over,
  } as StageDef;
}
const SILS = ['towers','pipes','arcs','grid','spires','dunes','ribs','core'] as const;
function legalStages(): StageDef[] {
  return SILS.map((s, i) => stage({
    id: `stage-${i}`, name: `ESCENARIO ${i}`, silhouette: s,
    sky: [`#0a0a1${i}`, `#1b234${i}`],
  }));
}

describe('checkStages', () => {
  it('accepts eight distinct stages', () => {
    expect(checkStages(legalStages())).toEqual([]);
  });
  it('rejects seven stages', () => {
    expect(checkStages(legalStages().slice(0, 7)).join(' ')).toContain('stage count 7');
  });
  it('rejects two stages sharing a silhouette', () => {
    const s = legalStages();
    s[3] = { ...s[3], silhouette: 'towers' };
    expect(checkStages(s).join(' ')).toContain('duplicate silhouette towers');
  });
  it('rejects two stages sharing the same sky', () => {
    const s = legalStages();
    s[5] = { ...s[5], sky: s[0].sky };
    expect(checkStages(s).join(' ')).toContain('duplicate sky');
  });
});
```

```ts
// components/games/fighter-logic/fighters.test.ts
import { describe, expect, it } from 'vitest';
import {
  bossFighter, difficultyRank, fighterById, ROSTER, selectableFighters, statTotal, STAT_BUDGET,
} from './fighters';

describe('roster queries', () => {
  it('finds a fighter by id and nothing by a made-up id', () => {
    expect(fighterById(ROSTER, 'nova')?.name).toBe('NOVA');
    expect(fighterById(ROSTER, 'ryu')).toBeUndefined();
  });
  it('never offers the boss as a selectable fighter', () => {
    expect(selectableFighters(ROSTER).some((f) => f.boss)).toBe(false);
    expect(bossFighter(ROSTER).id).toBe('arquitecto');
  });
  it('keeps every selectable fighter on the exact budget', () => {
    for (const f of selectableFighters(ROSTER)) {
      expect({ id: f.id, total: statTotal(f) }).toEqual({ id: f.id, total: STAT_BUDGET });
    }
  });
  it('ranks a fast fighter above a strong one on the same budget', () => {
    const fast = { strength: 3, speed: 9, reach: 3 } as never;
    const strong = { strength: 9, speed: 3, reach: 3 } as never;
    expect(difficultyRank(fast)).toBeGreaterThan(difficultyRank(strong));
  });
});
```

- [ ] **Step 2: Ejecutarlo y ver que falla**

Run: `npx vitest run components/games/fighter-logic/`
Expected: FAIL — no existen `fighters.ts`, `roster-invariants.ts` ni `stages.ts`.

- [ ] **Step 3: Implementación mínima**

`stages.ts` con **solo** el tipo `StageDef` y `export const STAGES: readonly StageDef[] = [];` (los 8 son la Task 7). `fighters.ts` con los tipos, las constantes, las consultas y un `ROSTER` de **dos** entradas: NOVA (5/5/5, `destello`) y EL ARQUITECTO (8/7/7, `reinicio`, `boss: true`). `roster-invariants.ts` con las nueve comprobaciones, devolviendo `string[]`, sin lanzar nunca.

> `fighters.test.ts` **no** llama todavía a `checkRoster(ROSTER, ...)`: con dos entradas fallaría por `roster size 1`. Esa línea la añade la Task 6, y es lo que cierra la red sobre el contenido real.

- [ ] **Step 4: Verde**

Run: `npm test` → 222 + los nuevos. Después `npx tsc --noEmit`.

- [ ] **Step 5: Dejar listo para commit**

Mensaje propuesto: `feat(vault-fighter): fighter invariants before the roster`

---

## Task 2: `techniques.ts` — las 8 técnicas con daño, bloqueo y agachado

**Files:**
- Create: `components/games/fighter-logic/techniques.ts`
- Test: `components/games/fighter-logic/techniques.test.ts`

**Interfaces:**
- Consumes: `FighterDef` de `fighters.ts` (Task 1).
- Produces:

```ts
export type Dir = 'neutral' | 'up' | 'down' | 'forward';
export type TechButton = 'a' | 'b';
export type Height = 'high' | 'mid' | 'low';
export type Stance = 'stand' | 'block' | 'crouch';

export type Technique = {
  id: string;
  input: { dir: Dir; button: TechButton };
  name: string;              // castellano, se pinta en el HUD
  height: Height;
  baseDamage: number;        // sobre MAX_HEALTH = 100, antes de escalar por fuerza
  baseReach: number;         // px, antes de escalar por alcance
  startupMs: number;         // antes de escalar por velocidad
  recoveryMs: number;
  advance: number;           // px que avanza la técnica (voladora, golpe con salto)
};

export const TECHNIQUES: readonly Technique[];   // las 8 de la tabla del spec
export function resolveTechnique(dir: Dir, button: TechButton): Technique;

export const BLOCK_LEAK = 0.35;      // fracción que pasa al bloquear la altura EQUIVOCADA
export const CROUCH_LOW_BONUS = 1.25; // agacharse deja expuesto a las bajas

export function scaledDamage(t: Technique, attacker: FighterDef): number;   // × (0.6 + strength/10 * 0.8)
export function scaledReach(t: Technique, attacker: FighterDef): number;    // × (0.7 + reach/10 * 0.6)
export function scaledStartup(t: Technique, attacker: FighterDef): number;  // × (1.3 - speed/10 * 0.6)
export function scaledRecovery(t: Technique, attacker: FighterDef): number; // mismo factor que startup

export type CombatantView = {
  x: number; facing: 1 | -1; stance: Stance; busyUntilMs: number;
};

export type HitOutcome = {
  result: 'idle' | 'miss' | 'evaded' | 'blocked' | 'grazed' | 'hit';
  damage: number;
};
export function createHitOutcome(): HitOutcome;

export function resolveHit(
  attacker: CombatantView, attackerDef: FighterDef,
  defender: CombatantView, t: Technique, nowMs: number,
  out: HitOutcome,
): void;
```

Reglas de `resolveHit`, en este orden exacto:
1. `attacker.busyUntilMs > nowMs` **o** `attacker.stance === 'block'` → `idle`, daño 0 (**no se puede atacar bloqueando**, novedad del spec frente a Karate Champ).
2. `Math.abs(defender.x - attacker.x) > scaledReach(t, attackerDef)` → `miss`, daño 0.
3. `defender.stance === 'crouch' && t.height === 'high'` → `evaded`, daño 0 (agacharse esquiva las altas).
4. `defender.stance === 'block'`: misma altura → `blocked`, daño **0**; otra altura → `grazed`, daño `× BLOCK_LEAK`. Bloquear **no** protege de las magias de área no bloqueables (eso lo resuelve `magic.ts`, Task 5).
5. `defender.stance === 'crouch' && t.height === 'low'` → `hit`, daño `× CROUCH_LOW_BONUS`.
6. Resto → `hit`, daño `scaledDamage`.

El daño se **redondea a entero** al final (`Math.round`), para que las barras de vida y los tests no arrastren decimales.

Tabla de las 8 (hereda alturas y velocidades relativas de `karate-logic/techniques.ts`, cambiando puntos por daño):

| id | input | nombre | altura | daño | alcance | startup | recovery | avance |
|---|---|---|---|---|---|---|---|---|
| `punetazo` | b | Puñetazo | mid | 6 | 40 | 120 | 160 | 0 |
| `punetazo-bajo` | ↓+b | Puñetazo bajo | low | 7 | 45 | 140 | 190 | 0 |
| `patada-frontal` | a | Patada frontal | mid | 8 | 55 | 150 | 200 | 0 |
| `barrido` | ↓+a | Barrido | low | 9 | 35 | 200 | 260 | 0 |
| `golpe-con-salto` | →+b | Golpe con salto | mid | 12 | 65 | 300 | 400 | 34 |
| `golpe-alto` | ↑+b | Golpe alto | high | 13 | 55 | 320 | 420 | 0 |
| `patada-alta` | ↑+a | Patada alta | high | 14 | 85 | 340 | 450 | 0 |
| `patada-voladora` | →+a | Patada voladora | high | 16 | 90 | 420 | 520 | 52 |

- [ ] **Step 1: Escribir los tests que fallan**

Cubrir, cada uno con su aserción exacta (nada de `toBeTruthy` sobre un objeto entero):
- Las 8 combinaciones `dir × button` resuelven a técnicas **distintas**, y las 8 juntas cubren `TECHNIQUES` sin sobrantes.
- `resolveTechnique('neutral','a')` es `patada-frontal` y `('down','b')` es `punetazo-bajo` (dos anclas contra un reordenado accidental de la tabla).
- **Escalado**: `scaledDamage` de la misma técnica es **estrictamente mayor** para BRECHA (fuerza 8) que para GLITCH (fuerza 3); `scaledReach` mayor para ECO (alcance 9) que para VOLTIO (alcance 3); `scaledStartup` **menor** para GLITCH (velocidad 9) que para TORRE (velocidad 2). Con un luchador de 5/5/5 los factores son exactamente `1.0`, `1.0` y `1.0` — test de anclaje del calibrado.
- **Bloqueo**: bloquear `high` contra `patada-alta` → `blocked` y daño `0`; bloquear `high` contra `barrido` (low) → `grazed` y daño `Math.round(scaledDamage * 0.35)`.
- **Agachado**: agachado contra `golpe-alto` → `evaded`, daño 0; agachado contra `punetazo-bajo` → `hit` con daño `× 1.25`.
- **No se ataca bloqueando**: atacante con `stance: 'block'` → `idle`, daño 0, aunque esté a distancia y sin recovery.
- **Fuera de alcance**: `punetazo` (40 px base) a 300 px → `miss`; la misma técnica a 300 px con ECO **tampoco** llega (el alcance escala, no teletransporta): `40 * (0.7 + 0.9*0.6) = 49.6`.
- **Out-param**: dos llamadas seguidas con el mismo `HitOutcome` lo **sobrescriben** (segundo resultado `miss` tras un `hit` deja `damage: 0`) — el test que impide un `out` mal reseteado.
- **Negativo**: `resolveTechnique('up', 'c' as never)` lanza; el `throw` es intencionado, es un error de programación, no de datos.

- [ ] **Step 2: Ejecutar y ver fallar**

Run: `npx vitest run components/games/fighter-logic/techniques.test.ts` → FAIL, el módulo no existe.

- [ ] **Step 3: Implementar**

Tabla plana, `resolveTechnique` con `find` (fuera del bucle de render, se llama al pulsar), `resolveHit` sin ninguna asignación: escribe `out.result` y `out.damage` y sale.

- [ ] **Step 4: Verde**

Run: `npm test && npx tsc --noEmit`.

- [ ] **Step 5: Dejar listo para commit**

Mensaje propuesto: `feat(vault-fighter): damage-based techniques with block and crouch`

---

## Task 3: `combat.ts` — vida, asaltos al mejor de 5 y barra de magia

**Files:**
- Create: `components/games/fighter-logic/combat.ts`
- Test: `components/games/fighter-logic/combat.test.ts`

**Interfaces:**
- Consumes: `FighterDef` (Task 1), `Stance` (Task 2).
- Produces:

```ts
export const MAX_HEALTH = 100;
export const ROUNDS_TO_WIN = 3;
export const NOMINAL_ROUNDS = 5;      // "al mejor de 5"; los empates pueden alargarlo
export const ROUND_TIME_MS = 60_000;
export const MAGIC_MAX = 100;
export const MAGIC_CHARGE_DEAL = 1.4;  // por punto de daño INFLIGIDO
export const MAGIC_CHARGE_TAKE = 0.6;  // por punto de daño RECIBIDO (recibir carga menos)

export type Side = 'player' | 'cpu';

export type CombatantState = {
  def: FighterDef;
  x: number; facing: 1 | -1; stance: Stance;
  health: number; magic: number;
  busyUntilMs: number; stunUntilMs: number;
  techId: string | null; techStartMs: number; hitEvaluated: boolean;
  walking: boolean; walkMs: number;
};

export type BoutState = {
  round: number;               // 1-based
  playerRounds: number; cpuRounds: number;
  roundMs: number;             // transcurrido del asalto en curso
  player: CombatantState; cpu: CombatantState;
};

export function createCombatant(def: FighterDef, x: number, facing: 1 | -1): CombatantState;
export function createBout(playerDef: FighterDef, cpuDef: FighterDef): BoutState;
export function startBout(bout: BoutState, playerDef: FighterDef, cpuDef: FighterDef): void;
export function startRound(bout: BoutState): void;
export function applyDamage(bout: BoutState, to: Side, amount: number): void;
export function roundWinner(bout: BoutState): Side | 'draw' | null;
export function commitRound(bout: BoutState, winner: Side | 'draw'): void;
export function boutWinner(bout: BoutState): Side | null;
export function isMagicReady(c: CombatantState): boolean;
export function spendMagic(c: CombatantState): void;
export function addMagic(c: CombatantState, amount: number): void;
```

Reglas:
- `startBout` **muta** el `BoutState` que recibe (cero asignaciones): pone `round = 1`, marcadores a 0 y llama a `startRound`.
- `startRound`: vida a `MAX_HEALTH`, **magia a 0** (el spec lo pide explícito: *se reinicia en cada asalto*), `roundMs = 0`, posiciones y stance iniciales, técnicas y aturdimientos limpios.
- `applyDamage(bout, to, amount)`: resta vida con suelo en 0 y **carga las dos barras**: el que recibe `+ amount * MAGIC_CHARGE_TAKE`, el que pega `+ amount * MAGIC_CHARGE_DEAL`, ambas con techo en `MAGIC_MAX`. Daño 0 (un bloqueo limpio) **no carga nada**.
- `roundWinner`: KO (vida a 0) gana el contrario; si `roundMs >= ROUND_TIME_MS`, gana el de más vida y `'draw'` si empatan; si no, `null`.
- `commitRound`: suma el asalto al ganador (un `'draw'` **no suma a nadie** pero **sí** consume asalto), incrementa `round`.
- `boutWinner`: `player` o `cpu` en cuanto uno llega a `ROUNDS_TO_WIN`, `null` si no. **Los empates pueden llevar el combate más allá del asalto 5**: con 3 victorias como única condición de cierre no hace falta ningún caso especial de desempate. `NOMINAL_ROUNDS` es solo para el HUD.

- [ ] **Step 1: Escribir los tests que fallan**

- Un asalto recién arrancado tiene vida `100`, magia `0` y `roundMs 0` en ambos.
- KO: `applyDamage(bout,'cpu',100)` → `roundWinner === 'player'`; la vida se queda en `0`, **nunca negativa**.
- Fin de tiempo con ventaja: `roundMs = ROUND_TIME_MS`, jugador 60 / cpu 30 → `'player'`. Empatados a 45 → `'draw'`. Un milisegundo antes del límite → `null`.
- Mejor de 5: tres `commitRound('player')` → `boutWinner === 'player'`; 2-2 → `null`; con dos empates de por medio el combate llega al asalto 7 y **sigue** cerrándose a 3 (test explícito del caso raro).
- Magia: 50 puntos de daño infligidos dan `50 * 1.4 = 70` al que pega y `50 * 0.6 = 30` al que recibe; **dar carga más que recibir** (aserción directa entre ambos); tope en `MAGIC_MAX` tras un daño enorme; `isMagicReady` solo con la barra llena; `spendMagic` la deja en 0.
- **Reinicio por asalto**: cargar la magia a tope, `commitRound` + `startRound` → magia `0` en los dos y vida `100`. Es la 4ª condición del criterio 4 del spec y es la que más fácil se olvida.
- **Negativo**: daño `0` (bloqueo limpio) no mueve ninguna de las dos barras de magia.
- **Sin estado global**: dos `BoutState` creados por separado no comparten `CombatantState` (mutar uno no toca al otro) — la trampa de Kong con `LAYOUTS[1..4]` apuntando al mismo objeto.

- [ ] **Step 2: Ejecutar y ver fallar**

Run: `npx vitest run components/games/fighter-logic/combat.test.ts` → FAIL.

- [ ] **Step 3: Implementar**

Toda mutación in-place sobre el `BoutState` recibido; ninguna función crea objetos salvo `createBout`/`createCombatant`, que el componente llama **una vez**.

- [ ] **Step 4: Verde**

Run: `npm test && npx tsc --noEmit`.

- [ ] **Step 5: Dejar listo para commit**

Mensaje propuesto: `feat(vault-fighter): best-of-five bouts with per-round magic meter`

---

## Task 4: `ai.ts` — la IA pasa de nivel a PERFIL DE LUCHADOR (refactor puro)

**Files:**
- Create: `components/games/fighter-logic/ai.ts`
- Test: `components/games/fighter-logic/ai.test.ts`
- **No se toca** `components/games/karate-logic/ai.ts`.

**Interfaces:**
- Consumes: `FighterDef` (Task 1), `Dir`/`TechButton`/`Height`/`Stance` (Task 2).
- Produces:

```ts
export type AiProfile = {
  reactionMs: number;      // 180..620
  aggression: number;      // 0..1
  blockChance: number;     // 0..1
  crouchChance: number;    // 0..1
  magicChance: number;     // 0..1 — probabilidad de gastar la magia estando llena
  preferredRange: number;  // px a los que intenta pelear
};

export function profileFor(def: FighterDef, difficulty: number): AiProfile;

export type AiContext = {
  distance: number;
  playerAttacking: boolean;
  playerAttackHeight: Height | null;
  cpuBusy: boolean;
  cpuMagicReady: boolean;
  cpuHealth: number;
  playerHealth: number;
};

export type AiAction = {
  move: 'approach' | 'retreat' | 'idle';
  stance: Stance;
  attackDir: Dir | null;
  attackButton: TechButton | null;
  magic: boolean;
};
export function createAiAction(): AiAction;

export function decide(profile: AiProfile, ctx: AiContext, rng: () => number, out: AiAction): void;
```

**Qué se hereda y qué cambia.** `karate-logic/ai.ts` son 65 líneas con `OPPONENT_CONFIG` (10 filas), `opponentFor(level)` y `decide(level, ctx, rng)` devolviendo un objeto nuevo. Aquí:
- la **tabla de 10 filas indexada por nivel desaparece**: el perfil se **deriva** del `FighterDef` que se pasa y de la posición en la historia (`difficulty` 1..8), igual que en Kong se dejó de leer el array global y se pasó el layout;
- `decide` recibe el **perfil**, no un índice, y **escribe en un out-param** en vez de devolver `{move, block, attack}`;
- se añaden dos decisiones que Karate Champ no tenía: **agacharse** y **lanzar la magia**;
- `block: Height | null` se sustituye por `stance: Stance`, porque en este juego bloquear es un estado del luchador, no una altura puntual (y bloqueando no se puede atacar).

**`karate-logic/ai.ts` se queda como está, a propósito.** Es un juego en producción con 4 ficheros de tests que fijan su tabla de niveles; convertirlo mezclaría refactor y funcionalidad en la misma tarea, justo lo que prohíben las Global Constraints, y pondría en juego expectativas existentes. Lo que se hereda es la **forma** (contexto → decisión con `rng` inyectado), no el fichero. **Si el dueño prefiere un módulo compartido, eso es una tarea aparte y posterior**, con `karate-logic` adaptándose al perfil.

Derivación (determinista, pura, sin tablas paralelas):

```
reactionMs   = 620 - def.speed * 30 - difficulty * 18     // acotado a [180, 620]
aggression   = 0.22 + def.strength * 0.03 + difficulty * 0.025   // acotado a [0, 0.9]
blockChance  = 0.18 + difficulty * 0.045                          // acotado a [0, 0.75]
crouchChance = 0.10 + def.speed * 0.015                           // acotado a [0, 0.4]
magicChance  = 0.30 + difficulty * 0.05                           // acotado a [0, 0.8]
preferredRange = 46 + def.reach * 7                               // px
```

Orden de decisión en `decide` (el primero que dispara, gana):
1. magia lista y `rng() < magicChance` → `magic: true`, `stance: 'stand'`, sin ataque;
2. el jugador ataca alto y `rng() < crouchChance` → `stance: 'crouch'`;
3. el jugador ataca y `rng() < blockChance` → `stance: 'block'`;
4. dentro de `preferredRange`, sin recovery y `rng() < aggression` → ataque (la elección de técnica pondera **las lentas y fuertes** cuanto mayor sea `difficulty`);
5. fuera de rango → `approach`; dentro → `retreat` con probabilidad fija, si no `idle`.

- [ ] **Step 1: Escribir los tests que fallan**

- **Monotonía por stats**: `profileFor(GLITCH, 1).reactionMs < profileFor(TORRE, 1).reactionMs` (velocidad 9 vs 2); `profileFor(BRECHA,1).aggression > profileFor(ECO,1).aggression` (fuerza 8 vs 3); `preferredRange` mayor para ECO (alcance 9) que para VOLTIO (alcance 3).
- **Monotonía por dificultad**: para el mismo luchador, `difficulty` 8 da `reactionMs` estrictamente menor y `aggression`/`blockChance`/`magicChance` estrictamente mayores que `difficulty` 1.
- **Cotas**: ni con `difficulty` 99 ni con stats extremos se sale ninguna probabilidad de `[0,1]` ni `reactionMs` de `[180,620]` (test con datos fabricados fuera de rango — el perfil se comporta aunque le mientan).
- **Determinismo**: con un `rng` sembrado (LCG de 3 líneas dentro del test) dos llamadas idénticas producen la misma acción.
- **Cada rama se alcanza**: con `rng` constante `0` → magia si está lista; `0.99` con el jugador atacando alto → ni agacha ni bloquea, decide moverse. Un test por rama, con el `rng` fijado a mano.
- **Out-param**: reutilizar el mismo `AiAction` en dos llamadas deja los cinco campos coherentes (una decisión de magia seguida de una de movimiento **no** deja `magic: true` colgado).
- **Sin estado de módulo**: dos perfiles distintos usados alternativamente no se contaminan (llamadas intercaladas dan las mismas acciones que en bloques separados, con el mismo rng sembrado).

- [ ] **Step 2: Ejecutar y ver fallar**

Run: `npx vitest run components/games/fighter-logic/ai.test.ts` → FAIL.

- [ ] **Step 3: Implementar**

Sin `Math.random` dentro del módulo: el `rng` **siempre** entra por parámetro (lo exige el determinismo de los tests). Sin tablas indexadas por nivel.

- [ ] **Step 4: Verde**

Run: `npm test && npx tsc --noEmit`. Comprobar que **los 222 tests previos siguen verdes**, en particular los 4 ficheros de `karate-logic/`: si alguno se mueve, es que se ha tocado lo que no se debía.

- [ ] **Step 5: Dejar listo para commit**

Mensaje propuesto: `feat(vault-fighter): fighter-profile ai derived from stats`

---

## Task 5: `magic.ts` — las CUATRO mecánicas (todavía sin las nueve magias)

**Files:**
- Create: `components/games/fighter-logic/magic.ts`
- Test: `components/games/fighter-logic/magic.test.ts`

**Interfaces:**
- Consumes: `MagicId`/`MagicKind`/`FighterDef` (Task 1), `CombatantState`/`BoutState`/`Side`/`applyDamage` (Task 3).
- Produces:

```ts
export type ProjectileSpec = { kind: 'projectile'; damage: number; speed: number; knockback: number; lifeMs: number };
export type AreaSpec      = { kind: 'area'; damage: number; radius: number; blockable: boolean; extraHits: number };
export type SelfSpec      = { kind: 'self-state'; shield: number; heal: number; durationMs: number };
export type FoeSpec       = { kind: 'foe-state'; stunMs: number; dotDamage: number; dotTicks: number; tickMs: number; teleportBehind: boolean };
export type MagicSpec = (ProjectileSpec | AreaSpec | SelfSpec | FoeSpec) & { id: MagicId; label: string };

export const MAGIC_SPECS: Readonly<Record<MagicId, MagicSpec>>;   // Task 5: una fabricada por mecánica. Task 6: las 9.
export function magicKinds(specs: Readonly<Record<string, MagicSpec>>): Readonly<Record<string, MagicKind>>;

export type MagicRuntime = {
  projectileActive: boolean; projectileX: number; projectileY: number;
  projectileVx: number; projectileDamage: number; projectileKnockback: number; projectileMsLeft: number;
  shield: number; buffMsLeft: number;
  dotTicksLeft: number; dotMsToTick: number; dotDamage: number;
  areaFlashMs: number;
};
export function createMagicRuntime(): MagicRuntime;
export function resetMagicRuntime(rt: MagicRuntime): void;

export type MagicSide = { side: Side; c: CombatantState; rt: MagicRuntime };

export function castMagic(spec: MagicSpec, caster: MagicSide, foe: MagicSide, bout: BoutState, nowMs: number): void;
export function stepMagic(player: MagicSide, cpu: MagicSide, bout: BoutState, dtMs: number, nowMs: number): void;
export function absorbWithShield(rt: MagicRuntime, damage: number): number;
```

**Cuatro caminos, nueve caras.** `castMagic` es un `switch` de cuatro ramas sobre `spec.kind`; lo que distingue a Descarga de Onda son **números**, no código:
- **`projectile`** — arma el proyectil en el runtime del lanzador (posición delante de su cara, `vx = speed * facing`, `msLeft = lifeMs`). `stepMagic` lo avanza, comprueba el impacto contra la caja del rival, aplica `applyDamage` + empuje (`knockback` en px) y lo apaga. Un proyectil **se bloquea** como una técnica media: bloqueando, daño 0.
- **`area`** — resuelve **en el acto**, sin proyectil: si `Math.abs(dx) <= radius`, `applyDamage`; si `blockable === false`, el bloqueo **no** lo evita (Sísmico); `extraHits` repite el daño esa cantidad de veces (el golpe fantasma de Duplicado). Enciende `areaFlashMs` para que el componente pinte el efecto.
- **`self-state`** — sobre el lanzador: `shield` acumula absorción (consumida por `absorbWithShield` antes de restar vida) y `heal` **suma vida con techo en `MAX_HEALTH`** (Reinicio no puede dejar al jefe por encima del máximo). `durationMs` alimenta `buffMsLeft`; al expirar, el escudo se pierde.
- **`foe-state`** — sobre el rival: `stunUntilMs = nowMs + stunMs`; `dotTicksLeft`/`dotMsToTick`/`dotDamage` arman el daño sostenido que `stepMagic` va aplicando tick a tick; `teleportBehind` recoloca al **lanzador** al otro lado del rival y **le da la vuelta a los dos** `facing`.

`castMagic` **no** comprueba ni gasta la barra: eso es `isMagicReady`/`spendMagic` (Task 3), y lo llama el componente. Así la mecánica se puede testear sin montar una barra llena.

- [ ] **Step 1: Escribir los tests que fallan**

Con **specs fabricadas** (una por mecánica, con números redondos), no con las nueve reales:
- *Proyectil*: tras `castMagic` queda activo y delante del lanzador con `vx` del signo de su `facing`; `stepMagic` lo acerca; al alcanzar al rival le quita **exactamente** `damage` y lo desactiva; con el rival bloqueando, daño 0 y proyectil consumido; si nadie lo toca, expira a `lifeMs` sin dañar. **Negativo**: un proyectil disparado hacia la izquierda no puede impactar a un rival que está a la derecha.
- *Área*: dentro del radio quita `damage`; **fuera del radio, 0** (negativo); con `blockable: true` y el rival bloqueando, 0; con `blockable: false` y el rival bloqueando, **daño completo** (Sísmico no se bloquea); `extraHits: 1` quita exactamente el doble.
- *Estado propio*: `shield: 25` hace que `absorbWithShield(rt, 30)` devuelva `5` y deje el escudo a 0; `absorbWithShield(rt, 10)` devuelve 0 y deja 15; `heal: 30` sobre 80 de vida deja **100, no 110** (negativo del techo); al agotarse `buffMsLeft` el escudo se pierde.
- *Estado del rival*: `stunMs: 900` deja `stunUntilMs = nowMs + 900`; el DOT aplica `dotTicks` veces `dotDamage` a razón de una por `tickMs` **y ni una más** (avanzar el doble de tiempo no da tics de más); `teleportBehind` deja al lanzador al otro lado y con los dos `facing` invertidos; **negativo**: el DOT no puede matar por debajo de 0 de vida.
- *Transversal*: `resetMagicRuntime` deja los 13 campos a su valor inicial (un asalto nuevo no hereda un DOT del anterior — el equivalente aquí del "estado que se cuela entre llamadas" de Bubble); `stepMagic` con `dtMs = 0` no cambia nada; dos `MagicRuntime` distintos no se contaminan.

- [ ] **Step 2: Ejecutar y ver fallar**

Run: `npx vitest run components/games/fighter-logic/magic.test.ts` → FAIL.

- [ ] **Step 3: Implementar**

Un `switch` de cuatro ramas, sin `default` silencioso (`never` exhaustivo). `stepMagic` sin asignaciones: campos escalares en el runtime, nada de arrays de proyectiles (hay como mucho uno por lado).

- [ ] **Step 4: Verde**

Run: `npm test && npx tsc --noEmit`.

- [ ] **Step 5: Dejar listo para commit**

Mensaje propuesto: `feat(vault-fighter): four magic mechanics with parameterised specs`

---

## Task 6: Los 8 luchadores, el jefe y las 9 magias — el contenido, con la red ya puesta

**Files:**
- Modify: `components/games/fighter-logic/fighters.ts` (el `ROSTER` pasa de 2 a 9 entradas)
- Modify: `components/games/fighter-logic/magic.ts` (`MAGIC_SPECS` pasa a las 9 reales)
- Modify: `components/games/fighter-logic/fighters.test.ts`, `magic.test.ts`

**Interfaces:**
- Consumes: `checkRoster`/`checkFighter` (Task 1), las 4 mecánicas (Task 5).
- Produces: el `ROSTER` completo y `MAGIC_SPECS` con las nueve entradas. **Ningún tipo nuevo.**

Tabla normativa (spec §"Los 8 luchadores"; **los ocho suman exactamente 15**, el jefe exento y documentado):

| id | nombre | fuerza | velocidad | alcance | Σ | magia | mecánica |
|---|---|---|---|---|---|---|---|
| `nova` | NOVA | 5 | 5 | 5 | 15 | `destello` | foe-state (aturde) |
| `torre` | TORRE | 9 | 2 | 4 | 15 | `muro` | self-state (absorbe) |
| `glitch` | GLITCH | 3 | 9 | 3 | 15 | `salto-de-fase` | foe-state (reaparece detrás) |
| `voltio` | VOLTIO | 4 | 8 | 3 | 15 | `descarga` | projectile (rápido) |
| `oxido` | ÓXIDO | 7 | 4 | 4 | 15 | `corrosion` | foe-state (daño sostenido) |
| `eco` | ECO | 3 | 3 | 9 | 15 | `onda` | projectile (empuja) |
| `pixel` | PÍXEL | 4 | 7 | 4 | 15 | `duplicado` | area (golpe fantasma) |
| `brecha` | BRECHA | 8 | 3 | 4 | 15 | `sismico` | area (no bloqueable) |
| `arquitecto` | EL ARQUITECTO | 8 | 7 | 7 | **22** | `reinicio` | self-state (restaura vida) |

Parámetros de las nueve magias (los únicos números que las distinguen):

```ts
descarga:      { kind: 'projectile', damage: 8,  speed: 620, knockback: 0,  lifeMs: 1600 }
onda:          { kind: 'projectile', damage: 5,  speed: 340, knockback: 90, lifeMs: 2000 }
sismico:       { kind: 'area', damage: 14, radius: 170, blockable: false, extraHits: 0 }
duplicado:     { kind: 'area', damage: 7,  radius: 110, blockable: true,  extraHits: 1 }
muro:          { kind: 'self-state', shield: 25, heal: 0,  durationMs: 6000 }
reinicio:      { kind: 'self-state', shield: 0,  heal: 30, durationMs: 0 }
destello:      { kind: 'foe-state', stunMs: 900, dotDamage: 0, dotTicks: 0, tickMs: 0,   teleportBehind: false }
corrosion:     { kind: 'foe-state', stunMs: 0,   dotDamage: 3, dotTicks: 6, tickMs: 600, teleportBehind: false }
'salto-de-fase': { kind: 'foe-state', stunMs: 200, dotDamage: 0, dotTicks: 0, tickMs: 0, teleportBehind: true }
```

- [ ] **Step 1: Cerrar la red sobre el contenido real (tests primero)**

Añadir a `fighters.test.ts`:

```ts
it('publishes a roster with no invariant problems', () => {
  expect(checkRoster(ROSTER, magicKinds(MAGIC_SPECS))).toEqual([]);
});
it('has nine fighters: eight selectable plus the boss', () => {
  expect(ROSTER).toHaveLength(9);
  expect(selectableFighters(ROSTER)).toHaveLength(ROSTER_SIZE);
});
it('gives every selectable fighter a different magic', () => {
  const magics = selectableFighters(ROSTER).map((f) => f.magic);
  expect(new Set(magics).size).toBe(ROSTER_SIZE);
});
it('documents the boss exemption: the architect is above the budget', () => {
  expect(statTotal(bossFighter(ROSTER))).toBeGreaterThan(STAT_BUDGET);
});
```

Y a `magic.test.ts`: las nueve `MAGIC_SPECS` tienen un `kind` de los cuatro implementados, `label` no vacío, y **cada una de las cuatro mecánicas aparece al menos una vez** (si alguien añadiera una quinta magia sin mecánica, `checkRoster` lo cazaría; este test caza lo contrario, una mecánica que se quedó sin usar).

- [ ] **Step 2: Ver fallar**

Run: `npx vitest run components/games/fighter-logic/` → FAIL: `roster size 1`, `boss count 1`, magias sin spec.

- [ ] **Step 3: Escribir el contenido**

Las 9 entradas del `ROSTER` (paleta y `build` propios: TORRE ancho `1.1`, GLITCH estrecho `0.9`, ECO alto y delgado…) y las 9 `MAGIC_SPECS`. **Ni una línea de mecánica nueva**: si al escribir una magia hace falta código, es que no era variante de las cuatro y hay que **parar y avisar (BLOCKED)**, no colar un quinto camino.

- [ ] **Step 4: Pasar los invariantes**

Si `checkRoster` protesta, **se corrige el luchador, nunca el invariante**. Anotar en el ledger cuántas veces saltó y por qué: es el dato que dice si la red servía de algo (en Bubble los 8 mapas pasaron a la primera; en Kong, sin red previa, hubo 4 defectos bloqueantes).

- [ ] **Step 5: Verde**

Run: `npm test && npx tsc --noEmit`.

- [ ] **Step 6: Dejar listo para commit**

Mensaje propuesto: `feat(vault-fighter): the eight fighters, the boss and their nine magics`

---

## Task 7: `stages.ts` — los 8 fondos

**Files:**
- Modify: `components/games/fighter-logic/stages.ts` (de array vacío a los 8)
- Test: `components/games/fighter-logic/stages.test.ts`

**Interfaces:**
- Consumes: `checkStages` (Task 1).
- Produces:

```ts
export type Silhouette = 'towers' | 'pipes' | 'arcs' | 'grid' | 'spires' | 'dunes' | 'ribs' | 'core';

export type StageDef = {
  id: string;
  name: string;                    // castellano, se pinta en la intro del combate
  sky: [string, string];           // gradiente vertical, '#rrggbb'
  ground: string;                  // '#rrggbb'
  accent: string;                  // '#rrggbb'
  silhouette: Silhouette;
};

export const STAGE_COUNT = 8;
export const STAGES: readonly StageDef[];
export function stageForBout(stages: readonly StageDef[], boutIndex: number): StageDef;  // 0..7
```

Los ocho (paleta y silueta, no detalle — se distinguen de un vistazo, como los fondos de Kong):

| # | id | nombre | silueta | idea de paleta |
|---|---|---|---|---|
| 1 | `arranque` | SALA DE ARRANQUE | `towers` | azul frío + cian |
| 2 | `cartuchos` | PATIO DE CARTUCHOS | `grid` | violeta + magenta |
| 3 | `tunel` | TÚNEL DE DATOS | `pipes` | verde oscuro + verde ácido |
| 4 | `azotea` | AZOTEA NEÓN | `spires` | púrpura nocturno + rosa |
| 5 | `fundicion` | FUNDICIÓN | `arcs` | rojo apagado + naranja |
| 6 | `cinta` | DESIERTO DE CINTA | `dunes` | ocre + ámbar |
| 7 | `servidores` | CATEDRAL DE SERVIDORES | `ribs` | azul acero + blanco |
| 8 | `nucleo` | NÚCLEO DEL VAULT | `core` | negro + plata (el del jefe) |

`stageForBout` es `stages[boutIndex]` con `boutIndex` acotado a `[0, STAGE_COUNT - 1]`: **un fondo por combate, sin repetir**, que es el criterio 6 del spec.

- [ ] **Step 1: Escribir los tests que fallan**

- `checkStages(STAGES)` devuelve `[]`.
- `STAGES` tiene 8 entradas, con ids, nombres, siluetas y gradientes **todos distintos** (aserción directa sobre `new Set(...).size`).
- `stageForBout` recorre los 8 combates dando 8 escenarios distintos; `stageForBout(STAGES, 99)` devuelve el octavo y `(-1)` el primero, sin lanzar (negativo del clamp).
- El escenario del jefe (`nucleo`) es el **último**, porque el combate 8 es el suyo.

- [ ] **Step 2: Ver fallar** — `npx vitest run components/games/fighter-logic/stages.test.ts` → FAIL (array vacío).
- [ ] **Step 3: Escribir los 8 escenarios.** Si `checkStages` protesta, se corrige el escenario.
- [ ] **Step 4: Verde** — `npm test && npx tsc --noEmit`.
- [ ] **Step 5: Dejar listo para commit** — `feat(vault-fighter): eight vault stages, one per bout`

---

## Task 8: `story.ts` — 8 combates, jefe al final y CONTINUE arcade

**Files:**
- Create: `components/games/fighter-logic/story.ts`
- Test: `components/games/fighter-logic/story.test.ts`

**Interfaces:**
- Consumes: `ROSTER`/`FighterDef`/`FighterId`/`difficultyRank`/`selectableFighters`/`bossFighter` (Tasks 1 y 6), `STAGES`/`stageForBout` (Task 7).
- Produces:

```ts
export const BOUTS = 8;                 // 7 rivales + el jefe
export const CONTINUE_MS = 10_000;      // cuenta atrás arcade

export const SCORE_PER_DAMAGE = 10;
export const SCORE_ROUND = 2_000;
export const SCORE_PERFECT_ROUND = 1_000;   // asalto ganado sin encajar daño
export const SCORE_BOUT = 8_000;
export const SCORE_BOSS = 20_000;

export type StoryStatus = 'fighting' | 'continue' | 'champion' | 'eliminated';

export type StoryState = {
  playerId: FighterId;
  order: FighterId[];        // 8 ids: 7 rivales por dificultad creciente + 'arquitecto'
  bout: number;              // 0..7, índice del combate en curso
  status: StoryStatus;
  continueMsLeft: number;
  continuesUsed: number;
  score: number;
};

export function createStory(roster: readonly FighterDef[], playerId: FighterId): StoryState;
export function currentOpponent(roster: readonly FighterDef[], story: StoryState): FighterDef;
export function currentStage(stages: readonly StageDef[], story: StoryState): StageDef;
export function currentDifficulty(story: StoryState): number;    // 1..8, alimenta profileFor
export function winBout(story: StoryState): void;                // último combate → 'champion'
export function loseBout(story: StoryState): void;               // → 'continue' con la cuenta atrás armada
export function tickContinue(story: StoryState, dtMs: number): void;  // al llegar a 0 → 'eliminated'
export function acceptContinue(story: StoryState): void;         // repite ESE combate
export function declineContinue(story: StoryState): void;        // → 'eliminated'
export function awardDamage(story: StoryState, damage: number): void;
export function awardRound(story: StoryState, perfect: boolean): void;
```

Reglas:
- `createStory` toma los **7 seleccionables que no eligió el jugador**, los ordena por `difficultyRank` **ascendente** y añade `arquitecto` al final. El elegido **nunca** aparece como rival (criterio 1 del spec).
- `winBout` en `bout === BOUTS - 1` → `status: 'champion'` y `score += SCORE_BOUT + SCORE_BOSS`; en el resto, `score += SCORE_BOUT`, `bout++` y sigue en `fighting`.
- `loseBout` → `status: 'continue'`, `continueMsLeft = CONTINUE_MS`. **No** toca `bout`: aceptar repite **ese** combate, con la puntuación intacta y `continuesUsed++`.
- `tickContinue` descuenta y, al tocar 0, **declina solo** → `eliminated`.
- `declineContinue` → `eliminated` inmediato.
- `currentDifficulty` es `bout + 1` (1..8): el jefe es el 8.

- [ ] **Step 1: Escribir los tests que fallan**

- Una historia recién creada tiene **8 rivales**, el elegido **no está** entre ellos (probado con **los 8** luchadores como elección, en bucle: es el criterio 1 y se comprueba entero, no con un ejemplo).
- El orden es de **dificultad estrictamente creciente** en los 7 primeros, y el octavo es siempre `arquitecto` (aunque el jugador elija al que tenga el rank más alto).
- Ganar 8 combates → `champion`; ganar 7 sigue en `fighting` con `bout === 7`.
- Perder → `continue` con `continueMsLeft === CONTINUE_MS` y el **mismo** `bout`; `acceptContinue` vuelve a `fighting` sin mover `bout`, con `continuesUsed === 1` y el `score` **intacto**; `declineContinue` → `eliminated`.
- `tickContinue(story, CONTINUE_MS)` → `eliminated`; `tickContinue(story, CONTINUE_MS - 1)` → sigue en `continue` (el negativo del *off-by-one* de la cuenta atrás).
- **Negativo**: `winBout` sobre una historia `eliminated` no la resucita; `acceptContinue` sobre una historia `fighting` no hace nada.
- Puntuación: `awardDamage(10)` suma `100`; `awardRound(true)` suma `SCORE_ROUND + SCORE_PERFECT_ROUND`; ganar el octavo suma `SCORE_BOUT + SCORE_BOSS`.
- Cada uno de los 8 combates cae en un escenario distinto (`currentStage` recorrido combate a combate).
- **Sin estado global**: dos `StoryState` con elecciones distintas conviven sin compartir el array `order`.

- [ ] **Step 2: Ver fallar** — `npx vitest run components/games/fighter-logic/story.test.ts` → FAIL.
- [ ] **Step 3: Implementar.** `createStory` es la única que crea arrays; el resto muta.
- [ ] **Step 4: Verde** — `npm test && npx tsc --noEmit`.
- [ ] **Step 5: Dejar listo para commit** — `feat(vault-fighter): story mode with boss finale and arcade continue`

---

## Task 9: El TERCER BOTÓN del mando táctil compartido (refactor aditivo, sin funcionalidad nueva)

**Files:**
- Modify: `components/MobileGamepad.tsx`
- Modify: `lib/games-registry.ts` (solo el tipo `TouchControls`)
- Modify: `lib/games-registry.test.ts`

**Interfaces:**
- Consumes: nada nuevo.
- Produces:

```ts
// components/MobileGamepad.tsx
export interface KeyMap {
  up?: string; down?: string; left?: string; right?: string;
  a?: string; b?: string;
  c?: string;      // NUEVO — tercer botón, opcional
}

interface MobileGamepadProps {
  keyMap: KeyMap; paused: boolean; onPauseToggle: () => void;
  skin: string; onSkinChange: (skin: string) => void; skinOptions: SkinOptionProp[];
  onHelp?: () => void; backHref: string;   // ← las 8 actuales, sin tocar ni una
  cLit?: boolean;  // NUEVO — el botón C se pinta APAGADO hasta que vale true
}

// lib/games-registry.ts
export type TouchControls = { keyMap: KeyMap; a?: string; b?: string; c?: string };
```

**Este es el primer juego que toca el mando que usan los otros 12.** El riesgo no es el campo opcional, es el **layout**: la fila de acciones es hoy `[B, A]` con `gap: 22`. Metiendo un tercer botón sin condicional, los 12 juegos existentes se llevarían un hueco o un botón fantasma.

Reglas de la implementación:
- El botón C se pinta **solo** dentro de `{keyMap.c && (...)}`. Con `keyMap.c === undefined` el árbol renderizado es **idéntico al de hoy**, nodo a nodo.
- `ActionButton` amplía `label: 'A' | 'B' | 'C'` y `variant: 'a' | 'b' | 'c'`; la variante `c` usa el dorado del Vault (`#ffcf3a`, ya existe como `--gold` en `app/globals.css`), con el mismo tamaño (58 px) y la misma mecánica de `pointer`.
- **Apagado / encendido** (`cLit`): apagado = `opacity: 0.45`, sin `box-shadow` de glow y borde atenuado; encendido = exactamente el tratamiento actual de A/B. Es lo que le enseña al jugador cuándo puede lanzar la magia **sin explicar nada** — lo que le faltaba a Kong con su meta.
- El botón C **también dispara `keydown`+`keyup`** como A y B (no es un botón mantenido).
- Orden en la fila: `[C, B, A]`, con C el más alejado del pulgar porque es el menos frecuente.

Sobre la verificación: el repo **no tiene** `@testing-library/react` ni entorno jsdom (vitest corre en node, sin config), así que **no se puede** testear el render del mando. Añadir esas dependencias es un cambio de plataforma que **no entra en este plan**. Lo que sí se verifica:

- [ ] **Step 1: Escribir los tests que fallan (a nivel de registro)**

```ts
// lib/games-registry.test.ts
const KEYMAP_SLOTS = ['up', 'down', 'left', 'right', 'a', 'b', 'c'];  // ← 'c' NUEVO

it('keymaps only use valid slots and touch labels exist for a/b/c', () => {
  for (const id of GAME_IDS) {
    const { keyMap, a, b, c } = GAMES[id].controls.touch;
    for (const slot of Object.keys(keyMap)) expect(KEYMAP_SLOTS).toContain(slot);
    if (keyMap.a) expect(a).toBeTruthy();
    if (keyMap.b) expect(b).toBeTruthy();
    if (keyMap.c) expect(c).toBeTruthy();          // ← NUEVO
    expect(getKeyMap(id)).toBe(keyMap);
  }
});

it('only the games that need a third button declare one', () => {
  expect(GAME_IDS.filter((id) => GAMES[id].controls.touch.keyMap.c).sort()).toEqual([]);
});
```

> **Declarado por adelantado**: esa última lista pasa a `['vault-fighter']` en la **Task 11**, y es la única expectativa existente que este plan permite cambiar de valor, junto con las listas de ids y de realtime. Cualquier **otro** test que cambie de valor esperado es un bug: **BLOCKED**, no actualizar.

- [ ] **Step 2: Ver fallar**

Run: `npx vitest run lib/games-registry.test.ts` → FAIL: `c` no existe en `TouchControls` (error de tipos) y el `KEYMAP_SLOTS` viejo no lo admite.

- [ ] **Step 3: Implementar**

`KeyMap.c?`, `TouchControls.c?`, `ActionButton` con la tercera variante y el render condicional. **Ni una línea** que cambie el aspecto de A, B o la cruceta.

- [ ] **Step 4: Verde y prueba de no-regresión**

Run: `npm test && npx tsc --noEmit && npm run build`.
Además, **leer el diff completo de `MobileGamepad.tsx`** y confirmar a ojo que todo lo añadido está dentro del condicional `keyMap.c &&` o detrás de un valor por defecto (`cLit = false`). Anotarlo en el ledger. El aspecto real de los 12 juegos lo confirma el dueño en el QA (Task 11, punto 6).

- [ ] **Step 5: Dejar listo para commit**

Mensaje propuesto: `feat(gamepad): optional third action button for magic`

---

## Task 10: `lib/sfx-vault-fighter.ts` y `components/games/VaultFighterGame.tsx`

**Files:**
- Create: `lib/sfx-vault-fighter.ts`, `lib/sfx-vault-fighter.test.ts`, `components/games/VaultFighterGame.tsx`

**Interfaces:**
- Consumes: todo `fighter-logic` (Tasks 1-8) y `KeyMap` con `c` (Task 9).
- Produces:

```ts
// lib/sfx-vault-fighter.ts — patrón exacto de lib/sfx-kong.ts
export type VaultFighterSfx =
  | 'select' | 'whoosh' | 'hit' | 'block' | 'ko'
  | 'magic_ready' | 'magic_cast' | 'round_win' | 'round_lose'
  | 'bout_win' | 'continue' | 'champion' | 'game_over';
export class VaultFighterSFX {
  init(): void; play(name: VaultFighterSfx): void; setMuted(muted: boolean): void; dispose(): void;
}
export const sfxVaultFighter: VaultFighterSFX;

// components/games/VaultFighterGame.tsx
interface VaultFighterGameProps {
  paused: boolean;
  muted?: boolean;
  skinKey?: string;
  onScoreChange: (score: number) => void;
  onBoutChange: (bout: number) => void;                       // 1..8
  onRoundsChange: (playerRounds: number, cpuRounds: number) => void;
  onMagicReadyChange: (ready: boolean) => void;               // enciende el botón C
  onGameOver: (finalScore: number) => void;                   // ELIMINADO
  onVictory: (finalScore: number) => void;                    // CAMPEÓN
}
export default React.memo(VaultFighterGame);
```

**Desviación deliberada de la forma de props de Kong/Bubble**: aquí **no hay vidas**, hay CONTINUEs, así que `onLivesChange` no existe y en su lugar van `onBoutChange` + `onRoundsChange` (el marcador de asaltos es visible por criterio 2 del spec) y `onMagicReadyChange` (necesario para el botón C). El resto del contrato es idéntico, de modo que la play-page sigue siendo un espejo.

Estructura del componente, calcada de `KarateChampGame.tsx` (que ya resuelve fases, poses y HUD sin asignaciones):

- `'use client'`. Un solo `useEffect(..., [])` con todo el estado del bucle en el closure; `pausedRef`/`mutedRef`/`skinRef` actualizados por efectos aparte — **el bucle nunca lee props**.
- Creado **una vez**, fuera del bucle: `bout = createBout(...)`, `playerRt`/`cpuRt = createMagicRuntime()`, `playerSide`/`cpuSide` (`MagicSide`), `story = createStory(ROSTER, elegido)`, `hitOut = createHitOutcome()`, `aiOut = createAiAction()`, `aiCtx` (objeto de scratch reutilizado), `profile` recalculado **solo** al empezar combate.
- Máquina de fases: `'select' | 'intro' | 'fight' | 'round-end' | 'bout-end' | 'continue' | 'over'`. La **pantalla de selección** es la fase `select`: rejilla con los 8 seleccionables (nombre, tres barras de stats y el nombre de su magia), cruceta para moverse y A para confirmar; **el jefe no aparece** (`selectableFighters`). Confirmar llama a `createStory` y pasa a `intro`. **No hay selector de modo**: el criterio 1 del spec dice "se puede elegir modo y luchador", pero el torneo se fue a la v1.5 en el mismo grill, así que en la v1 solo hay historia y la fase `select` elige luchador y nada más. Meter un selector de un solo modo sería un menú muerto; cuando llegue el torneo, se añade delante de esta fase.
- El componente **no reimplementa ninguna regla**: daño → `resolveHit` + `applyDamage`; fin de asalto → `roundWinner`/`commitRound`; fin de combate → `boutWinner` + `winBout`/`loseBout`; magia → `isMagicReady`/`spendMagic` + `castMagic`; CONTINUE → `tickContinue`/`acceptContinue`/`declineContinue`. Si aparece una regla escrita en el `.tsx`, va al ledger como deuda y se mueve a `fighter-logic`.
- **Entrada**: ← mantenido = `stance: 'block'`, ↓ mantenido = `'crouch'`, ↑/↓/→ + `j`/`k` = las 8 técnicas, `l` = magia (el keyMap del registro: `a: 'j'`, `b: 'k'`, `c: 'l'`). Listener en `document` con guarda `isTypingTarget`, `e.preventDefault()` y `sfxVaultFighter.init()` perezoso en el primer keydown. **Listener de `blur` desde el día 1** que suelta `left/right/up/down` y saca al luchador de `block`/`crouch`: es el bug transversal nº1 del repo y aquí se ve enseguida (alt-tab con ← pulsado deja al luchador bloqueando para siempre).
- **Fondos horneados**: `bakeStage(stage, skin)` a un canvas offscreen de 800×500, rehorneado **solo** al cambiar de combate o de skin. Silueta procedural por `stage.silhouette`, sin detalle fino.
- **Luchadores**: un **esqueleto compartido** de poses (idle, walk×2, las 8 técnicas, block, crouch, stun, KO) horneado por `(fighterId, skin, pose)` en un `spriteCache` de módulo; se distinguen por `palette` y por `build` (ancho/alto), **no** por animaciones propias (fuera de scope por spec).
- **HUD**: dos barras de vida enfrentadas, el marcador de asaltos en pips (`● ● ○` / `● ○ ○`), COMBATE `03/08`, el nombre del rival y **la barra de magia bajo cada barra de vida**, que parpadea al llenarse. Strings precalculados y regenerados solo al cambiar el número (patrón `TIMER_TEXT`, `KongGame.tsx:84`).
- `onMagicReadyChange` se emite **solo en el flanco** (cuando `isMagicReady` cambia de valor), nunca por frame.
- Bucle: `dtMs = Math.min(ts - last, 50)`; si `pausedRef.current` → `draw()` y salir; si terminó → dibujar una sola vez.
- Cleanup: `cancelAnimationFrame`, quitar listeners (incluido `blur`) y `sfxVaultFighter.dispose()`.

- [ ] **Step 1: Test de SFX que falla**

Mismo contrato que `lib/sfx-kong.test.ts`: sin `AudioContext`, los 13 `play`, `setMuted` y `dispose` no lanzan, e `init()` sin `AudioContext` global tampoco.

- [ ] **Step 2: Ver fallar y escribir `lib/sfx-vault-fighter.ts`**

Run: `npx vitest run lib/sfx-vault-fighter.test.ts` → FAIL. Implementar con `AudioContext` perezoso, `MASTER_GAIN = 0.4`, `play` con `switch`, `setMuted` vía `setTargetAtTime`, `dispose()` y el singleton. Verde.

- [ ] **Step 3: Escribir `VaultFighterGame.tsx`**

- [ ] **Step 4: Verde**

Run: `npm test && npx tsc --noEmit && npm run build`.
`npm run build` es aquí la verificación real: el componente no tiene test unitario (RAF y canvas), así que lo que se comprueba es que compila, que no rompe la suite y que la ruta construye.

- [ ] **Step 5: Comprobación manual de allocations (sin navegador)**

Leer el cuerpo de `update()` y de `draw()` y confirmar contra la lista de "Global Constraints" que no hay literales de objeto/array, `filter`/`map`/spread, `new` ni cierres creados por frame, y que `resolveHit`/`decide`/`stepMagic` se llaman **siempre** con sus out-params. Anotarlo en el ledger.

- [ ] **Step 6: Dejar listo para commit**

Mensaje propuesto: `feat(vault-fighter): canvas game with fighter select and baked stages`

---

## Task 11: Catálogo, migración, play-page y cierre

**Files:**
- Modify: `lib/games-registry.ts`, `lib/games-registry.test.ts`, `lib/supabase/types.ts`, `references/implemented-games.md`
- Create: `supabase/migrations/<ts>_add_vault_fighter_game.sql`, `app/games/vault-fighter/play/page.tsx`
- Modify (condicional): `app/globals.css`

**Interfaces:**
- Consumes: `VaultFighterGame` y sus props (Task 10), `getGame`/`getKeyMap`, `useGameSkin`, `useMusic`, `MobileGamepad` con `c`/`cLit` (Task 9), `InstructionsContent`, **`components/GameOverModal.tsx` tal cual**.
- Produces: `GameId` con 13 entradas y la entrada `vault-fighter`.

Esta tarea tiene **dos puntos de commit**: el primero (registro + tests + migración + docs) debe ser atómico o la suite se queda roja.

> **Tres listas hard-codeadas rompen a la vez**: los ids, los realtime y la lista de "juegos con tercer botón" que dejó preparada la Task 9. Se actualizan en el **mismo** commit que la entrada del registro.

**Dos hallazgos del spec que hay que verificar antes de escribir la migración** (el spec los da por hechos y **no lo están** en el repo de hoy):

1. **`silver` NO está en la unión de colores.** `lib/supabase/types.ts:8` es `'cyan' | 'magenta' | 'yellow' | 'green' | 'blue' | 'red' | 'gold'`. Hay que **añadir `'silver'`**. La variable CSS `--silver: #c7d0e0` **sí** existe (`app/globals.css:17`), así que el color es legítimo del Vault; lo que falta es el tipo. **Antes de aplicar la migración**, comprobar si la tabla `games` tiene un `CHECK` sobre `color`: si lo tiene, la migración debe **alterarlo primero**; si no, basta el `INSERT`. `GamesGrid.tsx:29` solo da color al botón para `magenta` y `yellow`, así que `silver` cae en el estilo por defecto — correcto, no hay que tocarlo.
2. **`public/covers/vault-fighter.png` NO existe** (verificado: en `public/covers/` solo hay bubble, frogger, karate-champ, kong, pacman, snake y space-invaders). El spec dice que el PNG "ya está en el repo". **Comprobarlo de nuevo al arrancar la tarea**; si sigue sin estar, se usa el cover CSS provisional `.cover-vault-fighter` (patrón de `pacman`/`space-invaders`) y la migración `UPDATE games SET cover = '/covers/vault-fighter.png'` va **después**, cuando el dueño deje el PNG. Lo mismo con `public/vault-fighter-theme.mp3`, que tampoco está: si falta, **no** se llama a `setTrackOverride` (sonaría el fallo de carga) y se anota como pendiente.

- [ ] **Step 1: Escribir los tests del registro que fallan**

```ts
// lib/games-registry.test.ts — sustituciones exactas
it('has exactly the 13 implemented games', () => {
  expect(GAME_IDS.sort()).toEqual([
    'arkanoid', 'asteroids', 'bubble', 'frogger', 'karate-champ', 'kong', 'pacman',
    'pong', 'road-fighter', 'snake', 'space-invaders', 'tetris', 'vault-fighter',
  ]);
});

it('flags the realtime games', () => {
  expect(GAME_IDS.filter((id) => GAMES[id].realtime).sort()).toEqual([
    'bubble', 'karate-champ', 'kong', 'pacman', 'pong', 'road-fighter',
    'space-invaders', 'vault-fighter',
  ]);
});

it('only the games that need a third button declare one', () => {
  expect(GAME_IDS.filter((id) => GAMES[id].controls.touch.keyMap.c).sort())
    .toEqual(['vault-fighter']);        // ← anunciado en la Task 9
});

// dentro del test de skins, junto a los de kong/bubble:
expect(getSkinOptions('vault-fighter').map((s) => `${s.key}:${s.tier}`)).toEqual([
  'classic:base', 'retro:retro', 'neon:neon',
]);

it('vault-fighter has the fight keyMap with the magic button', () => {
  const { keyMap, a, b, c } = GAMES['vault-fighter'].controls.touch;
  expect(keyMap).toEqual({
    up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight',
    a: 'j', b: 'k', c: 'l',
  });
  expect(a).toBe('PATADA');
  expect(b).toBe('PUÑO');
  expect(c).toBe('MAGIA');
});
```

- [ ] **Step 2: Ver fallar**

Run: `npx vitest run lib/games-registry.test.ts` → FAIL: 12 ids, 7 realtime, `vault-fighter` no existe.

- [ ] **Step 3: Añadir la entrada nº13 al registro**

`GameId` pasa a 13. Entrada `vault-fighter` con `skins: CLASSIC_SKINS`, `realtime: true`, el keyMap de arriba y las instrucciones del spec (`goal` > 20 chars + 4 tips), que deben mencionar **bloqueo con ←**, **agacharse con ↓**, **el tercer botón de magia** y **el mejor de 5 asaltos** — son las cuatro cosas que un jugador de Karate Champ no espera.

- [ ] **Step 4: Migración, tipos, CSS y docs**

- `lib/supabase/types.ts`: añadir `'silver'` a la unión de `GameRow.color`.
- Migración `INSERT INTO games (id, title, short, long, cat, cover, color) VALUES ('vault-fighter', 'VAULT FIGHTER', …, 'FIGHTING', <cover>, 'silver')` con los textos del spec, aplicada por MCP y **versionada con la versión EXACTA que devuelva el servidor** como nombre de fichero. `'FIGHTING'` ya existe en la unión de `cat`, así que ahí no hay cambio.
- `.cover-vault-fighter` en `app/globals.css` **solo si** el PNG no está (ver hallazgo 2).
- Fila de `vault-fighter` en `references/implemented-games.md`.

- [ ] **Step 5: Verde y primer punto de commit**

Run: `npm test && npx tsc --noEmit && npm run build`.
Mensaje propuesto: `feat(vault-fighter): register game #13 and add its games row`

- [ ] **Step 6: `app/games/vault-fighter/play/page.tsx`**

Espejo de `app/games/bubble/play/page.tsx`: `dynamic(() => import('@/components/games/VaultFighterGame'), { ssr: false })`, `useGameSkin('vault-fighter')`, `getKeyMap('vault-fighter')`, puntuación/combate/asaltos en **refs + escritura directa al DOM** (nunca `useState` por frame, spec 12), botón mute con `localStorage['av_sfx_muted']`, overlay "?" con `<InstructionsContent game={getGame('vault-fighter')!} title="VAULT FIGHTER" />`, `MobileGamepad`, CRT con `aspectRatio: '8 / 5'` (el del canvas 800×500, como Karate Champ).

Diferencias respecto al espejo, todas justificadas:
- **No hay corazones**: el HUD muestra `COMBATE 03/08` y `ASALTOS 2-1` en vez de vidas.
- **`cLit`**: `const [magicReady, setMagicReady] = useState(false)` alimentado por `onMagicReadyChange` y pasado a `<MobileGamepad cLit={magicReady} … />`. Es un `useState` en la play-page, y está permitido porque cambia **una o dos veces por asalto**, no por frame; el resto del HUD sigue por refs.
- **Fin de partida con el modal que ya existe**, sin escribir uno nuevo:

```tsx
<GameOverModal
  variant={champion ? 'victory' : 'defeat'}
  score={scoreRef.current}
  … onSave={async () => { … await saveScore({ gameId: 'vault-fighter', playerName: name, score: scoreRef.current }); }}
  leaderboardHref="/games/vault-fighter#leaderboard"
/>
```

`app/games/vault-fighter/page.tsx` **no se crea**: la ficha la sirve la ruta dinámica `app/games/[id]/page.tsx` leyendo de Supabase, igual que Kong y Bubble.

- [ ] **Step 7: Verde**

Run: `npm test && npx tsc --noEmit && npm run build`. Comprobar que el build lista `/games/vault-fighter/play` y que ninguna ruta da 500.

- [ ] **Step 8: Segundo punto de commit**

Mensaje propuesto: `feat(vault-fighter): play page with champion ending and magic button`

- [ ] **Step 9: `verify-plan`**

Pasar el skill `verify-plan` sobre el plan entero y **los 11 criterios de aceptación del spec 29** antes de dar nada por cerrado.

- [ ] **Step 10: QA humano (Paco)**

**Esto no lo puede hacer un agente**: con el Browser pane oculto `requestAnimationFrame` se congela. Lista mínima:
1. Los 8 luchadores **se sienten distintos** y el elegido no aparece como rival (criterio 11 del spec: es el riesgo de producto más alto y no lo cubre ningún test).
2. Las 9 magias **se entienden sin leer**, y las 8 de los luchadores son alcanzables jugando un combate normal.
3. Bloquear y agacharse funcionan como dice el criterio 3, y **no** se puede atacar bloqueando.
4. El botón C sale **apagado** y se enciende solo al llenarse la barra; en teclado, `l`.
5. Perder saca el CONTINUE con cuenta atrás: aceptar repite **ese** combate con la puntuación intacta; rechazar (o dejar que expire) da ELIMINADO. Ganar el octavo da CAMPEÓN en verde.
6. **Los otros 12 juegos siguen viéndose igual en el mando móvil** — abrir dos o tres play-pages en móvil y confirmar que no hay hueco ni botón fantasma donde iría el C. Es el riesgo 3 del spec.
7. **No se parece a Karate Champ al jugar** (riesgo 4 del spec): si se sintieran igual, sobraría uno de los dos.
8. Alt-tab con ← pulsado no deja al luchador bloqueando para siempre.
9. La música suena solo en su play-page, obedece el mute del Nav y se calla al salir (si el MP3 ya está).

---

## Notas de riesgo para quien ejecute

- **La Task 6 es la que más fácil se tuerce, y por eso va la sexta.** Escribir nueve luchadores con nueve magias antes de tener la red de invariantes y las cuatro mecánicas es exactamente lo que pasó en Kong con los mapas: 2 rondas de arreglo y 4 defectos bloqueantes. Con la red en verde desde la Task 1, la Task 6 es rellenar una tabla.
- **La trampa nº1 sigue siendo el estado de módulo.** Mientras solo existan NOVA y el jefe (Tasks 1-5), una función que lea `ROSTER` en vez de su parámetro **no rompe nada**. Rompe en la Task 6, cuando los ocho dejan de parecerse, y para entonces el fallo está en cuatro sitios. Si al escribir una función apetece "para qué voy a pasar el `def`", ese es el momento exacto.
- **`karate-logic/` no se toca en ninguna tarea.** Sus 4 ficheros de tests forman parte de los 222 verdes. Si alguno se mueve, es que algo se ha tocado por accidente: investigar, no actualizar.
- **La lista de "juegos con tercer botón" cambia de valor esperado entre la Task 9 y la Task 11**, igual que las de ids y realtime. Está anunciado a propósito en las dos tareas: son listas hard-codeadas que crecen con el catálogo. **Cualquier otro** test que cambie de valor esperado es un bug → BLOCKED.
- **Dos afirmaciones del spec no se sostienen contra el repo de hoy** y hay que resolverlas en la Task 11: `silver` no está en la unión de `GameRow.color`, y `public/covers/vault-fighter.png` no existe (ni `public/vault-fighter-theme.mp3`). Ninguna de las dos bloquea la lógica; las dos bloquean la migración si se descubren tarde.
- **El equilibrio no lo puede verificar ningún test.** Los invariantes evitan lo imposible (un luchador que sea *peor*, no *distinto*); que los ocho resulten divertidos solo se sabe jugando. Es el riesgo de producto nº2 del spec: reservar QA de sobra y contar con **ajuste fino de números** después, que es barato porque toda la sintonía vive en tablas de constantes.
- **El criterio 1 del spec queda cubierto a medias, a propósito**: "elegir modo y luchador" se implementa como "elegir luchador", porque con el torneo en la v1.5 solo hay un modo. El resto del criterio —que el elegido no aparezca como rival— sí está cubierto y probado con los 8 luchadores en bucle (Task 8).
- **El torneo es v1.5 y comparte el 100 % del motor.** No dejar ganchos a medias "por si acaso": `story.ts` es del modo historia y ya está; el torneo será su propio módulo sobre el mismo `combat.ts`.
- **El catálogo pasa de 12 a 13 juegos.** `getRank` da `MAESTRO DEL VAULT` con `credits >= catalogSize` (`lib/credits.ts`): quien tuviera 12 créditos **pierde el rango hasta jugar a Vault Fighter**. Es correcto por diseño, pero el dueño debe saberlo antes de verlo en su perfil.
- **Vault Fighter hereda deuda, no la resuelve.** Copiar la play-page de Bubble copia sus lints de React 19 (refs leídas en render, `setState` síncrono en efectos) y el `saveScore` silencioso. La consistencia gana, pero suma la play-page nº13 a esa deuda.
- **Después de la Task 11 queda la cadena del spec**, fuera del alcance de este plan: `@skin-designer` (retro y neon de los nueve luchadores), `@mobile-porter` (ocho técnicas con cruceta en móvil es lo más tosco del juego), la carátula PNG con su migración `UPDATE` y la música propia.
