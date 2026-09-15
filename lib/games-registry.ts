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
  | 'karate-champ'
  | 'kong'
  | 'bubble'
  | 'vault-fighter'
  | 'vault-world-cup';

export type SkinDef = { key: string; label: string; tier: SkinTier };

export type KeyboardControl = {
  keys: string[];
  action: string;
  special?: boolean;
};

export type TouchControls = { keyMap: KeyMap; a?: string; b?: string; c?: string };

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
  kong: {
    id: 'kong',
    skins: CLASSIC_SKINS,
    controls: {
      keyboard: [
        { keys: ['←', '→', 'A', 'D'], action: 'Correr por la viga' },
        { keys: ['↑', '↓', 'W', 'S'], action: 'Trepar escaleras' },
        {
          keys: ['Espacio', 'J'],
          action: 'Saltar (100 pts por barril saltado)',
          special: true,
        },
      ],
      touch: {
        keyMap: {
          up: 'ArrowUp',
          down: 'ArrowDown',
          left: 'ArrowLeft',
          right: 'ArrowRight',
          a: ' ',
        },
        a: 'SALTAR',
      },
    },
    instructions: {
      goal: 'Sube el zigzag de vigas hasta el trofeo dorado esquivando los barriles de Kong: salta lo que ruede hacia ti, trepa rápido y no te entretengas — el bonus de tiempo cae cada segundo.',
      tips: [
        'Saltar un barril da 100 puntos — saltar en el sitio también cuenta si te pasa por debajo',
        'El martillo destruye barriles 8 segundos, pero no deja saltar ni trepar',
        'Las escaleras rotas suben pero no bajan — y los barriles no las usan',
        'Cada trofeo endurece a Kong: más barriles, más rápidos y más listos',
      ],
    },
    realtime: true,
  },
  bubble: {
    id: 'bubble',
    skins: CLASSIC_SKINS,
    controls: {
      keyboard: [
        { keys: ['←', '→', 'A', 'D'], action: 'Apuntar el cañón' },
        { keys: ['Espacio', 'J'], action: 'Disparar', special: true },
        {
          keys: ['↓', 'S'],
          action: 'Cambiar por la burbuja siguiente',
          special: true,
        },
      ],
      touch: {
        keyMap: {
          left: 'ArrowLeft',
          right: 'ArrowRight',
          a: ' ',
          b: 'ArrowDown',
        },
        a: 'DISPARAR',
        b: 'CAMBIAR',
      },
    },
    instructions: {
      goal: 'Junta 3 o más burbujas del mismo color para reventarlas y derriba todo lo que quede colgando: el techo baja cada pocos disparos y si el racimo cruza la línea roja pierdes una vida. Vacía los 8 mapas para terminar el juego.',
      tips: [
        'Rebota en las paredes laterales para llegar a los huecos imposibles — el techo no rebota',
        'Lo que puntúa de verdad es desprender: revienta el enganche y arrastra el racimo entero',
        'Cada mapa esconde una burbuja mágica: hay que reventarla dentro de un grupo de 3, no vale tocarla',
        'Con ↓ cambias la burbuja actual por la siguiente antes de disparar',
      ],
    },
    realtime: true,
  },
  'vault-fighter': {
    id: 'vault-fighter',
    skins: CLASSIC_SKINS,
    controls: {
      keyboard: [
        { keys: ['→', 'D'], action: 'Avanzar hacia el rival' },
        { keys: ['←', 'A'], action: 'Retroceder y bloquear (mantener)' },
        { keys: ['↓', 'S'], action: 'Agacharse (mantener)' },
        { keys: ['J', 'Espacio'], action: 'Patada', special: true },
        { keys: ['K'], action: 'Puño', special: true },
        { keys: ['L'], action: 'Magia (con la barra llena)', special: true },
      ],
      touch: {
        keyMap: {
          up: 'ArrowUp',
          down: 'ArrowDown',
          left: 'ArrowLeft',
          right: 'ArrowRight',
          a: 'j',
          b: 'k',
          c: 'l',
        },
        a: 'PATADA',
        b: 'PUÑO',
        c: 'MAGIA',
      },
    },
    instructions: {
      goal: 'Elige tu luchador y entra al Vault: en HISTORIA derrotas a los 8 rivales uno tras otro, con CONTINUE si caes; en TORNEO disputas un cuadro de 4 combates sin red que remata contra EL ARQUITECTO por el cinturón negro. Cada combate se decide al mejor de 5 asaltos.',
      tips: [
        'Mantén ← para retroceder y bloquear a la vez — no puedes atacar mientras bloqueas',
        '→ te acerca al rival, ← te aleja bloqueando: elige tu distancia',
        'Agáchate con ↓ para esquivar los golpes altos',
        'El tercer botón (C, tecla L) lanza tu magia en cuanto la barra se llena',
        'En TORNEO no hay CONTINUE: perder cualquier combate te saca del cuadro',
      ],
    },
    realtime: true,
  },
  'vault-world-cup': {
    id: 'vault-world-cup',
    skins: CLASSIC_SKINS,
    controls: {
      keyboard: [
        { keys: ['↑', '↓', '←', '→', 'W', 'A', 'S', 'D'], action: 'Mover / apuntar los saques automáticos (solo y Mundial)' },
        { keys: ['1', '2', '3'], action: 'Alineación: 3-3-2 / 3-2-3 / 4-3-1' },
        { keys: ['4', '5', '6'], action: 'Estrategia: ataque / neutral / defensa' },
        { keys: ['P'], action: 'Pausa' },
        { keys: ['R'], action: 'Salir del entrenamiento / reiniciar tras el Mundial' },
        { keys: ['W', 'A', 'S', 'D'], action: 'A dos · J1: mover' },
        { keys: ['C', 'V', 'B'], action: 'A dos · J1: A chut · B pase · C sprint' },
        { keys: ['1', '2', '3', '4', '5', '6'], action: 'A dos · J1: alineación (1-3) y estrategia (4-6)' },
        { keys: ['↑', '↓', '←', '→'], action: 'A dos · J2: mover' },
        { keys: ['J', 'K', 'L'], action: 'A dos · J2: A chut · B pase · C sprint' },
        { keys: ['7', '8', '9'], action: 'A dos · J2: alineación' },
        { keys: ['0', '\'', '¡'], action: 'A dos · J2: estrategia' },
        { keys: ['J'], action: 'A: chut o entrada al suelo (mantener = más fuerte) · solo y Mundial', special: true },
        { keys: ['K'], action: 'B: pase corto o robo de pie (mantener = pase largo) · solo y Mundial', special: true },
        { keys: ['L'], action: 'C: sprint en ráfaga · solo y Mundial', special: true },
      ],
      // Desktop-only (spec): this game never renders MobileGamepad, so there is
      // no touch key to declare. An empty object is a valid KeyMap (all of its
      // fields are optional) and getKeyMap('vault-world-cup') is never called from
      // any page -- pinned by the Task 10-1 test.
      touch: { keyMap: {} },
    },
    instructions: {
      goal: 'Elige uno de los cuatro modos y llévate el balón: en AMISTOSO ganas un partido a la CPU o a otro jugador en tu mismo teclado, en ENTRENAMIENTO practicas sin reloj ni marcador contra un rival congelado, y en MUNDIAL disputas cuartos, semifinal y final en un cuadro de ocho selecciones sorteadas de dieciséis, la tuya entre ellas, sin CONTINUE. Solo el Mundial apunta en la tabla.',
      tips: [
        'A chuta o entra al suelo; mantén pulsado para un chut más fuerte',
        'B pasa corto al pulsar o roba de pie; mantenlo pulsado para un pase largo',
        'C sprinta en ráfaga con recuperación, con o sin balón',
        '1, 2 y 3 cambian tu alineación (3-3-2 / 3-2-3 / 4-3-1); 4, 5 y 6 tu estrategia (ataque / neutral / defensa), en pleno partido',
        'P pausa el partido · R sale del ENTRENAMIENTO y reinicia tras el Mundial; el juego solo se juega en escritorio, con ventana suficiente',
        'AMISTOSO a dos en el mismo teclado: J1 con WASD + C/V/B, J2 con flechas + J/K/L; alineación y estrategia en 1-6 (J1) y 7-9 / 0 \' ¡ (J2)',
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
