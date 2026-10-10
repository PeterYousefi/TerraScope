import { investigations } from "@/lib/demo/fixtures";
import { seg, toCity, type SceneLabel } from "./sceneState";

const austin = investigations[0];
const pos = (lon: number, lat: number, y: number): [number, number, number] => {
  const [x, z] = toCity(lon, lat);
  return [x, y, z];
};
const fadeOut = (p: number) => 1 - seg(p, 0.84, 0.86);
const ex = austin.layers[0]!.points[0]!;
const de = austin.layers[1]!.points[0]!;

export const SOURCE_NODES = austin.sources.map((s, i) => ({ s, pos: [-9 + i * 6, 7.5, -10] as [number, number, number] }));

export const CITY_LABELS: SceneLabel[] = [
  { id: "cov", pos: pos(...ex.coords, 0.8), text: "Charging coverage", sub: "sample layer", vis: (p) => seg(p, 0.61, 0.64) * fadeOut(p) },
  { id: "dens", pos: pos(...de.coords, 4.5), text: "Activity density", sub: "demand proxy", vis: (p) => seg(p, 0.67, 0.7) * fadeOut(p) },
  { id: "acc", pos: [1.4, 0.3, -6], text: "Accessibility signal", sub: "I-35 corridor", vis: (p) => seg(p, 0.72, 0.75) * fadeOut(p) },
  ...austin.candidates.map((c, i) => ({
    id: `cand-${c.id}`,
    pos: pos(...c.coords, 2.6),
    text: i === 0 ? "Candidate zone" : `Candidate 0${c.rank}`,
    sub: c.neighborhood,
    vis: (p: number) => seg(p, 0.8 + i * 0.01, 0.83 + i * 0.01),
  })),
  ...SOURCE_NODES.map((n) => ({ id: `src-${n.s.id}`, pos: n.pos, text: n.s.publisher, sub: "Source ref · not fetched", vis: (p: number) => seg(p, 0.945, 0.97) })),
  { id: "verified", pos: [-9, 9.2, -10] as [number, number, number], text: "Source verified?", sub: "demo — references only", vis: (p: number) => seg(p, 0.96, 0.99) },
];
