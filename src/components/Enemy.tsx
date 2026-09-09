import { forwardRef, useImperativeHandle, useRef, useMemo, useEffect, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { Group, AnimationMixer, LoopRepeat, Color, Mesh, MeshPhongMaterial, Object3D } from 'three';
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
  group.traverse((o: Object3D) => {
    if (o instanceof Mesh && !Array.isArray(o.material) && o.material.color) {
      color = '#' + (o.material.color as Color).getHexString();
    }
  });
  return color;
}

// Materials that support emissive tinting (Standard/Phong/Lambert/Toon all
// do; Basic/Shader ones don't) — checked structurally so this works
// whatever material type the GLTF happens to use.
interface EmissiveMaterial { emissive: Color; emissiveIntensity: number; }
function hasEmissive(m: object): m is EmissiveMaterial {
  return 'emissive' in m && 'emissiveIntensity' in m;
}

const SCALE = 1;
const EXPLOSION_DURATION = 0.5;
const EXPLOSION_EMISSIVE_PEAK = 4;
const DAMAGE_EMISSIVE_COLOR = '#ff3300';
const DAMAGE_EMISSIVE_INTENSITY = 1.4; // sustained, moderate — not a flash

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
    const bodyMaterials = useRef<EmissiveMaterial[]>([]);

    const { scene, animations } = useGLTF(modelUrl);

    const clone = useMemo(() => {
      const c = skeletonClone(scene) as Group;
      const materials: EmissiveMaterial[] = [];
      c.traverse((o: Object3D) => {
        if (o instanceof Mesh) {
          o.castShadow = true;
          o.receiveShadow = true;
          // SkeletonUtils.clone shares material REFERENCES across every
          // instance built from the same GLTF scene — clone each mesh's
          // material per-instance so tinting one enemy's materials (on
          // damage, below) can never bleed onto every other enemy on screen.
          const mat = o.material;
          if (Array.isArray(mat)) {
            const cloned = mat.map(m => m.clone());
            o.material = cloned;
            cloned.forEach(m => { if (hasEmissive(m)) materials.push(m); });
          } else {
            const cloned = mat.clone();
            o.material = cloned;
            if (hasEmissive(cloned)) materials.push(cloned);
          }
        }
      });
      bodyMaterials.current = materials;
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

    // Set the tint color once, the instant this enemy is damaged — the
    // per-frame pulse below only ever touches emissiveIntensity from here on.
    useEffect(() => {
      if (!damaged) return;
      bodyMaterials.current.forEach(m => { m.emissive.set(DAMAGE_EMISSIVE_COLOR); });
    }, [damaged]);

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
          (mesh.material as MeshPhongMaterial).emissiveIntensity = t * EXPLOSION_EMISSIVE_PEAK;
        });
        if (deathTimer.current >= EXPLOSION_DURATION) onDeathComplete?.();
        return;
      }

      if (mixerRef.current) {
        mixerRef.current.update(delta);
        clone.position.set(0, 0, 0);
      }

      // Damaged, sustained feedback: pulse both the floor ring and the
      // body's emissive intensity off the same clock so they read as one
      // "unstable" effect rather than two unrelated cues. Clamp delta so a
      // stutter/tab-switch can't jump the sine phase — the pulse is a
      // function of accumulated time, not frame count, so it stays the
      // same speed regardless of frame rate.
      if (damaged) {
        ringTime.current += Math.min(delta, 1 / 30);
        const pulse = 0.85 + 0.15 * Math.sin(ringTime.current * 8);
        if (ringRef.current) ringRef.current.scale.setScalar(pulse);
        const intensity = DAMAGE_EMISSIVE_INTENSITY * pulse;
        bodyMaterials.current.forEach(m => { m.emissiveIntensity = intensity; });
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
            <meshPhongMaterial
              color={modelColor.current}
              flatShading
              emissive="#ff7a3c"
              emissiveIntensity={EXPLOSION_EMISSIVE_PEAK}
            />
          </mesh>
        ))}
      </group>
    );
  }
);

Enemy.displayName = 'Enemy';
export default Enemy;
