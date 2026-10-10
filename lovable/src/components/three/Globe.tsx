import { useMemo, useRef, useState } from "react";
import { useFrame, useLoader } from "@react-three/fiber";
import * as THREE from "three";
import { useNavigate } from "@tanstack/react-router";
import { AUSTIN, PHASE, ease, latLonToVec3, sceneState, seg } from "./sceneState";

const HOTSPOTS = [
  { id: "austin-ev", name: "Austin", sub: "EV charging", lat: 30.2672, lon: -97.7431 },
  { id: "seattle-coffee", name: "Seattle", sub: "Coffee retail", lat: 47.6062, lon: -122.3321 },
  { id: "chicago-bike", name: "Chicago", sub: "Bike-share", lat: 41.8781, lon: -87.6298 },
];

// Ambient city signals (real coordinates, decorative only)
const CITIES: [number, number][] = [
  [40.71, -74.0],
  [34.05, -118.24],
  [51.5, -0.12],
  [48.85, 2.35],
  [35.68, 139.69],
  [19.43, -99.13],
  [-23.55, -46.63],
  [55.75, 37.62],
  [28.61, 77.2],
  [1.35, 103.82],
  [-33.87, 151.21],
  [6.52, 3.38],
  [30.04, 31.24],
  [39.9, 116.4],
  [37.57, 126.98],
  [25.2, 55.27],
  [43.65, -79.38],
  [49.28, -123.12],
  [29.76, -95.37],
  [33.75, -84.39],
  [25.76, -80.19],
  [39.74, -104.99],
  [45.5, -73.57],
  [-34.6, -58.38],
  [52.52, 13.4],
  [41.9, 12.5],
  [59.33, 18.07],
  [-1.29, 36.82],
  [13.75, 100.5],
  [22.32, 114.17],
  [37.77, -122.42],
  [47.6, -122.3],
  [32.78, -96.8],
  [36.17, -115.14],
  [44.98, -93.27],
  [42.36, -71.06],
];

const atmosphereVert = `varying vec3 vN; varying vec3 vP;
void main(){ vN = normalize(normalMatrix*normal); vec4 mv = modelViewMatrix*vec4(position,1.); vP = mv.xyz; gl_Position = projectionMatrix*mv; }`;
const atmosphereFrag = `varying vec3 vN; varying vec3 vP; uniform float uI; uniform vec3 uC;
void main(){ float f = pow(1.0 - abs(dot(normalize(-vP), vN)), 3.0); gl_FragColor = vec4(uC, f*uI); }`;

function targetRotation() {
  const [x, , z] = latLonToVec3(0, AUSTIN.lon);
  return { y: Math.atan2(-x, z), x: (AUSTIN.lat * Math.PI) / 180 };
}

