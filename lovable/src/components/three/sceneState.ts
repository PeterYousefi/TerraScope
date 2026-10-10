/**
 * Mutable, non-React state shared between the GSAP scroll timeline and the
 * R3F frame loop. Mutating this never triggers React renders.
 */
export const sceneState = {
  /** 0 → 1 scroll progress through the pinned cinematic sequence */
  p: 0,
  pointer: { x: 0, y: 0 },
  drag: { active: false, lastX: 0, velocity: 0, offset: 0 },
  reduced: false,
  lite: false,
  /** DOM nodes registered by the overlay; positioned by LabelProjector inside the canvas */
  labelEls: {} as Record<string, HTMLElement | null>,
  tooltipEl: null as HTMLElement | null,
};

export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
/** normalized position of p within [a, b] */
export const seg = (p: number, a: number, b: number) => clamp01((p - a) / (b - a));
export const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
/** 0 outside [a,b], 1 inside, with soft fade edges */
export const band = (p: number, a: number, b: number, f = 0.03) =>
  Math.min(seg(p, a - f, a), 1 - seg(p, b, b + f));

export const PHASE = {
  descentStart: 0.12,
  descentEnd: 0.46,
  veilStart: 0.44,
  veilPeak: 0.5,
  veilEnd: 0.56,
  cityStart: 0.5,
  intelStart: 0.84,
} as const;

export function latLonToVec3(lat: number, lon: number, r = 1): [number, number, number] {
  const phi = ((90 - lat) * Math.PI) / 180;
  const theta = ((lon + 180) * Math.PI) / 180;
  return [-r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(theta)];
}

/** Austin city plane projection (shared by the 3D city and its labels) */
export const AUSTIN = { lat: 30.2672, lon: -97.7431 };
export const CITY_K = 120;
export const toCity = (lon: number, lat: number): [number, number] => [
  (lon - AUSTIN.lon) * CITY_K * Math.cos((AUSTIN.lat * Math.PI) / 180),
  -(lat - AUSTIN.lat) * CITY_K,
];

export interface SceneLabel {
  id: string;
  pos: [number, number, number];
  text: string;
  sub?: string;
  /** visibility 0..1 for a given scroll progress */
  vis: (p: number) => number;
}
