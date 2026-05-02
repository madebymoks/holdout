import { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Trail } from '@react-three/drei';
import { Mesh } from 'three';

export interface ProjectileData {
  id: number;
  direction: [number, number, number]; // world-space unit vector captured at fire time
}

interface Props {
  data: ProjectileData;
  onRemove: (id: number) => void;
  onMiss:   () => void;
  meshesMap: React.RefObject<Map<number, Mesh>>;
}

const SPEED = 1.125; // 1.5 reduced by 25%

export default function Projectile({ data, onRemove, onMiss, meshesMap }: Props) {
  const meshRef = useRef<Mesh>(null);

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    // Place 1.5 units in front of camera along the fire direction
    const [dx, dy, dz] = data.direction;
    mesh.position.set(dx * 1.5, dy * 1.5, dz * 1.5);
    meshesMap.current.set(data.id, mesh);
    return () => { meshesMap.current.delete(data.id); };
  }, [data.id, data.direction, meshesMap]);

  useFrame(() => {
    if (!meshRef.current) return;
    const [dx, dy, dz] = data.direction;
    meshRef.current.position.x += dx * SPEED;
    meshRef.current.position.y += dy * SPEED;
    meshRef.current.position.z += dz * SPEED;
    const p = meshRef.current.position;
    if (p.x * p.x + p.y * p.y + p.z * p.z > 10000) {
      onMiss();
      onRemove(data.id);
    }
  });

  return (
    <Trail width={0.35} length={10} color="#ff7700" attenuation={t => t * t * t}>
      <mesh ref={meshRef}>
        <sphereGeometry args={[0.11, 12, 12]} />
        <meshStandardMaterial color="#ffffff" emissive="#ff9900" emissiveIntensity={6} />
      </mesh>
    </Trail>
  );
}
