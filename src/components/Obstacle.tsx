import { forwardRef, useRef, useState, useImperativeHandle } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group, Mesh } from 'three';

export interface ObstacleHandle {
  group: Group;
  explode: () => void;
}

interface ObstacleProps {
  position: [number, number, number];
  scale?: number;
  onExplosionComplete?: () => void;
}

interface Particle {
  vx: number;
  vy: number;
  vz: number;
}

function generateParticles(): Particle[] {
  return Array.from({ length: 12 }, () => {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const speed = 0.3 + Math.random() * 0.4;
    return {
      vx: Math.sin(phi) * Math.cos(theta) * speed,
      vy: Math.sin(phi) * Math.sin(theta) * speed,
      vz: Math.cos(phi) * speed,
    };
  });
}

const Obstacle = forwardRef<ObstacleHandle, ObstacleProps>(
  ({ position, scale = 1, onExplosionComplete }, ref) => {
    const outerRef = useRef<Group>(null);
    const meshRef = useRef<Mesh>(null);
const [exploding, setExploding] = useState(false);
    const particles = useRef<Particle[]>([]);
    const particleMeshRefs = useRef<(Mesh | null)[]>([]);
    const explosionTimer = useRef(0);

    useImperativeHandle(ref, () => ({
      get group() { return outerRef.current!; },
      explode() {
        particles.current = generateParticles();
        particleMeshRefs.current = new Array(particles.current.length).fill(null);
        explosionTimer.current = 0;
        setExploding(true);
      },
    }));

    useFrame((_, delta) => {
      if (exploding) {
        explosionTimer.current += delta;
        const t = Math.max(0, 1 - explosionTimer.current / 0.5);
        particles.current.forEach((p, i) => {
          const mesh = particleMeshRefs.current[i];
          if (!mesh) return;
          mesh.position.x += p.vx;
          mesh.position.y += p.vy;
          mesh.position.z += p.vz;
          p.vy -= 0.015;
          mesh.rotation.x += 0.12;
          mesh.rotation.y += 0.09;
          mesh.scale.setScalar(t * 1.5);
        });
        if (explosionTimer.current >= 0.5) {
          onExplosionComplete?.();
        }
        return;
      }

      if (!meshRef.current) return;
      meshRef.current.rotation.x += 0.008;
      meshRef.current.rotation.y += 0.012;
      meshRef.current.rotation.z += 0.005;
    });

    return (
      <group ref={outerRef} position={position} scale={scale}>
        {!exploding && (
          <mesh ref={meshRef} castShadow receiveShadow>
            <icosahedronGeometry args={[2, 1]} />
            <meshPhongMaterial color="#f25346" flatShading />
          </mesh>
        )}
        {exploding && particles.current.map((_, i) => (
          <mesh
            key={i}
            ref={el => { particleMeshRefs.current[i] = el; }}
            castShadow
          >
            <tetrahedronGeometry args={[1.5, 0]} />
            <meshPhongMaterial color="#f25346" flatShading />
          </mesh>
        ))}
      </group>
    );
  }
);

export default Obstacle;
