export interface CharacterSkin {
  id: number;
  name: string;
  title: string;
  description: string;
  badge: string;
}

export const CHARACTER_SKINS: CharacterSkin[] = [
  {
    id: 0,
    name: 'Clara',
    title: 'Cuidadora Atenta',
    description: 'Empática e ágil, com colete VIRLA e mochila de primeiros cuidados.',
    badge: '💜',
  },
  {
    id: 1,
    name: 'Lucas',
    title: 'Cuidador Dedicado',
    description: 'Organizado e prestativo, com colete VIRLA, boné e prancheta de rotina.',
    badge: '🌸',
  },
  {
    id: 2,
    name: 'Mariana',
    title: 'Cuidadora Afetuosa',
    description: 'Comunicativa e acolhedora, com colete VIRLA e detalhes rosa vibrante.',
    badge: '✨',
  },
];

export interface ElderlyNPC {
  id: string;
  name: string;
  type: 'jorge' | 'lucia' | 'celina';
  quote: string;
  thankQuote: string;
  x: number;
  y: number;
  width: number;
  height: number;
  state: 'waiting' | 'escorted' | 'safe';
  destinationX: number;
  destinationY: number;
  walkSpeed: number;
  facing: 1 | -1;
  walkFrame: number;
}

export interface Enemy {
  id: string;
  type: 'baguncudo' | 'boateiro' | 'sombra';
  name: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  patrolLeft: number;
  patrolRight: number;
  width: number;
  height: number;
  alive: boolean;
  shootCooldown: number;
  message: string;
}

export interface Projectile {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  text: string;
  duration: number;
}

export interface Mechanism {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  activated: boolean;
  label: string;
  type: 'binder' | 'antenna' | 'lantern';
  message: string;
}

export interface HeartItem {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  collected: boolean;
}

export interface CheckpointFlag {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  activated: boolean;
}

export interface HazardArea {
  x: number;
  y: number;
  width: number;
  height: number;
  type: 'puddle' | 'pit';
}

export interface PlatformBlock {
  x: number;
  y: number;
  width: number;
  height: number;
  type: 'solid' | 'moving';
  vx?: number;
  minX?: number;
  maxX?: number;
}

export interface LevelDefinition {
  id: string;
  number: number;
  name: string;
  subtitle: string;
  theme: string;
  introMessage: string;
  completionMessage: string;
  width: number;
  height: number;
  spawnPoint: { x: number; y: number };
  shelterPoint: { x: number; y: number };
  platforms: PlatformBlock[];
  hazards: HazardArea[];
  mechanisms: Mechanism[];
  hearts: HeartItem[];
  elderly: ElderlyNPC[];
  enemies: Enemy[];
  checkpoints: CheckpointFlag[];
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
  text?: string;
}

export interface ShieldWave {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  life: number;
  maxLife: number;
}
