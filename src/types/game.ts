export type GameState = 'READY' | 'PLAYING' | 'PAUSED' | 'GAME_OVER' | 'AD_BREAK';

export interface RunRecord {
  id: string;
  name: string;
  score: number;
  continued: boolean;
  timestamp: number;
}

export interface PipePair {
  x: number;
  gapTop: number;
  gapHeight: number;
  scored: boolean;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
}
