import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { investigations } from "@/lib/demo/fixtures";
import { PHASE, ease, sceneState, seg, toCity } from "./sceneState";
import { SOURCE_NODES } from "./cityLabels";

const austin = investigations[0]!;

function rng(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

// Lady Bird Lake / Colorado River approximation (z as a function of x)
const riverZ = (x: number) => 0.9 + Math.sin(x * 0.18) * 0.9 + x * 0.05;
// I-35 runs roughly NNE through downtown; MoPac to the west; US-183 diagonal north
const ROADS: [number, number][][] = [
  [[3.5, 14], [1.2, 2], [1.6, -6], [3.2, -18]],
  [[-4.6, 12], [-3.6, 2], [-4.2, -8], [-2.5, -20]],
  [[-12, -22], [-2, -17], [6, -14], [10, -4], [12, 6]],
  [[-14, 8], [-4, 9.5], [6, 8.5], [16, 10]],
];

function makeGroundTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 1024;
  const g = c.getContext("2d")!;
  g.fillStyle = "#0b1422";
  g.fillRect(0, 0, 1024, 1024);
  g.strokeStyle = "rgba(140,170,220,0.07)";
  g.lineWidth = 1;
  for (let i = 0; i <= 1024; i += 16) {
    g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 1024); g.stroke();
    g.beginPath(); g.moveTo(0, i); g.lineTo(1024, i); g.stroke();
  }
  // topographic contours
  g.strokeStyle = "rgba(160,190,230,0.06)";
  for (let r = 40; r < 900; r += 38) {
    g.beginPath();
    for (let a = 0; a <= Math.PI * 2 + 0.1; a += 0.05) {
      const rr = r + Math.sin(a * 3 + r) * 14 + Math.cos(a * 5) * 8;
      const x = 300 + Math.cos(a) * rr, y = 700 + Math.sin(a) * rr * 0.8;
      a === 0 ? g.moveTo(x, y) : g.lineTo(x, y);
    }
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function Buildings() {
  const ref = useRef<THREE.InstancedMesh>(null);
  const data = useMemo(() => {
    const r = rng(42);
    const out: { x: number; z: number; w: number; d: number; h: number }[] = [];
    const step = sceneState.lite ? 1.1 : 0.72;
    for (let x = -22; x <= 22; x += step)
      for (let z = -24; z <= 18; z += step) {
        if (Math.abs(z - riverZ(x)) < 0.9) continue;
        const ix = Math.round(x / step), iz = Math.round(z / step);
        if (ix % 5 === 0 || iz % 5 === 0) continue; // street grid
        const dist = Math.hypot(x * 1.1, (z + 1.2) * 1.3);
        const density = Math.exp(-dist / 6.5);
        if (r() > 0.25 + density * 0.9 - dist * 0.008) continue;
        const h = 0.08 + density * (0.5 + r() * 3.6) + r() * 0.18 + (dist < 2.8 ? r() * 2.5 : 0);
        out.push({ x, z, w: step * (0.55 + r() * 0.3), d: step * (0.55 + r() * 0.3), h });
      }
    return out;
  }, []);

  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    data.forEach((b, i) => {
      m.compose(new THREE.Vector3(b.x, b.h / 2, b.z), q, new THREE.Vector3(b.w, b.h, b.d));
      ref.current!.setMatrixAt(i, m);
    });
    ref.current!.instanceMatrix.needsUpdate = true;
  }, [data]);

  useFrame(() => {
    if (!ref.current) return;
    const g = ease(seg(sceneState.p, PHASE.cityStart, PHASE.cityStart + 0.12));
    ref.current.scale.y = 0.02 + g * 0.98;
  });

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, data.length]} castShadow receiveShadow>
      <boxGeometry />
      <meshStandardMaterial color="#1d2b44" roughness={0.6} metalness={0.25} emissive="#0e1a30" emissiveIntensity={0.6} />
    </instancedMesh>
  );
}

function Roads() {
  const mat = useRef<THREE.MeshBasicMaterial>(null);
  const tubes = useMemo(
    () => ROADS.map((pts) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(([x, z]) => new THREE.Vector3(x, 0.04, z))), 120, 0.06, 6)),
    [],
  );
  useFrame(() => {
    if (mat.current) mat.current.opacity = 0.15 + 0.75 * seg(sceneState.p, 0.7, 0.75);
  });
  return (
    <group>
      {tubes.map((g, i) => (
        <mesh key={i} geometry={g}>
          <meshBasicMaterial ref={(m: THREE.MeshBasicMaterial | null) => { if (i === 0) mat.current = m; }} color="#7aa2ff" transparent opacity={0.6} />
        </mesh>
      ))}
    </group>
  );
}

