import type { FighterDef, FighterId } from './fighters';
import type { StageDef } from './stages';
import * as story from './story';
import * as tournament from './tournament';
import type { StoryState } from './story';
import type { TournamentState } from './tournament';

// The seam between VaultFighterGame.tsx and the two game modes. The
// component never talks to story.ts or tournament.ts directly: it holds one
// GameMode, created once when a run starts, and every per-frame question it
// asks goes through a function here. Neither module is modified — this layer
// wraps them.
export type GameMode =
  | { kind: 'story'; state: StoryState }
  | { kind: 'tournament'; state: TournamentState };

// The story's four states; the tournament only ever produces three of them
// ('continue' is impossible in a knockout bracket). The component reacts to
// this value alone, so the CONTINUE phase is reached exactly when a mode
// produces 'continue' — there is no per-mode branch in the component.
export type ModeStatus = 'fighting' | 'continue' | 'champion' | 'eliminated';

// Pre-built once at module load, never per frame: the HUD label the story
// mode shows for each bout — 'COMBATE 01/08' … 'COMBATE 08/08'. Both the
// bout number and the total are padStart(2): the unpadded total ('…/8') was
// a pre-existing cosmetic bug, fixed here with the owner's sign-off (spec 30,
// step 7) now that it is no longer entangled with the mode-layer refactor.
const STORY_BOUT_LABELS: readonly string[] = buildStoryBoutLabels();

function buildStoryBoutLabels(): string[] {
  const labels: string[] = [];
  const total = String(story.BOUTS).padStart(2, '0');
  for (let i = 1; i <= story.BOUTS; i++) {
    labels.push(`COMBATE ${String(i).padStart(2, '0')}/${total}`);
  }
  return labels;
}

// Constructors live here too, so VaultFighterGame.tsx imports this module and
// nothing else from the two mode modules. Called once when a run starts —
// never per frame.
export function createStoryMode(roster: readonly FighterDef[], playerId: FighterId): GameMode {
  return { kind: 'story', state: story.createStory(roster, playerId) };
}

// The randomness source arrives by parameter, exactly as it does in
// tournament.ts: the component passes Math.random by reference, once per run,
// so nothing here ever closes over a new function or reads a global.
export function createTournamentMode(
  roster: readonly FighterDef[], playerId: FighterId,
  stages: readonly StageDef[], rng: () => number,
): GameMode {
  return { kind: 'tournament', state: tournament.createTournament(roster, playerId, stages, rng) };
}

// The last field the component was still reading off m.state by hand. Both
// branches carry playerId with the same type, so this is a plain field read
// with no narrowing and no allocation.
export function modePlayerId(m: GameMode): FighterId {
  return m.state.playerId;
}

// ── Bracket screen ───────────────────────────────────────────────────────────
// The three questions the bracket phase asks, and the only place the answer
// depends on the mode. A mode with no bracket answers `null` to the first one,
// which is how the component decides the phase exists at all — it never asks
// "am I in a tournament?".

// The eight, in their seeded order, or null when the mode has no bracket. The
// array is the tournament's own and is never rebuilt, so the component can
// hold on to it for a whole run without allocating.
export function modeBracketIds(m: GameMode): readonly FighterId[] | null {
  return m.kind === 'tournament' ? m.state.bracket : null;
}

// Whether a seeded fighter is still in the running. A mode with no bracket
// knocks nobody out, so it answers true; nothing ever asks it, because it has
// no bracket ids to ask about.
export function modeStillIn(m: GameMode, id: FighterId): boolean {
  return m.kind === 'tournament' ? tournament.isStillIn(m.state, id) : true;
}

// Whether this bout closes the bracket — the super final. False for a mode
// with no bracket: the story's last bout is a boss, not a bracket's finale.
export function modeIsFinale(m: GameMode): boolean {
  return m.kind === 'tournament' ? tournament.isFinale(m.state) : false;
}

export function modeOpponent(roster: readonly FighterDef[], m: GameMode): FighterDef {
  return m.kind === 'story'
    ? story.currentOpponent(roster, m.state)
    : tournament.currentOpponent(roster, m.state);
}

export function modeStage(stages: readonly StageDef[], m: GameMode): StageDef {
  return m.kind === 'story'
    ? story.currentStage(stages, m.state)
    : tournament.currentStage(stages, m.state);
}

export function modeDifficulty(m: GameMode): number {
  return m.kind === 'story'
    ? story.currentDifficulty(m.state)
    : tournament.currentDifficulty(m.state);
}

export function modeScore(m: GameMode): number {
  return m.state.score;
}

export function modeStatus(m: GameMode): ModeStatus {
  return m.state.status;
}

export function modeBoutLabel(m: GameMode): string {
  if (m.kind === 'tournament') return tournament.boutLabel(m.state);
  const index = Math.min(m.state.bout, STORY_BOUT_LABELS.length - 1);
  return STORY_BOUT_LABELS[index];
}

// Pre-built at module load. The story's champion panel has always carried an
// empty subtitle and must keep carrying it (criterion 1); the tournament's
// names the prize the super final was fought for.
const STORY_CHAMPION_SUBTITLE = '';
const TOURNAMENT_CHAMPION_SUBTITLE = 'CINTURÓN NEGRO';

export function modeChampionSubtitle(m: GameMode): string {
  return m.kind === 'story' ? STORY_CHAMPION_SUBTITLE : TOURNAMENT_CHAMPION_SUBTITLE;
}

// Roster first, like every other function that takes one in this folder:
// tournament.winBout needs it to resolve, by weighted draw, the three bouts
// the player does not fight. The story branch ignores both roster and rng.
export function modeWinBout(roster: readonly FighterDef[], m: GameMode, rng: () => number): void {
  if (m.kind === 'story') story.winBout(m.state);
  else tournament.winBout(roster, m.state, rng);
}

export function modeLoseBout(m: GameMode): void {
  if (m.kind === 'story') story.loseBout(m.state);
  else tournament.loseBout(m.state);
}

export function modeAwardDamage(m: GameMode, damage: number): void {
  if (m.kind === 'story') story.awardDamage(m.state, damage);
  else tournament.awardDamage(m.state, damage);
}

export function modeAwardRound(m: GameMode, perfect: boolean): void {
  if (m.kind === 'story') story.awardRound(m.state, perfect);
  else tournament.awardRound(m.state, perfect);
}

// ── CONTINUE ─────────────────────────────────────────────────────────────────
// The countdown belongs to the story alone, but keeping `if (isStory)` in the
// component would put a per-mode branch back in the middle of the bout flow —
// and one of them inside draw(), running every frame. Instead the branch lives
// here, once: the tournament's answers are the inert ones (0 ms left, and
// three no-ops that its own status guards would refuse anyway), so the
// component can call these unconditionally and let modeStatus decide the flow.

export function modeContinueMsLeft(m: GameMode): number {
  return m.kind === 'story' ? m.state.continueMsLeft : 0;
}

export function modeTickContinue(m: GameMode, dtMs: number): void {
  if (m.kind === 'story') story.tickContinue(m.state, dtMs);
}

export function modeAcceptContinue(m: GameMode): void {
  if (m.kind === 'story') story.acceptContinue(m.state);
}

export function modeDeclineContinue(m: GameMode): void {
  if (m.kind === 'story') story.declineContinue(m.state);
}
