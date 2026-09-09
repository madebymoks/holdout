import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, BufferAttribute, Points } from 'three';

// Fewer motes on low-end hardware — this is pure ambience, never worth
// risking the 60fps budget on mid-range Android for.
const PARTICLE_COUNT = (() => {
  try {
    return (navigator.hardwareConcurrency ?? 8) <= 4 ? 150 : 400;
  } catch {
    return 400;
  }
})();

const RADIUS      = 30;   // ~60 units across, comfortably inside the 60-unit floor half-extent
const Y_MIN        = -1.5; // floor level
const Y_MAX        = 15;
const DRIFT_SPEED  = 0.12; // units/sec, upward
const ROTATE_SPEED = 0.015; // rad/sec, whole field

export default function DustMotes() {
  const pointsRef = useRef<Points>(null);

  const positions = useMemo(() => {
    const arr = new Float32Array(PARTICLE_COUNT * 3);
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const r = RADIUS * Math.sqrt(Math.random()); // uniform over the disc, not clumped at centre
      const theta = Math.random() * Math.PI * 2;
      arr[i * 3]     = Math.cos(theta) * r;
      arr[i * 3 + 1] = Y_MIN + Math.random() * (Y_MAX - Y_MIN);
      arr[i * 3 + 2] = Math.sin(theta) * r;
    }
    return arr;
  }, []);

  useFrame((_state, delta) => {
    const points = pointsRef.current;
    if (!points) return;

    // Clamp so a stalled/first frame can't jump particles or spin the field.
    const dt = Math.min(delta, 1 / 30);
    points.rotation.y += ROTATE_SPEED * dt;

    const posAttr = points.geometry.attributes.position as BufferAttribute;
    const arr = posAttr.array as Float32Array;
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const yi = i * 3 + 1;
      arr[yi] += DRIFT_SPEED * dt;
      if (arr[yi] > Y_MAX) arr[yi] = Y_MIN;
    }
    posAttr.needsUpdate = true;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.15}
        color="#bfeeff"
        transparent
        opacity={0.25}
        blending={AdditiveBlending}
        depthWrite={false}
        sizeAttenuation
      />
    </points>
  );
}
