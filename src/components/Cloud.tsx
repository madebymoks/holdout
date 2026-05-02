import { useRef, useMemo } from 'react';
import { Group } from 'three';

export default function Cloud() {
  const groupRef = useRef<Group>(null);

  const boxes = useMemo(() => {
    const count = 3 + Math.floor(Math.random() * 4);
    return Array.from({ length: count }, () => ({
      position: [
        (Math.random() - 0.5) * 40,
        (Math.random() - 0.5) * 20,
        (Math.random() - 0.5) * 20,
      ] as [number, number, number],
      rotation: [
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2,
      ] as [number, number, number],
      scale: 0.1 + Math.random() * 0.9,
    }));
  }, []);

  return (
    <group ref={groupRef}>
      {boxes.map((box, i) => (
        <mesh
          key={i}
          position={box.position}
          rotation={box.rotation}
          scale={box.scale}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[20, 20, 20]} />
          <meshPhongMaterial color="#f0eef0" flatShading />
        </mesh>
      ))}
    </group>
  );
}
