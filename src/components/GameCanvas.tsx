import { useState, useRef, useCallback, useEffect } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { Mesh, Quaternion, Vector3 } from 'three';
import GameOverlay from './GameOverlay';
import InstructionsOverlay from './InstructionsOverlay';
import GameHUD from './GameHUD';
import PixelHeart from './PixelHeart';
import logoImg from './images/HOLDOUT_logo.png';
import EnemySpawner from './EnemySpawner';
import Projectile, { ProjectileData } from './Projectile';
import { DeviceOrientationControls } from '@react-three/drei/core/DeviceOrientationControls';
import { PermissionState } from '../hooks/useDeviceMotionPermission';
import type { CrosshairType } from '../hooks/useCrosshair';
import Minimap, { CARDINAL_COLORS } from './Minimap';
import GridFloor from './GridFloor';
import { useGameSounds } from '../hooks/useGameSounds';

const SKY_COLOR = '#1d2b40';

interface EnemyPosition { x: number; z: number; }

interface Props {
  permission:     PermissionState;
  onGameOver:     (score: number) => void;
  onStop:         () => void;
  lives:          number;
  maxLives:       number;
  crosshairType?: CrosshairType;
}

// Captures camera quaternion into a ref each frame — renders nothing
function CameraCapture({ quaternionRef }: { quaternionRef: React.RefObject<Quaternion | null> }) {
  const { camera } = useThree();
  const q = useRef(new Quaternion());
  useFrame(() => { q.current.copy(camera.quaternion); quaternionRef.current = q.current; });
  return null;
}

