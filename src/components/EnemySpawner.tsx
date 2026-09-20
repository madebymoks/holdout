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

const HEADSHOT_POINTS  = 3; // instant kill
const BODY_KILL_POINTS = 1; // second body hit

// Squared distance from a point to the closest point on a line segment —
// used to test hits against the SWEPT path a projectile travelled this
// frame (previous position -> current position), not just its current
// point. A single point sample can miss entirely: the head sphere (0.3
// radius, 0.6 diameter) is smaller than a projectile's per-frame travel
// distance (Projectile.tsx's SPEED = 1.125), so a shot that visually
// passes clean through the head can land on neither side of the sphere on
// any single sampled frame. This doesn't change hitbox size — it just
// stops discrete sampling from missing hits that geometrically connected.
function segmentPointDistSq(
  ax: number, ay: number, az: number,
  bx: number, by: number, bz: number,
  px: number, py: number, pz: number,
): number {
  const dx = bx - ax, dy = by - ay, dz = bz - az;
  const lenSq = dx * dx + dy * dy + dz * dz;
  let t = lenSq > 1e-10 ? ((px - ax) * dx + (py - ay) * dy + (pz - az) * dz) / lenSq : 0;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * dx, cy = ay + t * dy, cz = az + t * dz;
  const ddx = cx - px, ddy = cy - py, ddz = cz - pz;
  return ddx * ddx + ddy * ddy + ddz * ddz;
}

// Speed scales with total enemies spawned — slow start, gradual ramp, hard cap
function randomSpeed(spawned: number): number {
  const progress = Math.min(spawned / 50, 1); // full speed after ~50 enemies
  const min = 0.03 + progress * 0.04; // 0.03 → 0.07
  const max = 0.06 + progress * 0.07; // 0.06 → 0.13
  // Bias toward faster: take the max of two random samples
  const a = min + Math.random() * (max - min);
  const b = min + Math.random() * (max - min);
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

function createEnemy(id: number, spawned: number): EnemyData {
  const theta = Math.random() * 2 * Math.PI;
  const x = Math.sin(theta) * SPAWN_DIST;
  const z = -Math.cos(theta) * SPAWN_DIST;
  const len = Math.sqrt(x * x + z * z);
  return {
    id,
    position: [x, FLOOR_Y, z],
    rotationY: Math.atan2(-x, -z),
    direction: [-x / len, -z / len],
    speed: randomSpeed(spawned),
    health: 2,
  };
}

interface EnemyPosition { x: number; z: number; damaged: boolean; }

interface Props {
  active: boolean;
  onGameFailed: () => void;
  onEnemyDestroyed: (projectileId: number) => void;
  onEnemyKilled: (points: number, isHeadshot: boolean) => void;
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
  // Each live projectile's position as of the previous frame, for the swept
  // hit test below. Rebuilt from scratch every frame (see useFrame) so an
  // expired/consumed projectile's entry never lingers.
  const prevProjectilePos = useRef<Map<number, { x: number; y: number; z: number }>>(new Map());

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

      const enemy = createEnemy(nextId.current++, totalSpawned.current);
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
        const data = activeEnemies.current.get(id);
        positions.push({
          x:       handle.group.position.x,
          z:       handle.group.position.z,
          damaged: (data?.health ?? 2) < 2,
        });
      }
    });
    enemyPositionsRef.current = positions;

    // Snapshot this frame's swept path (previous position -> current
    // position) for every live projectile, once, before the per-enemy hit
    // test below — computed here rather than per-enemy so it's built
    // exactly once per projectile per frame regardless of how many enemies
    // are on screen. Rebuilding nextPrev from projectileMeshes (the
    // authoritative live set) each frame means a consumed/expired
    // projectile's tracked position is dropped automatically.
    const projectileSegments = new Map<number, { ax: number; ay: number; az: number; bx: number; by: number; bz: number }>();
    const nextPrev = new Map<number, { x: number; y: number; z: number }>();
    projectileMeshes.current.forEach((pMesh, projectileId) => {
      const curr = { x: pMesh.position.x, y: pMesh.position.y, z: pMesh.position.z };
      const prev = prevProjectilePos.current.get(projectileId) ?? curr;
      projectileSegments.set(projectileId, { ax: prev.x, ay: prev.y, az: prev.z, bx: curr.x, by: curr.y, bz: curr.z });
      nextPrev.set(projectileId, curr);
    });
    prevProjectilePos.current = nextPrev;

    const toRemove: number[] = [];

    handleRefs.current.forEach((handle, id) => {
      if (dyingIds.current.has(id)) return;

      const data = activeEnemies.current.get(id);
      if (!data) return;

      const { group } = handle;
      group.position.x += data.direction[0] * data.speed;
      group.position.z += data.direction[1] * data.speed;

      // 3D sphere collision — head sphere (instant kill) and body sphere (2
      // hits) — tested against the projectile's swept path this frame (see
      // projectileSegments above), not just its current point.
      let hit = false;
      projectileMeshes.current.forEach((_pMesh, projectileId) => {
        if (hit) return;
        const seg = projectileSegments.get(projectileId);
        if (!seg) return;
        const ex = group.position.x, ey = group.position.y, ez = group.position.z;

        // Head sphere
        const headDistSq = segmentPointDistSq(seg.ax, seg.ay, seg.az, seg.bx, seg.by, seg.bz, ex, ey + HEAD_Y, ez);
        const headHit = headDistSq < HEAD_R * HEAD_R;

        // Body sphere
        const bodyDistSq = segmentPointDistSq(seg.ax, seg.ay, seg.az, seg.bx, seg.by, seg.bz, ex, ey + BODY_Y, ez);
        const bodyHit = bodyDistSq < BODY_R * BODY_R;

        if (!headHit && !bodyHit) return;
        hit = true;
        // Any connecting hit consumes the projectile immediately, whether it
        // kills or only damages — otherwise the same projectile could still
        // be sitting in projectileMeshes next frame and register a second hit.
        onEnemyDestroyed(projectileId);

        if (headHit) {
          // Instant kill regardless of remaining body health.
          dyingIds.current.add(id);
          handle.die();
          onEnemyKilled(HEADSHOT_POINTS, true);
          return;
        }

        // Body hit — decrements health in place (activeEnemies holds this
        // same object, so the mutation persists to the next frame).
        data.health -= 1;
        if (data.health <= 0) {
          dyingIds.current.add(id);
          handle.die();
          onEnemyKilled(BODY_KILL_POINTS, false);
        } else {
          handle.hit();
        }
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
