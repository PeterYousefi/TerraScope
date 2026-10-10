import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { Environment, Lightformer, Stars } from "@react-three/drei";
import { Globe } from "./Globe";
import { City } from "./City";
import { LabelProjector } from "./LabelProjector";
import { sceneState } from "./sceneState";

export default function CinematicCanvas() {
  return (
    <Canvas
      dpr={sceneState.lite ? [1, 1.25] : [1, 1.75]}
      camera={{ position: [0, 0, 3.4], fov: 42, near: 0.01, far: 300 }}
      gl={{ antialias: true, powerPreference: "high-performance" }}
    >
      <color attach="background" args={["#070d18"]} />
      <fog attach="fog" args={["#070d18", 30, 110]} />
      <ambientLight intensity={0.35} />
      <directionalLight position={[-4, 3, 5]} intensity={2.4} color="#fff3e0" />
      <directionalLight position={[6, 2, -4]} intensity={0.5} color="#6f8fd6" />
      <Stars
        radius={120}
        depth={40}
        count={sceneState.lite ? 1200 : 3000}
        factor={3}
        fade
        speed={0.3}
      />
      <Environment resolution={64}>
        <Lightformer intensity={1.2} position={[0, 5, 0]} scale={[10, 10, 1]} />
        <Lightformer
          intensity={0.6}
          color="#8bb0ff"
          position={[-5, 1, -1]}
          rotation-y={Math.PI / 2}
          scale={[20, 1, 1]}
        />
      </Environment>
      <Suspense fallback={null}>
        <Globe />
      </Suspense>
      <City />
      <LabelProjector />
    </Canvas>
  );
}
