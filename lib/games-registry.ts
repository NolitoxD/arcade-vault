import type { KeyMap } from '@/components/MobileGamepad';
import type { SkinTier } from './credits';

export type GameId =
  | 'asteroids'
  | 'tetris'
  | 'arkanoid'
  | 'snake'
  | 'frogger'
  | 'pong'
  | 'road-fighter'
  | 'pacman'
  | 'space-invaders'
  | 'karate-champ';

export type SkinDef = { key: string; label: string; tier: SkinTier };

export type KeyboardControl = {
  keys: string[];
  action: string;
  special?: boolean;
};

export type TouchControls = { keyMap: KeyMap; a?: string; b?: string };

export type GameMeta = {
  id: GameId;
  skins: SkinDef[];
  controls: { keyboard: KeyboardControl[]; touch: TouchControls };
  instructions: { goal: string; tips: string[] };
  realtime: boolean;
};

const CLASSIC_SKINS: SkinDef[] = [
  { key: 'classic', label: 'Classic', tier: 'base' },
  { key: 'retro', label: 'Retro', tier: 'retro' },
  { key: 'neon', label: 'Neon', tier: 'neon' },
];

const TETRIS_SKINS: SkinDef[] = [
  { key: 'retro', label: 'Retro', tier: 'base' },
  { key: 'neon', label: 'Neon', tier: 'neon' },
  { key: 'pastel', label: 'Pastel', tier: 'extra' },
  { key: 'pixel', label: 'Pixel Art', tier: 'extra' },
];