function Layers() {
  const existing = austin.layers.find((l) => l.id === "existing")!;
  const demand = austin.layers.find((l) => l.id === "demand")!;
  const gaps = austin.layers.find((l) => l.id === "gap")!;
  const refs = useRef<{ ex: THREE.Group[]; de: THREE.Mesh[]; gap: THREE.Mesh[]; cand: THREE.Group[]; links: THREE.Mesh[] }>({ ex: [], de: [], gap: [], cand: [], links: [] });
  const sourceNodes = SOURCE_NODES.map((n) => ({ s: n.s, pos: new THREE.Vector3(...n.pos) }));

  const links = useMemo(() => {
    const out: { geo: THREE.TubeGeometry }[] = [];
    austin.candidates.forEach((c) => {
      const [x, z] = toCity(...c.coords);
      c.evidenceIds.forEach((eid) => {
        const ev = austin.evidence.find((e) => e.id === eid)!;
        const node = sourceNodes.find((n) => n.s.id === ev.sourceId)!;
        const a = new THREE.Vector3(x, 2.2, z);
        const mid = a.clone().lerp(node.pos, 0.5).add(new THREE.Vector3(0, 2, 0));
        out.push({ geo: new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(a, mid, node.pos), 40, 0.025, 5) });
      });
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFrame((state) => {
    const p = sceneState.p;
    const time = state.clock.elapsedTime;
    const r = refs.current;
    const ex = ease(seg(p, 0.6, 0.65));
    const observe = seg(p, PHASE.intelStart, PHASE.intelStart + 0.04);
    r.ex.forEach((g, i) => g.scale.setScalar(Math.max(0.001, ex * (1 + observe * 0.4 * (0.5 + 0.5 * Math.sin(time * 3 + i))))));
    const de = ease(seg(p, 0.65, 0.71));
    r.de.forEach((m, i) => { m.scale.y = Math.max(0.001, de * ((demand.points[i]?.value ?? 50) / 20)); m.position.y = m.scale.y / 2; });
    const gp = ease(seg(p, 0.75, 0.8));
    r.gap.forEach((m, i) => { const s = gp * (1 + 0.15 * Math.sin(time * 2 + i)); m.scale.set(s, s, s); });
    const cd = ease(seg(p, 0.79, 0.84));
    const inv = ease(seg(p, 0.89, 0.93));
    r.cand.forEach((g, i) => { g.scale.set(Math.max(0.001, cd), Math.max(0.001, cd * (1 + inv * (4 - i) * 0.35)), Math.max(0.001, cd)); });
    const ver = ease(seg(p, 0.94, 0.98));
    r.links.forEach((m) => { (m.material as THREE.MeshBasicMaterial).opacity = ver * 0.85; m.visible = ver > 0.01; });
  });

  return (
    <group>
      {existing.points.map((pt, i) => {
        const [x, z] = toCity(...pt.coords);
        return (
          <group key={pt.label} position={[x, 0, z]} ref={(g) => { if (g) refs.current.ex[i] = g; }}>
            <mesh position={[0, 0.35, 0]}>
              <cylinderGeometry args={[0.12, 0.12, 0.7, 12]} />
              <meshStandardMaterial color="#cfd9ea" emissive="#cfd9ea" emissiveIntensity={0.5} />
            </mesh>
            <mesh rotation-x={-Math.PI / 2} position={[0, 0.03, 0]}>
              <ringGeometry args={[1.6, 1.68, 48]} />
              <meshBasicMaterial color="#cfd9ea" transparent opacity={0.35} />
            </mesh>
          </group>
        );
      })}
      {demand.points.map((pt, i) => {
        const [x, z] = toCity(...pt.coords);
        return (
          <group key={pt.label} position={[x, 0, z]}>
            <mesh ref={(m) => { if (m) refs.current.de[i] = m; }}>
              <cylinderGeometry args={[0.55, 0.7, 1, 24, 1, true]} />
              <meshBasicMaterial color="#316bff" transparent opacity={0.32} side={THREE.DoubleSide} depthWrite={false} />
            </mesh>
            <mesh rotation-x={-Math.PI / 2} position={[0, 0.02, 0]}>
              <circleGeometry args={[2.4, 40]} />
              <meshBasicMaterial color="#316bff" transparent opacity={0.08} depthWrite={false} />
            </mesh>
          </group>
        );
      })}
      {gaps.points.map((pt, i) => {
        const [x, z] = toCity(...pt.coords);
        return (
          <mesh key={pt.label} position={[x, 0.05, z]} rotation-x={-Math.PI / 2} ref={(m) => { if (m) refs.current.gap[i] = m; }}>
            <ringGeometry args={[2.2, 2.45, 64]} />
            <meshBasicMaterial color="#e6a23c" transparent opacity={0.7} />
          </mesh>
        );
      })}
      {austin.candidates.map((c, i) => {
        const [x, z] = toCity(...c.coords);
        return (
          <group key={c.id} position={[x, 0, z]}>
            <group ref={(g) => { if (g) refs.current.cand[i] = g; }}>
              <mesh position={[0, 1.1, 0]}>
                <cylinderGeometry args={[0.09, 0.09, 2.2, 10]} />
                <meshStandardMaterial color="#e6a23c" emissive="#e6a23c" emissiveIntensity={1.4} />
              </mesh>
              <mesh position={[0, 2.25, 0]}>
                <octahedronGeometry args={[0.28]} />
                <meshStandardMaterial color="#ffd38a" emissive="#e6a23c" emissiveIntensity={1.2} />
              </mesh>
            </group>
          </group>
        );
      })}
      {sourceNodes.map((n) => (
        <group key={n.s.id} position={n.pos}>
          <mesh>
            <boxGeometry args={[0.5, 0.5, 0.5]} />
            <meshStandardMaterial color="#cfd9ea" emissive="#316bff" emissiveIntensity={0.6} />
          </mesh>
        </group>
      ))}
      {links.map((l, i) => (
        <mesh key={i} geometry={l.geo} ref={(m) => { if (m) refs.current.links[i] = m; }} visible={false}>
          <meshBasicMaterial color="#e6a23c" transparent opacity={0} />
        </mesh>
      ))}
    </group>
  );
}

export function City() {
  const root = useRef<THREE.Group>(null);
  const ground = useMemo(makeGroundTexture, []);
  const water = useMemo(() => {
    const pts: THREE.Vector2[] = [];
    for (let x = -24; x <= 24; x += 1) pts.push(new THREE.Vector2(x, riverZ(x) - 0.45));
    for (let x = 24; x >= -24; x -= 1) pts.push(new THREE.Vector2(x, riverZ(x) + 0.45));
    return new THREE.ShapeGeometry(new THREE.Shape(pts));
  }, []);

  useFrame((state) => {
    const p = sceneState.p;
    if (root.current) root.current.visible = p > PHASE.veilPeak - 0.005;
    if (p < PHASE.veilPeak) return;
    const cam = state.camera;
    // descent: overhead → oblique → orbit for the intelligence layer
    const a = ease(seg(p, PHASE.cityStart, 0.82));
    const b = ease(seg(p, PHASE.intelStart, 1));
    const pos = new THREE.Vector3().lerpVectors(new THREE.Vector3(0, 46, 6), new THREE.Vector3(16, 14, 18), a);
    pos.lerp(new THREE.Vector3(-6, 20, 22), b);
    pos.x += sceneState.pointer.x * 0.8;
    pos.y += sceneState.pointer.y * 0.4;
    cam.position.copy(pos);
    const look = new THREE.Vector3().lerpVectors(new THREE.Vector3(0, 0, -1), new THREE.Vector3(1, 0, -5), a);
    look.lerp(new THREE.Vector3(1, 2.5, -6), b);
    cam.lookAt(look);
  });

  return (
    <group ref={root} visible={false}>
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[80, 80]} />
        <meshStandardMaterial map={ground} roughness={0.95} />
      </mesh>
      <mesh geometry={water} rotation-x={Math.PI / 2} position={[0, 0.015, 0]}>
        <meshStandardMaterial color="#14305c" roughness={0.2} metalness={0.4} side={THREE.DoubleSide} />
      </mesh>
      <Buildings />
      <Roads />
      <Layers />
    </group>
  );
}