export default function GameCanvas({ permission, onGameOver, onStop, lives, maxLives, crosshairType }: Props) {
  const { playShot, playHit, playSpawn, playMiss } = useGameSounds();
  const [gameFailed, setGameFailed] = useState(false);
  const [paused, setPaused]         = useState(false);
  const [gameStarted, setGameStarted] = useState(() => {
    try { return localStorage.getItem('striker_instructions_shown') === '1'; }
    catch { return true; }
  });
  const [projectiles, setProjectiles] = useState<ProjectileData[]>([]);
  const [score, setScore] = useState(0);
  const [enemyCount, setEnemyCount] = useState(0);
  const nextProjectileId = useRef(0);
  const projectileMeshes = useRef<Map<number, Mesh>>(new Map());
  const enemyPositionsRef = useRef<EnemyPosition[]>([]);
  const cameraQuaternionRef = useRef<Quaternion | null>(null);
  const scoreRef = useRef(0);

  // Disable Android hardware back button during gameplay
  useEffect(() => {
    if (Capacitor.getPlatform() !== 'android') return;
    let handle: Awaited<ReturnType<typeof App.addListener>> | null = null;
    App.addListener('backButton', () => { /* swallow — do nothing */ }).then(h => { handle = h; });
    return () => { handle?.remove(); };
  }, []);

  const handleGameFailed = useCallback(() => {
    setGameFailed(true);
    onGameOver(scoreRef.current);
  }, [onGameOver]);

  const fireProjectile = useCallback(() => {
    playShot();
    const id = nextProjectileId.current++;
    const q = cameraQuaternionRef.current;
    const fwd = new Vector3(0, 0, -1);
    if (q) fwd.applyQuaternion(q).normalize();
    const direction: [number, number, number] = [fwd.x, fwd.y, fwd.z];
    setProjectiles(prev => [...prev, { id, direction }]);
  }, [playShot]);

  const removeProjectile = useCallback((id: number) => {
    projectileMeshes.current.delete(id);
    setProjectiles(prev => prev.filter(p => p.id !== id));
  }, []);

  const handleEnemyDestroyed = useCallback((projectileId: number) => {
    playHit();
    removeProjectile(projectileId);
  }, [playHit, removeProjectile]);

  const handleEnemyKilled = useCallback((points: number) => {
    setScore(s => {
      scoreRef.current = s + points;
      return s + points;
    });
  }, []);

  return (
    <div style={{
      position: 'absolute',
      width: '100%',
      height: '100%',
      overflow: 'hidden',
      background: SKY_COLOR,
    }}>
      <Canvas
        gl={{ alpha: false, antialias: false }}
        shadows
        camera={{ fov: 60, near: 0.1, far: 120, position: [0, 0, 0] }}
      >
        <color attach="background" args={[SKY_COLOR]} />
        {/*<fog attach="fog" args={[SKY_COLOR, 35, 90]} />*/}

        <hemisphereLight args={['#f7d9aa', '#ccbbaa', 1.0]} />
        <directionalLight
          color="#fff5e0"
          intensity={2.0}
          position={[30, 15, 20]}
          castShadow
          shadow-mapSize-width={512}
          shadow-mapSize-height={512}
          shadow-camera-left={-60}
          shadow-camera-right={60}
          shadow-camera-top={60}
          shadow-camera-bottom={-60}
          shadow-camera-near={0.1}
          shadow-camera-far={150}
        />
        <directionalLight color="#c0d8ff" intensity={0.4} position={[-20, 8, -10]} />

        {/* Cardinal direction markers — plus signs on the floor */}
        {([
          { pos: [0, -1.49, -18] as [number,number,number], color: CARDINAL_COLORS.N },
          { pos: [18, -1.49, 0]  as [number,number,number], color: CARDINAL_COLORS.E },
          { pos: [0, -1.49,  18] as [number,number,number], color: CARDINAL_COLORS.S },
          { pos: [-18, -1.49, 0] as [number,number,number], color: CARDINAL_COLORS.W },
        ]).map(({ pos, color }) => (
          <group key={color} position={pos}>
            {/* horizontal bar */}
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[2.2, 0.28]} />
              <meshStandardMaterial color={color} emissive={color} emissiveIntensity={3} />
            </mesh>
            {/* vertical bar */}
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[0.28, 2.2]} />
              <meshStandardMaterial color={color} emissive={color} emissiveIntensity={3} />
            </mesh>
          </group>
        ))}

        {/* Floor — slightly lighter than sky so shadow darkening is visible */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.5, 0]} receiveShadow>
          <planeGeometry args={[120, 120]} />
          <shadowMaterial opacity={0.45} />
        </mesh>
        <GridFloor />

        <CameraCapture quaternionRef={cameraQuaternionRef} />

        {/* Device orientation camera control */}
        {permission === 'granted' && <DeviceOrientationControls />}

        {!gameFailed && (
          <EnemySpawner
            active={gameStarted && !paused}
            onGameFailed={handleGameFailed}
            onEnemyDestroyed={handleEnemyDestroyed}
            onEnemyKilled={handleEnemyKilled}
            onEnemyCountChange={setEnemyCount}
            onEnemySpawned={playSpawn}
            projectileMeshes={projectileMeshes}
            enemyPositionsRef={enemyPositionsRef}
          />
        )}

        {!paused && projectiles.map(p => (
          <Projectile
            key={p.id}
            data={p}
            onRemove={removeProjectile}
            onMiss={playMiss}
            meshesMap={projectileMeshes}
          />
        ))}
      </Canvas>

      {!gameFailed && (
        <GameHUD score={score} enemyCount={enemyCount} lives={lives} maxLives={maxLives} onStop={onStop} />
      )}

      {/* Minimap — hidden when paused */}
      {!gameFailed && !paused && (
        <Minimap
          enemyPositionsRef={enemyPositionsRef}
          cameraQuaternionRef={cameraQuaternionRef}
        />
      )}

      {/* Pause button — bottom right */}
      {!gameFailed && (
        <button
          onClick={() => setPaused(p => !p)}
          style={{
            position:       'absolute',
            bottom:         'calc(24px + env(safe-area-inset-bottom))',
            right:          'calc(24px + env(safe-area-inset-right))',
            zIndex:         25,
            pointerEvents:  'all',
            background:     'rgba(0,0,0,0.45)',
            border:         '1.5px solid rgba(255,255,255,0.2)',
            borderRadius:   8,
            width:          44,
            height:         44,
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'center',
            cursor:         'pointer',
            color:          '#fff',
            fontSize:       '18px',
            lineHeight:     1,
          }}
        >
          {paused ? '▶' : '⏸'}
        </button>
      )}

      {/* Pause overlay */}
      {paused && !gameFailed && (
        <div style={{
          position:       'absolute',
          inset:          0,
          background:     '#121d2e',
          display:        'flex',
          flexDirection:  'column',
          alignItems:     'center',
          justifyContent: 'flex-start',
          paddingTop:     '20%',
          paddingLeft:    'calc(32px + env(safe-area-inset-left))',
          paddingRight:   'calc(32px + env(safe-area-inset-right))',
          paddingBottom:  'calc(40px + env(safe-area-inset-bottom))',
          zIndex:         20,
          pointerEvents:  'all',
          overflow:       'hidden',
        }}>
          {/* Logo */}
          <img
            src={logoImg}
            alt="Holdout"
            style={{ width: '85%', marginBottom: 20, userSelect: 'none' }}
          />

          {/* Paused label */}
          <div style={{
            fontFamily:    "'Open Sans', sans-serif",
            fontSize:      '10px',
            fontWeight:    700,
            letterSpacing: '0.20em',
            textTransform: 'uppercase',
            color:         'rgba(240,236,224,0.38)',
            marginBottom:  20,
          }}>
            Paused
          </div>

          {/* Divider */}
          <div style={{ width: '100%', height: 1, background: 'rgba(240,236,224,0.10)', marginBottom: 28 }} />

          {/* Stats */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0, width: '100%', maxWidth: 320 }}>

            {/* Kills */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 24 }}>
              <div style={{
                fontFamily:    "'Open Sans', sans-serif",
                fontSize:      '9px',
                fontWeight:    700,
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                color:         'rgba(240,236,224,0.38)',
                marginBottom:  6,
              }}>
                Kills
              </div>
              <div style={{ fontFamily: "'Squada One', sans-serif", fontSize: '52px', color: '#f0ece0', lineHeight: 1 }}>
                {score}
              </div>
            </div>

            {/* Divider */}
            <div style={{ width: '100%', height: 1, background: 'rgba(240,236,224,0.08)', marginBottom: 24 }} />

            {/* Lives + Incoming */}
            <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'flex-start' }}>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                <div style={{
                  fontFamily:    "'Open Sans', sans-serif",
                  fontSize:      '9px',
                  fontWeight:    700,
                  letterSpacing: '0.16em',
                  textTransform: 'uppercase',
                  color:         'rgba(240,236,224,0.38)',
                }}>
                  Lives
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {Array.from({ length: maxLives }, (_, i) => (
                    <PixelHeart
                      key={i}
                      size={20}
                      color="#f28f68"
                      emptyColor="rgba(242,143,104,0.22)"
                      filled={i < lives}
                      style={{ opacity: i < lives ? 1 : 0.3 }}
                    />
                  ))}
                </div>
              </div>

              <div style={{ width: 1, alignSelf: 'stretch', background: 'rgba(240,236,224,0.10)' }} />

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                <div style={{
                  fontFamily:    "'Open Sans', sans-serif",
                  fontSize:      '9px',
                  fontWeight:    700,
                  letterSpacing: '0.16em',
                  textTransform: 'uppercase',
                  color:         'rgba(240,236,224,0.38)',
                }}>
                  Incoming
                </div>
                <div style={{
                  fontFamily: "'Squada One', sans-serif",
                  fontSize:   '28px',
                  color:      enemyCount > 0 ? '#f0ece0' : 'rgba(240,236,224,0.35)',
                  lineHeight: 1,
                }}>
                  {enemyCount > 0 ? enemyCount : 'clear'}
                </div>
              </div>

            </div>
          </div>

          {/* Close — back to main menu */}
          <button
            onClick={onStop}
            style={{
              marginTop:     40,
              background:    'transparent',
              border:        'none',
              color:         'rgba(240,236,224,0.40)',
              fontFamily:    "'Open Sans', sans-serif",
              fontSize:      '12px',
              fontWeight:    600,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              cursor:        'pointer',
              padding:       '6px 12px',
            }}
          >
            ✕ Quit to Menu
          </button>
        </div>
      )}

      <GameOverlay onFire={!paused ? fireProjectile : undefined} gameOver={gameFailed || paused} crosshairType={crosshairType} />
      <InstructionsOverlay onDismissed={() => setGameStarted(true)} />

    </div>
  );
}
