import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group } from 'three';
import Cloud from './Cloud';

export default function Sky() {
  const skyGroup = useRef<Group>(null);

  const clouds = useMemo(() => {
    // Distribute clouds over the front-facing 180° arc (cos(a) < 0 → z < 0 → in front of camera)
    const stepAngle = Math.PI / 19;
    return Array.from({ length: 20 }, (_, i) => {
      const a = Math.PI / 2 + stepAngle * i;
      const h = 750 + Math.random() * 200;
      const s = 1 + Math.random() * 2;
      return {
        position: [
          -400 - Math.random() * 400,
          Math.sin(a) * h,
          Math.cos(a) * h,
        ] as [number, number, number],
        rotation: [a + Math.PI / 2, 0, 0] as [number, number, number],
        scale: [s, s, s] as [number, number, number],
      };
    });
  }, []);

  useFrame(() => {
    if (skyGroup.current) {
      skyGroup.current.rotation.x += 0.002;
    }
  });

  return (
    <group ref={skyGroup} position={[600, -450, -300]}>
      {clouds.map((cloud, i) => (
        <group
          key={i}
          position={cloud.position}
          rotation={cloud.rotation}
          scale={cloud.scale}
        >
          <Cloud />
        </group>
      ))}
    </group>
  );
}