function lerpAngle(a: number, b: number, t: number) {
  const d = ((((b - a) % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
  return a + d * t;
}

export function Globe() {
  const group = useRef<THREE.Group>(null);
  const root = useRef<THREE.Group>(null);
  const earthMat = useRef<THREE.MeshStandardMaterial>(null);
  const atmo = useRef<THREE.ShaderMaterial>(null);
  const spin = useRef(-1.2);
  const [hover, setHover] = useState<string | null>(null);
  const navigate = useNavigate();
  const target = useMemo(targetRotation, []);

  const [map, spec] = useLoader(THREE.TextureLoader, [
    "/textures/earth_atmos_2048.jpg",
    "/textures/earth_specular_2048.jpg",
  ]) as [THREE.Texture, THREE.Texture];
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 4;

  const graticule = useMemo(() => {
    const pts: number[] = [];
    const r = 1.003;
    for (let lat = -60; lat <= 60; lat += 30)
      for (let lon = -180; lon < 180; lon += 3) {
        pts.push(...latLonToVec3(lat, lon, r), ...latLonToVec3(lat, lon + 3, r));
      }
    for (let lon = -180; lon < 180; lon += 30)
      for (let lat = -84; lat < 84; lat += 3) {
        pts.push(...latLonToVec3(lat, lon, r), ...latLonToVec3(lat + 3, lon, r));
      }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    return g;
  }, []);

  const cityPoints = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(
        CITIES.flatMap(([a, b]) => latLonToVec3(a, b, 1.006)),
        3,
      ),
    );
    return g;
  }, []);

  useFrame((state, raw) => {
    const dt = Math.min(raw, 0.05);
    const p = sceneState.p;
    if (root.current) root.current.visible = p < PHASE.veilPeak;
    const d = sceneState.drag;
    if (!sceneState.reduced && p < PHASE.descentStart) spin.current += dt * 0.06;
    if (!d.active) d.velocity *= Math.exp(-3 * dt);
    spin.current += d.velocity * dt;

    const t = ease(seg(p, PHASE.descentStart, PHASE.descentEnd));
    if (group.current) {
      group.current.rotation.y = lerpAngle(spin.current, target.y, t);
      group.current.rotation.x = THREE.MathUtils.lerp(0.25, target.x, t);
    }
    // camera: planetary → regional
    if (p >= PHASE.veilPeak) return;
    const cam = state.camera;
    const dist = THREE.MathUtils.lerp(3.4, 1.18, t);
    const px = sceneState.pointer.x * 0.18 * (1 - t);
    const py = sceneState.pointer.y * 0.12 * (1 - t);
    const shiftX = THREE.MathUtils.lerp(0.55, 0, ease(seg(p, 0.02, PHASE.descentStart + 0.08)));
    cam.position.set(px - shiftX, py + 0.05 * (1 - t), dist);
    cam.lookAt(-shiftX * 0.95, 0, 0);

    if (earthMat.current) earthMat.current.emissiveIntensity = 0.08 + t * 0.25;
    if (atmo.current) atmo.current.uniforms["uI"]!.value = 0.9 + t * 0.8;
  });

  return (
    <group ref={root}>
      <group ref={group}>
        <mesh>
          <sphereGeometry args={[1, sceneState.lite ? 48 : 96, sceneState.lite ? 48 : 96]} />
          <meshStandardMaterial
            ref={earthMat}
            map={map}
            roughnessMap={spec}
            roughness={0.9}
            envMapIntensity={0.08}
            metalness={0.05}
            color="#7f93b3"
            emissive="#0b1a33"
            emissiveIntensity={0.1}
          />
        </mesh>
        <lineSegments geometry={graticule}>
          <lineBasicMaterial color="#9fb6d9" transparent opacity={0.09} />
        </lineSegments>
        <points geometry={cityPoints}>
          <pointsMaterial color="#9db9ff" size={0.012} sizeAttenuation transparent opacity={0.85} />
        </points>
        {HOTSPOTS.map((h) => {
          const pos = latLonToVec3(h.lat, h.lon, 1.008);
          const active = hover === h.id;
          return (
            <group key={h.id} position={pos}>
              <mesh
                onPointerOver={(e) => {
                  e.stopPropagation();
                  setHover(h.id);
                  document.body.style.cursor = "pointer";
                  const t = sceneState.tooltipEl;
                  if (t) {
                    t.dataset["sub"] = h.sub;
                    t.querySelector("[data-name]")!.textContent = `${h.name} — open demo`;
                    t.querySelector("[data-sub]")!.textContent = h.sub;
                    t.style.opacity = "1";
                  }
                }}
                onPointerOut={() => {
                  setHover(null);
                  document.body.style.cursor = "";
                  if (sceneState.tooltipEl) sceneState.tooltipEl.style.opacity = "0";
                }}
                onClick={() => navigate({ to: "/investigations/$id", params: { id: h.id } })}
              >
                <sphereGeometry args={[active ? 0.026 : 0.017, 16, 16]} />
                <meshBasicMaterial color={h.id === "austin-ev" ? "#e6a23c" : "#316bff"} />
              </mesh>
              <mesh>
                <sphereGeometry args={[0.045, 16, 16]} />
                <meshBasicMaterial
                  color="#e6a23c"
                  transparent
                  opacity={active ? 0.25 : 0.0}
                  depthWrite={false}
                />
              </mesh>
            </group>
          );
        })}
      </group>
      <mesh scale={1.12}>
        <sphereGeometry args={[1, 64, 64]} />
        <shaderMaterial
          ref={atmo}
          vertexShader={atmosphereVert}
          fragmentShader={atmosphereFrag}
          uniforms={{ uI: { value: 0.9 }, uC: { value: new THREE.Color("#4f86ff") } }}
          transparent
          side={THREE.BackSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      {/* orbital accents */}
      <mesh rotation={[1.2, 0.3, 0]}>
        <torusGeometry args={[1.55, 0.0012, 8, 200]} />
        <meshBasicMaterial color="#9fb6d9" transparent opacity={0.25} />
      </mesh>
      <mesh rotation={[1.45, -0.5, 0.2]}>
        <torusGeometry args={[1.85, 0.001, 8, 200]} />
        <meshBasicMaterial color="#e6a23c" transparent opacity={0.18} />
      </mesh>
    </group>
  );
}
