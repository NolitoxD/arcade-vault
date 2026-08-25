export type Dir = 'neutral' | 'up' | 'down' | 'forward';
export type TechButton = 'a' | 'b';
export type Height = 'high' | 'mid' | 'low';

export type Technique = {
  id: string;
  input: { dir: Dir; button: TechButton };
  name: string;
  points: 0.5 | 1;
  range: number;
  startupMs: number;
  recoveryMs: number;
  height: Height;
};

// spec 25 "Tabla de técnicas": half-point techniques are the fast/cheap
// ones, full-point techniques are the slow/committal ones. startupMs keeps
// every full-point value strictly above every half-point value; recoveryMs
// scales with startupMs so a missed full-point technique leaves a bigger
// punish window, per the instructions tip "fallar una técnica te deja
// vendido durante la recuperación".
export const TECHNIQUES: Technique[] = [
  {
    id: 'punetazo',
    input: { dir: 'neutral', button: 'b' },
    name: 'Puñetazo',
    points: 0.5,
    range: 40,
    startupMs: 120,
    recoveryMs: 160,
    height: 'mid',
  },
  {
    id: 'punetazo-bajo',
    input: { dir: 'down', button: 'b' },
    name: 'Puñetazo bajo',
    points: 0.5,
    range: 45,
    startupMs: 140,
    recoveryMs: 190,
    height: 'low',
  },
  {
    id: 'patada-frontal',
    input: { dir: 'neutral', button: 'a' },
    name: 'Patada frontal',
    points: 0.5,
    range: 55,
    startupMs: 150,
    recoveryMs: 200,
    height: 'mid',
  },
  {
    id: 'barrido',
    input: { dir: 'down', button: 'a' },
    name: 'Barrido',
    points: 0.5,
    range: 35,
    startupMs: 200,
    recoveryMs: 260,
    height: 'low',
  },
  {
    id: 'golpe-con-salto',
    input: { dir: 'forward', button: 'b' },
    name: 'Golpe con salto',
    points: 1,
    range: 65,
    startupMs: 300,
    recoveryMs: 400,
    height: 'mid',
  },
  {
    id: 'golpe-alto',
    input: { dir: 'up', button: 'b' },
    name: 'Golpe alto',
    points: 1,
    range: 55,
    startupMs: 320,
    recoveryMs: 420,
    height: 'high',
  },
  {
    id: 'patada-alta',
    input: { dir: 'up', button: 'a' },
    name: 'Patada alta',
    points: 1,
    range: 85,
    startupMs: 340,
    recoveryMs: 450,
    height: 'high',
  },
  {
    id: 'patada-voladora',
    input: { dir: 'forward', button: 'a' },
    name: 'Patada voladora',
    points: 1,
    range: 90,
    startupMs: 420,
    recoveryMs: 520,
    height: 'high',
  },
];

export function resolveTechnique(dir: Dir, button: TechButton): Technique {
  const t = TECHNIQUES.find((tech) => tech.input.dir === dir && tech.input.button === button);
  if (!t) throw new Error(`No technique for ${dir}+${button}`);
  return t;
}

export type FighterState = {
  x: number;
  facing: 1 | -1;
  blockingHeight: Height | null;
  busyUntilMs: number;
};

export function landsHit(
  attacker: FighterState,
  defender: FighterState,
  t: Technique,
  nowMs: number,
): boolean {
  if (attacker.busyUntilMs > nowMs) return false;
  const distance = Math.abs(defender.x - attacker.x);
  if (distance > t.range) return false;
  if (defender.blockingHeight === t.height) return false;
  return true;
}
