import { useRef, useMemo } from 'react';
import { ShaderMaterial } from 'three';
import { useFrame } from '@react-three/fiber';

const vertexShader = /* glsl */`
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */`
  varying vec2 vUv;

  uniform float uCellSize;   // grid cell size in UV space
  uniform float uLineWidth;  // line half-width in UV space
  uniform vec3  uColor;
  uniform float uOpacity;
  uniform float uFadeRadius; // radial fade start (0–1 UV distance from centre)

  void main() {
    // Centre UVs on 0,0
    vec2 uv = vUv - 0.5;

    // Grid lines — using fract trick
    vec2 grid = abs(fract(vUv / uCellSize - 0.5) - 0.5);
    float line = 1.0 - smoothstep(uLineWidth - 0.001, uLineWidth + 0.001, min(grid.x, grid.y));

    // Radial fade — distance from centre of plane
    float dist = length(uv);                          // 0 at centre, ~0.707 at corner
    float fade = 1.0 - smoothstep(uFadeRadius, 0.5, dist);

    float alpha = line * fade * uOpacity;
    if (alpha < 0.001) discard;
    gl_FragColor = vec4(uColor, alpha);
  }
`;

// How fast a kill's brightness kick fades — tuned so GameCanvas's +0.25
// kick (see KILL_GRID_PULSE) decays back out over roughly 300ms.
const PULSE_DECAY_PER_S = 0.25 / 0.3;

interface Props {
  // Shared mutable ref, bumped by GameCanvas on each kill and decayed here —
  // deliberately not React state, so a kill doesn't trigger a re-render.
  pulseRef?: { current: number };
}

export default function GridFloor({ pulseRef }: Props) {
  const matRef = useRef<ShaderMaterial>(null);

  const uniforms = useMemo(() => ({
    uCellSize:   { value: 0.025 },  // 1/40 of UV = 2.5 units per cell on a 100-unit plane
    uLineWidth:  { value: 0.003 },
    uColor:      { value: [0.0, 0.941, 1.0] }, // #00f0ff cyan
    uOpacity:    { value: 0.35 },
    uFadeRadius: { value: 0.32 },
  }), []);

  // Subtle pulse on the opacity to give the grid a breathing feel, plus a
  // brief brightness kick layered on top for each kill.
  useFrame(({ clock }, delta) => {
    if (!matRef.current) return;
    const base = 0.30 + 0.10 * Math.sin(clock.elapsedTime * 0.6);
    const pulse = pulseRef?.current ?? 0;
    matRef.current.uniforms.uOpacity.value = base + pulse;

    if (pulseRef && pulseRef.current > 0) {
      pulseRef.current = Math.max(0, pulseRef.current - PULSE_DECAY_PER_S * Math.min(delta, 1 / 30));
    }
  });

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.498, 0]}>
      <planeGeometry args={[300, 300, 1, 1]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        transparent
        depthWrite={false}
      />
    </mesh>
  );
}
