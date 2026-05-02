import { useState, useRef, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import { Mesh } from 'three';
import Obstacle, { ObstacleHandle } from './Obstacle';

const SPEED = 0.15;
const SPAWN_DIST = 70;
const FAIL_Z = -10;
const REMOVE_Z = 2;
const HIT_DISTANCE = 3;

interface ObstacleData {
  id: number;
  position: [number, number, number];
  direction: [number, number, number];
  scale: number;
}

function createObstacle(id: number): ObstacleData {
  // Spawn within a 120° cone (±60° half-angle) from the -Z axis
  const halfAngle = Math.PI / 3;
  const phi = Math.random() * halfAngle;
  // Restrict azimuth to upper half so obstacles stay near the cloud band
  const theta = (Math.random() - 0.5) * Math.PI;

  const sinPhi = Math.sin(phi);
  const position: [number, number, number] = [
    SPAWN_DIST * sinPhi * Math.cos(theta),
    Math.max(4, SPAWN_DIST * sinPhi * Math.abs(Math.sin(theta)) + 4),
    -SPAWN_DIST * Math.cos(phi),
  ];

  const len = Math.sqrt(position[0] ** 2 + position[1] ** 2 + position[2] ** 2);
  return {
    id,
    position,
    direction: [-position[0] / len, -position[1] / len, -position[2] / len],
    scale: 0.5 + Math.random() * 0.5,
  };
}

interface Props {
  onGameFailed: () => void;
  onObstacleDestroyed: (projectileId: number) => void;
  projectileMeshes: React.RefObject<Map<number, Mesh>>;
}

export default function ObstacleSpawner({ onGameFailed, onObstacleDestroyed, projectileMeshes }: Props) {
  const [obstacleList, setObstacleList] = useState<ObstacleData[]>([]);

  const activeObstacles = useRef<Map<number, ObstacleData>>(new Map());
  const handleRefs = useRef<Map<number, ObstacleHandle>>(new Map());
  const explodingIds = useRef<Set<number>>(new Set());
  const nextId = useRef(0);
  const spawnTimer = useRef(0);
  const spawnInterval = useRef(120);
  const gameFailed = useRef(false);

  const removeObstacle = useCallback((id: number) => {
    activeObstacles.current.delete(id);
    handleRefs.current.delete(id);
    explodingIds.current.delete(id);
    setObstacleList(prev => prev.filter(o => o.id !== id));
  }, []);

  const setHandleRef = useCallback((id: number) => (handle: ObstacleHandle | null) => {
    if (handle) handleRefs.current.set(id, handle);
    else handleRefs.current.delete(id);
  }, []);

  useFrame(() => {
    if (gameFailed.current) return;

    // Spawn timer
    spawnTimer.current++;
    if (spawnTimer.current >= spawnInterval.current) {
      spawnTimer.current = 0;
      spawnInterval.current = 90 + Math.random() * 60;
      const obs = createObstacle(nextId.current++);
      activeObstacles.current.set(obs.id, obs);
      setObstacleList(prev => [...prev, obs]);
    }

    // Move + lifecycle
    const toRemove: number[] = [];

    handleRefs.current.forEach((handle, id) => {
      if (explodingIds.current.has(id)) return;

      const data = activeObstacles.current.get(id);
      if (!data) return;

      const { group } = handle;
      group.position.x += data.direction[0] * SPEED;
      group.position.y += data.direction[1] * SPEED;
      group.position.z += data.direction[2] * SPEED;

      // Collision check
      let hit = false;
      projectileMeshes.current.forEach((pMesh, projectileId) => {
        if (hit) return;
        if (group.position.distanceTo(pMesh.position) < HIT_DISTANCE) {
          hit = true;
          explodingIds.current.add(id);
          handle.explode();
          onObstacleDestroyed(projectileId);
        }
      });
      if (hit) return;

      if (group.position.z >= FAIL_Z && !gameFailed.current) {
        gameFailed.current = true;
        onGameFailed();
      }

      if (group.position.z >= REMOVE_Z) {
        toRemove.push(id);
      }
    });

    if (toRemove.length > 0) {
      toRemove.forEach(id => {
        activeObstacles.current.delete(id);
        handleRefs.current.delete(id);
      });
      setObstacleList(prev => prev.filter(o => !toRemove.includes(o.id)));
    }
  });

  return (
    <>
      {obstacleList.map(obs => (
        <Obstacle
          key={obs.id}
          ref={setHandleRef(obs.id)}
          position={obs.position}
          scale={obs.scale}
          onExplosionComplete={() => removeObstacle(obs.id)}
        />
      ))}
    </>
  );
}
