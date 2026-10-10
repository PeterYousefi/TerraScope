import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { CITY_LABELS } from "./cityLabels";
import { PHASE, sceneState } from "./sceneState";

const v = new THREE.Vector3();

/** Projects 3D anchor points to screen space and writes to DOM overlay nodes (no React renders). */
export function LabelProjector() {
  useFrame(({ camera, size }) => {
    const p = sceneState.p;
    const inCity = p >= PHASE.veilPeak;
    for (const l of CITY_LABELS) {
      const el = sceneState.labelEls[l.id];
      if (!el) continue;
      const o = inCity ? l.vis(p) : 0;
      if (o <= 0.001) { el.style.opacity = "0"; continue; }
      v.set(...l.pos).project(camera);
      const behind = v.z > 1;
      const x = (v.x * 0.5 + 0.5) * size.width;
      const y = (-v.y * 0.5 + 0.5) * size.height;
      el.style.opacity = behind ? "0" : String(o);
      el.style.transform = `translate3d(${x}px, ${y + (1 - o) * 8}px, 0)`;
    }
  });
  return null;
}