export const GAMES: Record<GameId, GameMeta> = {
  asteroids: {
    id: 'asteroids',
    skins: CLASSIC_SKINS,
    controls: {
      keyboard: [
        { keys: ['←', '→'], action: 'Girar' },
        { keys: ['↑'], action: 'Empuje' },
        { keys: ['Espacio'], action: 'Disparar', special: true },
      ],
      touch: {
        keyMap: {
          up: 'ArrowUp',
          left: 'ArrowLeft',
          right: 'ArrowRight',
          a: ' ',
        },
        a: 'DISPARAR',
      },
    },
    instructions: {
      goal: 'Destruye todos los asteroides sin chocar; los grandes se parten en trozos más rápidos.',
      tips: [
        'Gira y empuja con inercia',
        'La pantalla envuelve por los bordes',
        'Los ovnis dan bonus',
      ],
    },
    realtime: false,
  },
  tetris: {
    id: 'tetris',
    skins: TETRIS_SKINS,
    controls: {
      keyboard: [
        { keys: ['←', '→'], action: 'Mover pieza' },
        { keys: ['↓'], action: 'Bajada suave' },
        { keys: ['↑', 'X'], action: 'Rotar', special: true },
        { keys: ['Espacio'], action: 'Caída rápida', special: true },
      ],
      touch: {
        keyMap: {
          up: 'ArrowUp',
          down: 'ArrowDown',
          left: 'ArrowLeft',
          right: 'ArrowRight',
          a: 'ArrowUp',
          b: ' ',
        },
        a: 'ROTAR',
        b: 'CAÍDA RÁPIDA',
      },
    },
    instructions: {
      goal: 'Encaja las piezas y completa líneas; cada línea suma y el ritmo sube por nivel.',
      tips: [
        'Hard drop para ganar tiempo',
        'Haz tetris (4 líneas) para multiplicar',
        'No dejes huecos bajo las piezas',
      ],
    },
    realtime: false,
  },
  arkanoid: {
    id: 'arkanoid',
    skins: CLASSIC_SKINS,
    controls: {
      keyboard: [{ keys: ['←', '→'], action: 'Mover pala' }],
      touch: { keyMap: { left: 'ArrowLeft', right: 'ArrowRight' } },
    },
    instructions: {
      goal: 'Rompe todos los ladrillos rebotando la bola con la pala sin dejarla caer.',
      tips: [
        'El ángulo depende de dónde golpea la pala',
        'Recoge power-ups',
        'Los ladrillos plateados aguantan dos golpes',
      ],
    },
    realtime: false,
  },
  snake: {
    id: 'snake',
    skins: CLASSIC_SKINS,
    controls: {
      keyboard: [
        { keys: ['↑', '↓', '←', '→', 'W', 'A', 'S', 'D'], action: 'Mover' },
      ],
      touch: { keyMap: { up: 'w', down: 's', left: 'a', right: 'd' } },
    },
    instructions: {
      goal: 'Come fruta para crecer sin chocar contigo ni con los bordes.',
      tips: [
        'Planifica la ruta',
        'Cuanto más largo más lento reaccionas',
        'No gires 180°',
      ],
    },
    realtime: false,
  },
  frogger: {
    id: 'frogger',
    skins: CLASSIC_SKINS,
    controls: {
      keyboard: [
        { keys: ['↑', '↓', '←', '→', 'W', 'A', 'S', 'D'], action: 'Mover' },
      ],
      touch: { keyMap: { up: 'w', down: 's', left: 'a', right: 'd' } },
    },
    instructions: {
      goal: 'Cruza la carretera y el río hasta las cuevas sin que te atropellen ni caigas al agua.',
      tips: [
        'Sube a troncos y tortugas',
        'El tiempo cuenta',
        'Completa las 5 cuevas para subir de nivel',
      ],
    },
    realtime: false,
  },
  pong: {
    id: 'pong',
    skins: CLASSIC_SKINS,
    controls: {
      keyboard: [
        { keys: ['↑', '↓'], action: 'Mover pala' },
        { keys: ['W', 'S'], action: 'Jugador 1 (versus)', special: true },
        { keys: ['↑', '↓'], action: 'Jugador 2 (versus)', special: true },
      ],
      touch: { keyMap: { up: 'ArrowUp', down: 'ArrowDown' } },
    },
    instructions: {
      goal: 'Devuelve la bola y marca 11 puntos antes que el rival.',
      tips: [
        'Golpea con el borde de la pala para cerrar el ángulo',
        'La bola acelera en cada intercambio',
        'Modo 2 jugadores solo con teclado',
      ],
    },
    realtime: true,
  },
  'road-fighter': {
    id: 'road-fighter',
    skins: CLASSIC_SKINS,
    controls: {
      keyboard: [
        { keys: ['←', '→'], action: 'Cambiar de carril' },
        { keys: ['↑'], action: 'Turbo', special: true },
        { keys: ['↓'], action: 'Freno', special: true },
      ],
      touch: {
        keyMap: {
          up: 'ArrowUp',
          down: 'ArrowDown',
          left: 'ArrowLeft',
          right: 'ArrowRight',
        },
      },
    },
    instructions: {
      goal: 'Llega a la meta antes de quedarte sin gasolina esquivando el tráfico.',
      tips: [
        '↑ turbo, ↓ freno',
        'Rozar un coche te hace derrapar — contravolante',
        'Recoge combustible',
      ],
    },
    realtime: true,
  },
  pacman: {
    id: 'pacman',
    skins: CLASSIC_SKINS,
    controls: {
      keyboard: [
        { keys: ['↑', '↓', '←', '→', 'W', 'A', 'S', 'D'], action: 'Mover' },
      ],
      touch: {
        keyMap: {
          up: 'ArrowUp',
          down: 'ArrowDown',
          left: 'ArrowLeft',
          right: 'ArrowRight',
        },
      },
    },
    instructions: {
      goal: 'Come todos los puntos del laberinto huyendo de los 4 fantasmas.',
      tips: [
        'Los power pellets los vuelven azules y comestibles',
        'La fruta del centro da bonus',
        'Usa los túneles laterales',
      ],
    },
    realtime: true,
  },
  'space-invaders': {
    id: 'space-invaders',
    skins: CLASSIC_SKINS,
    controls: {
      keyboard: [
        { keys: ['←', '→', 'A', 'D'], action: 'Mover' },
        { keys: ['Espacio'], action: 'Disparar', special: true },
      ],
      touch: {
        keyMap: { left: 'ArrowLeft', right: 'ArrowRight', a: ' ' },
        a: 'DISPARAR',
      },
    },
    instructions: {
      goal: 'Destruye oleada tras oleada de invasores antes de que lleguen abajo.',
      tips: [
        'Los escudos se desgastan',
        'El bloque acelera al quedar pocos',
        'Caza el UFO para puntuación extra',
      ],
    },
    realtime: true,
  },
  'karate-champ': {
    id: 'karate-champ',
    skins: CLASSIC_SKINS,
    controls: {
      keyboard: [
        { keys: ['←', '→', 'A', 'D'], action: 'Moverse / esquivar' },
        { keys: ['↑', '↓', 'W', 'S'], action: 'Modificador de técnica' },
        {
          keys: ['J', 'Espacio'],
          action: 'Patada (combinar con dirección)',
          special: true,
        },
        { keys: ['K'], action: 'Puño (combinar con dirección)', special: true },
      ],
      touch: {
        keyMap: {
          up: 'ArrowUp',
          down: 'ArrowDown',
          left: 'ArrowLeft',
          right: 'ArrowRight',
          a: 'j',
          b: 'k',
        },
        a: 'PATADA',
        b: 'PUÑO',
      },
    },
    instructions: {
      goal: 'Puntúa con técnicas de karate limpias antes de que lo haga tu rival: las difíciles valen un punto entero, las rápidas medio. Gana el combate a 2 puntos y escala la lista infinita de aspirantes.',
      tips: [
        'Cada técnica tiene su distancia: la voladora cruza el tatami, el puñetazo exige cuerpo a cuerpo',
        'El rival bloquea por alturas — varía alto/medio/bajo',
        'Cada 3 rivales, fase bonus: rompe tablas pulsando en la zona verde',
        'Sin prisa: fallar una técnica te deja vendido durante la recuperación',
      ],
    },
    realtime: true,
  },
};

export const GAME_IDS: GameId[] = Object.keys(GAMES) as GameId[];

export function getGame(id: string): GameMeta | undefined {
  return isGameId(id) ? GAMES[id] : undefined;
}

export function getSkinOptions(id: GameId): SkinDef[] {
  return GAMES[id].skins;
}

export function getKeyMap(id: GameId): KeyMap {
  return GAMES[id].controls.touch.keyMap;
}

export function isGameId(id: string): id is GameId {
  return Object.prototype.hasOwnProperty.call(GAMES, id);
}
