import { useState, useRef, useCallback, Suspense } from 'react';
import { useFrame } from '@react-three/fiber';
import { Mesh } from 'three';
import Enemy, { EnemyHandle } from './Enemy';

const SPAWN_DIST = 50;
const FLOOR_Y = -1.5;
const FAIL_DIST = 4;

// Hit zones relative to enemy group origin (which sits at floor level)
const HEAD_Y = 1.65;  // head centre height above group origin → world Y ≈ 0.15
const HEAD_R = 0.3;   // head sphere radius — instant kill
const BODY_Y = 1.2;   // torso centre height above group origin → world Y ≈ -0.3
const BODY_R = 0.65;  // body sphere radius — spans Y -0.95 to +0.35, catches horizontal shots

// Speed range — skewed so most enemies are fast
const SPEED_MIN = 0.06;
const SPEED_MAX = 0.18;
function randomSpeed(): number {
  // Bias toward faster: take the max of two random samples
  const a = SPEED_MIN + Math.random() * (SPEED_MAX - SPEED_MIN);
  const b = SPEED_MIN + Math.random() * (SPEED_MAX - SPEED_MIN);
  return Math.max(a, b);
}

interface EnemyData {
  id: number;
  position: [number, number, number];
  rotationY: number;
  direction: [number, number];
  speed: number;
  health: number;
}

function createEnemy(id: number): EnemyData {
  const theta = (Math.random() - 0.5) * Math.PI;
  const x = Math.sin(theta) * SPAWN_DIST;
  const z = -Math.cos(theta) * SPAWN_DIST;
  const len = Math.sqrt(x * x + z * z);
  return {
    id,
    position: [x, FLOOR_Y, z],
    rotationY: Math.atan2(-x, -z),
    direction: [-x / len, -z / len],
    speed: randomSpeed(),
    health: 2,
  };
}

interface EnemyPosition { x: number; z: number; }

interface Props {
  active: boolean;
  onGameFailed: () => void;
  onEnemyDestroyed: (projectileId: number) => void;
  onEnemyKilled: (points: number) => void;
  onEnemyCountChange: (count: number) => void;
  onEnemySpawned: () => void;
  projectileMeshes: React.RefObject<Map<number, Mesh>>;
  enemyPositionsRef: React.RefObject<EnemyPosition[]>;
}

export default function EnemySpawner({ active, onGameFailed, onEnemyDestroyed, onEnemyKilled, onEnemyCountChange, onEnemySpawned, projectileMeshes, enemyPositionsRef }: Props) {
  const [enemyList, setEnemyList] = useState<EnemyData[]>([]);
  const activeEnemies = useRef<Map<number, EnemyData>>(new Map());
  const handleRefs = useRef<Map<number, EnemyHandle>>(new Map());
  const dyingIds = useRef<Set<number>>(new Set());
  const nextId = useRef(0);
  const spawnTimer = useRef(150);
  const spawnInterval = useRef(160);
  // Track total enemies spawned to progressively reduce spawn interval
  const totalSpawned = useRef(0);
  const gameFailed = useRef(false);

  const removeEnemy = useCallback((id: number) => {
    activeEnemies.current.delete(id);
    handleRefs.current.delete(id);
    dyingIds.current.delete(id);
    setEnemyList(prev => {
      const next = prev.filter(e => e.id !== id);
      onEnemyCountChange(next.length);
      return next;
    });
  }, [onEnemyCountChange]);

  const setHandleRef = useCallback((id: number) => (handle: EnemyHandle | null) => {
    if (handle) handleRefs.current.set(id, handle);
    else handleRefs.current.delete(id);
  }, []);

  useFrame(() => {
    if (!active || gameFailed.current) return;

    spawnTimer.current++;
    if (spawnTimer.current >= spawnInterval.current) {
      spawnTimer.current = 0;
      // Progressively decrease spawn interval as game goes on, minimum 60 frames (~1s)
      const pressure = Math.min(totalSpawned.current * 3, 80);
      spawnInterval.current = Math.max(60, 140 - pressure + Math.random() * 40);
      totalSpawned.current++;

      const enemy = createEnemy(nextId.current++);
      activeEnemies.current.set(enemy.id, enemy);
      onEnemySpawned();
      setEnemyList(prev => {
        const next = [...prev, enemy];
        onEnemyCountChange(next.length);
        return next;
      });
    }

    // Update minimap positions every frame
    const positions: EnemyPosition[] = [];
    handleRefs.current.forEach((handle, id) => {
      if (!dyingIds.current.has(id)) {
        positions.push({ x: handle.group.position.x, z: handle.group.position.z });
      }
    });
    enemyPositionsRef.current = positions;

    const toRemove: number[] = [];

    handleRefs.current.forEach((handle, id) => {
      if (dyingIds.current.has(id)) return;

      const data = activeEnemies.current.get(id);
      if (!data) return;

      const { group } = handle;
      group.position.x += data.direction[0] * data.speed;
      group.position.z += data.direction[1] * data.speed;

      // 3D sphere collision — head sphere (instant kill) and body sphere (2 hits)
      let hit = false;
      projectileMeshes.current.forEach((pMesh, projectileId) => {
        if (hit) return;
        const px = pMesh.position.x, py = pMesh.position.y, pz = pMesh.position.z;
        const ex = group.position.x, ey = group.position.y, ez = group.position.z;

        // Head sphere
        const hdx = px - ex, hdy = py - (ey + HEAD_Y), hdz = pz - ez;
        const headHit = hdx * hdx + hdy * hdy + hdz * hdz < HEAD_R * HEAD_R;

        // Body sphere
        const bdx = px - ex, bdy = py - (ey + BODY_Y), bdz = pz - ez;
        const bodyHit = bdx * bdx + bdy * bdy + bdz * bdz < BODY_R * BODY_R;

        if (!headHit && !bodyHit) return;
        hit = true;
        onEnemyDestroyed(projectileId);
        dyingIds.current.add(id);
        handle.die();
        onEnemyKilled(1);
      });
      if (hit) return;

      const distToCamera = Math.sqrt(group.position.x ** 2 + group.position.z ** 2);
      if (distToCamera <= FAIL_DIST && !gameFailed.current) {
        gameFailed.current = true;
        onGameFailed();
      }

      if (distToCamera <= FAIL_DIST) {
        toRemove.push(id);
      }
    });

    if (toRemove.length > 0) {
      toRemove.forEach(id => {
        activeEnemies.current.delete(id);
        handleRefs.current.delete(id);
      });
      setEnemyList(prev => prev.filter(e => !toRemove.includes(e.id)));
    }
  });

  return (
    <>
      {enemyList.map(enemy => (
        <Suspense key={enemy.id} fallback={null}>
          <Enemy
            ref={setHandleRef(enemy.id)}
            position={enemy.position}
            rotationY={enemy.rotationY}
            onDeathComplete={() => removeEnemy(enemy.id)}
          />
        </Suspense>
      ))}
    </>
  );
}
