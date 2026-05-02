import { forwardRef, useImperativeHandle, useRef, useMemo, useEffect, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { Group, AnimationMixer, LoopRepeat, Color, Mesh } from 'three';
import modelUrl from './models/Running.glb?url';

export interface EnemyHandle {
  group: Group;
  die: () => void;
  hit: () => void;
}

interface EnemyProps {
  position: [number, number, number];
  rotationY: number;
  onDeathComplete?: () => void;
}

interface Particle { vx: number; vy: number; vz: number; }

function generateParticles(): Particle[] {
  return Array.from({ length: 14 }, () => {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const speed = 0.15 + Math.random() * 0.25;
    return {
      vx: Math.sin(phi) * Math.cos(theta) * speed,
      vy: Math.sin(phi) * Math.sin(theta) * speed,
      vz: Math.cos(phi) * speed,
    };
  });
}

function extractColor(group: Group): string {
  let color = '#c8a882';
  group.traverse((o: any) => {
    if (o.isMesh && o.material?.color) {
      color = '#' + (o.material.color as Color).getHexString();
    }
  });
  return color;
}

const SCALE = 1;
const EXPLOSION_DURATION = 0.5;

useGLTF.preload(modelUrl);

const Enemy = forwardRef<EnemyHandle, EnemyProps>(
  ({ position, rotationY, onDeathComplete }, ref) => {
    const outerRef = useRef<Group>(null);
    const mixerRef = useRef<AnimationMixer | null>(null);
    const dying = useRef(false);
    const deathTimer = useRef(0);
    const particles = useRef<Particle[]>([]);
    const particleRefs = useRef<(Mesh | null)[]>([]);
    const [exploding, setExploding] = useState(false);
    const [damaged, setDamaged] = useState(false);
    const modelColor = useRef('#c8a882');
    const ringRef = useRef<Mesh>(null);
    const ringTime = useRef(0);

    const { scene, animations } = useGLTF(modelUrl);

    const clone = useMemo(() => {
      const c = skeletonClone(scene) as Group;
      c.traverse((o: any) => {
        if (o.isMesh) {
          o.castShadow = true;
          o.receiveShadow = true;
        }
      });
      modelColor.current = extractColor(c);
      return c;
    }, [scene]);

    useEffect(() => {
      if (!animations.length) return;
      const mixer = new AnimationMixer(clone);
      const action = mixer.clipAction(animations[0]);
      action.setLoop(LoopRepeat, Infinity);
      action.play();
      mixerRef.current = mixer;
      return () => { mixer.stopAllAction(); };
    }, [clone, animations]);

    useImperativeHandle(ref, () => ({
      get group() { return outerRef.current!; },
      die() {
        particles.current = generateParticles();
        particleRefs.current = new Array(particles.current.length).fill(null);
        deathTimer.current = 0;
        dying.current = true;
        setExploding(true);
      },
      hit() {
        setDamaged(true);
      },
    }));

    useFrame((_, delta) => {
      if (exploding) {
        deathTimer.current += delta;
        const t = Math.max(0, 1 - deathTimer.current / EXPLOSION_DURATION);
        particles.current.forEach((p, i) => {
          const mesh = particleRefs.current[i];
          if (!mesh) return;
          mesh.position.x += p.vx;
          mesh.position.y += p.vy;
          mesh.position.z += p.vz;
          p.vy -= 0.012;
          mesh.rotation.x += 0.1;
          mesh.rotation.y += 0.08;
          mesh.scale.setScalar(t * 1.2);
        });
        if (deathTimer.current >= EXPLOSION_DURATION) onDeathComplete?.();
        return;
      }

      if (mixerRef.current) {
        mixerRef.current.update(delta);
        clone.position.set(0, 0, 0);
      }

      // Pulse the damage ring
      if (damaged && ringRef.current) {
        ringTime.current += delta;
        const pulse = 0.85 + 0.15 * Math.sin(ringTime.current * 8);
        ringRef.current.scale.setScalar(pulse);
      }
    });

    return (
      <group ref={outerRef} position={position} rotation={[0, rotationY, 0]} scale={SCALE}>
        {!exploding && <primitive object={clone} />}

        {/* Damage indicator ring — shown after a body hit */}
        {damaged && !exploding && (
          <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
            <torusGeometry args={[0.5, 0.04, 8, 40]} />
            <meshStandardMaterial color="#ff2200" emissive="#ff2200" emissiveIntensity={2} />
          </mesh>
        )}

        {exploding && particles.current.map((_, i) => (
          <mesh
            key={i}
            ref={el => { particleRefs.current[i] = el; }}
            castShadow
          >
            <tetrahedronGeometry args={[0.3, 0]} />
            <meshPhongMaterial color={modelColor.current} flatShading />
          </mesh>
        ))}
      </group>
    );
  }
);

Enemy.displayName = 'Enemy';
export default Enemy;
