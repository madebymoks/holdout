import { Component, Suspense, useState, useRef, useCallback, useEffect, forwardRef, useImperativeHandle } from 'react';
import type { ReactNode } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { Environment } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { ACESFilmicToneMapping, DoubleSide, Mesh, PointLight, Quaternion, Vector3 } from 'three';
import GameOverlay from './GameOverlay';
import InstructionsOverlay from './InstructionsOverlay';
import GameHUD from './GameHUD';
import DiamondPip from './DiamondPip';
import EnemySpawner from './EnemySpawner';
import Projectile, { ProjectileData } from './Projectile';
import { DeviceOrientationControls } from '@react-three/drei/core/DeviceOrientationControls';
import { PermissionState } from '../hooks/useDeviceMotionPermission';
import type { CrosshairType } from '../hooks/useCrosshair';
import Minimap, { CARDINAL_COLORS } from './Minimap';
import GridFloor from './GridFloor';
import GradientSky from './GradientSky';
import DustMotes from './DustMotes';
import Weapon, { WeaponHandle } from './Weapon';
import { useGameSounds } from '../hooks/useGameSounds';
import { useMissions } from '../hooks/useMissions';


// Lifted from #1d2b40 — the original read near-black on a real phone panel;
// this keeps the same cool hue while raising the floor of the scene.
// Lifted from #1d2b40 — the original read near-black on a real phone panel;
// this keeps the same cool hue while raising the floor of the scene.
const SKY_COLOR = '#263853';
// Cooler and darker than SKY_COLOR — gives distant humanoids aerial
// perspective and lets their warm beige tone separate from the backdrop.
const FOG_COLOR = '#141f33';
const FOG_DENSITY = 0.015;

// Boundary ring — sits just beyond enemy spawn distance (~50) so it frames
// the arena without crowding gameplay.
const BOUNDARY_RING_RADIUS = 57;
// Brightness kick added to the grid's opacity on each kill; GridFloor
// decays it back out over ~300ms (see PULSE_DECAY_PER_S there).
const KILL_GRID_PULSE = 0.25;

// Higher-res shadow map on capable devices, falling back to 512 on low-end
// hardware (mirrors the previous fixed resolution).
const SHADOW_MAP_SIZE = (() => {
  try {
    const nav = navigator as Navigator & { deviceMemory?: number };
    const lowEnd = (nav.hardwareConcurrency ?? Infinity) <= 4 || (nav.deviceMemory ?? Infinity) <= 4;
    return lowEnd ? 512 : 1024;
  } catch {
    return 1024;
  }
})();

// Bloom is a real per-frame cost (an extra offscreen pass + blur), so it's
// gated to devices with enough cores to spare — must hold 60fps on
// mid-range Android. Defaults to enabled if the API is unavailable.
const IS_HIGH_END_DEVICE = (() => {
  try {
    return (navigator.hardwareConcurrency ?? 8) > 4;
  } catch {
    return true;
  }
})();

interface EnemyPosition { x: number; z: number; damaged: boolean; }

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

export interface MuzzleLightHandle { flash: () => void; }

const MUZZLE_LIGHT_DURATION_S = 0.08;
const MUZZLE_LIGHT_PEAK = 3.5;
const _muzzleForward = new Vector3();

// A brief warm point light near the camera on each shot, decaying to dark
// between shots — renders nothing but the light itself.
const MuzzleLight = forwardRef<MuzzleLightHandle>((_props, ref) => {
  const { camera } = useThree();
  const lightRef = useRef<PointLight>(null);
  const energy = useRef(0);

  useImperativeHandle(ref, () => ({
    flash() { energy.current = 1; },
  }), []);

  useFrame((_state, delta) => {
    energy.current = Math.max(0, energy.current - delta / MUZZLE_LIGHT_DURATION_S);
    const light = lightRef.current;
    if (!light) return;
    _muzzleForward.set(0, 0, -1).applyQuaternion(camera.quaternion);
    light.position.copy(camera.position).addScaledVector(_muzzleForward, 0.5);
    light.intensity = energy.current * MUZZLE_LIGHT_PEAK;
  });

  return <pointLight ref={lightRef} color="#ffb060" distance={8} decay={2} intensity={0} />;
});
MuzzleLight.displayName = 'MuzzleLight';

export interface CameraShakeHandle { addTrauma: (amount: number) => void; }

const SHAKE_DECAY_PER_S  = 1.5;   // trauma units/sec
const SHAKE_PEAK_OFFSET  = 0.08;  // world units, ~centimetres
const SHAKE_SAMPLE_HZ    = 30;    // resample the jitter target at a fixed rate so
                                   // perceived shake speed doesn't change with fps

// Trauma-based positional camera shake. DeviceOrientationControls owns
// camera.quaternion every frame — this only ever touches camera.position,
// so it can't fight aim. Position returns exactly to [0,0,0] once trauma
// decays to 0.
const CameraShake = forwardRef<CameraShakeHandle>((_props, ref) => {
  const { camera } = useThree();
  const trauma = useRef(0);
  const sampleTimer = useRef(0);
  const jitter = useRef({ x: 0, y: 0 });

  useImperativeHandle(ref, () => ({
    addTrauma(amount: number) {
      trauma.current = Math.min(1, trauma.current + amount);
    },
  }), []);

  useFrame((_state, delta) => {
    trauma.current = Math.max(0, trauma.current - delta * SHAKE_DECAY_PER_S);

    sampleTimer.current += delta;
    if (sampleTimer.current >= 1 / SHAKE_SAMPLE_HZ) {
      sampleTimer.current = 0;
      jitter.current.x = Math.random() * 2 - 1;
      jitter.current.y = Math.random() * 2 - 1;
    }

    const shake = trauma.current * trauma.current;
    if (shake > 0.0001) {
      camera.position.x = jitter.current.x * shake * SHAKE_PEAK_OFFSET;
      camera.position.y = jitter.current.y * shake * SHAKE_PEAK_OFFSET;
    } else {
      camera.position.x = 0;
      camera.position.y = 0;
    }
  });

  return null;
});
CameraShake.displayName = 'CameraShake';

// The Environment preset below fetches its HDR over the network at runtime
// (drei has no bundled/offline preset option) — on a flaky connection or a
// blocked/rate-limited host that fetch can reject, and drei re-throws that
// rejection as a render error. Without this boundary, an uncaught error
// anywhere inside <Canvas> unmounts the ENTIRE scene (confirmed while
// building this: a simulated fetch failure blanked the whole game, HUD
// included, not just the env map). The env map is a pure visual nicety, so
// on failure this just renders nothing and the rest of the scene — weapon
// included, via its own emissive/viewmodel-light lighting — keeps working.
class EnvironmentErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export default function GameCanvas({ permission, onGameOver, onStop, lives, maxLives, crosshairType }: Props) {
  const { playShot, playHit, playSpawn, playMiss } = useGameSounds();
  const { incrementKills, incrementHeadshots, recordGameEnd } = useMissions();
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
  const weaponRef = useRef<WeaponHandle>(null);
  const muzzleLightRef = useRef<MuzzleLightHandle>(null);
  const screenFlashRef = useRef<HTMLDivElement>(null);
  const cameraShakeRef = useRef<CameraShakeHandle>(null);
  const gridPulseRef = useRef(0);
  // Set once on mount — GameCanvas remounts fresh on every "Play"/"Try Again",
  // so this is always the current run's actual start time.
  const runStartRef = useRef(0);
  // Headshots landed in the current run — also reset to 0 on every remount,
  // used to update the missions "bestHeadshots" (single-run) stat at game end.
  const headshotsThisRunRef = useRef(0);

  useEffect(() => {
    runStartRef.current = performance.now();
  }, []);

  // Disable Android hardware back button during gameplay
  useEffect(() => {
    if (Capacitor.getPlatform() !== 'android') return;
    let handle: Awaited<ReturnType<typeof App.addListener>> | null = null;
    App.addListener('backButton', () => { /* swallow — do nothing */ }).then(h => { handle = h; });
    return () => { handle?.remove(); };
  }, []);

  const handleGameFailed = useCallback(() => {
    cameraShakeRef.current?.addTrauma(0.7);
    const survivalSeconds = (performance.now() - runStartRef.current) / 1000;
    recordGameEnd(survivalSeconds, headshotsThisRunRef.current);
    setGameFailed(true);
    onGameOver(scoreRef.current);
  }, [onGameOver, recordGameEnd]);

  const fireProjectile = useCallback(() => {
    playShot();
    weaponRef.current?.fire();
    muzzleLightRef.current?.flash();

    // Screen flash — driven directly on the DOM node (no React state) so
    // rapid-fire shots don't trigger extra renders; force a reflow so the
    // fade-out restarts cleanly even mid-transition on the next shot.
    const flashEl = screenFlashRef.current;
    if (flashEl) {
      flashEl.style.transition = 'none';
      flashEl.style.opacity = '0.15';
      void flashEl.offsetHeight;
      flashEl.style.transition = 'opacity 60ms ease-out';
      flashEl.style.opacity = '0';
    }

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

  const handleEnemyKilled = useCallback((points: number, isHeadshot: boolean) => {
    // Slightly stronger kick on a headshot — reuses the existing trauma
    // system rather than adding new UI for it.
    cameraShakeRef.current?.addTrauma(isHeadshot ? 0.55 : 0.4);
    gridPulseRef.current = Math.min(0.5, gridPulseRef.current + KILL_GRID_PULSE);
    incrementKills();
    if (isHeadshot) {
      incrementHeadshots();
      headshotsThisRunRef.current += 1;
    }
    setScore(s => {
      scoreRef.current = s + points;
      return s + points;
    });
  }, [incrementKills, incrementHeadshots]);

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
        shadows="soft"
        camera={{ fov: 60, near: 0.1, far: 120, position: [0, 0, 0] }}
        onCreated={({ gl }) => {
          gl.toneMapping = ACESFilmicToneMapping;
          // ACES darkens midtones noticeably at the default 1.0 — this was
          // the main cause of the scene reading near-black on a real phone
          // (renderer.outputColorSpace is left at its default sRGB, so
          // nothing else here forces linear output).
          // ACES darkens midtones noticeably at the default 1.0 — this was
          // the main cause of the scene reading near-black on a real phone
          // (renderer.outputColorSpace is left at its default sRGB, so
          // nothing else here forces linear output).
          gl.toneMappingExposure = 1.4;
        }}
      >
        <color attach="background" args={[SKY_COLOR]} />
        <fogExp2 attach="fog" args={[FOG_COLOR, FOG_DENSITY]} />
        <GradientSky topColor="#0c1626" bottomColor={SKY_COLOR} />

        {/* Lightweight env map so metallic surfaces (the weapon, the boundary
            ring) have something to reflect instead of going near-black —
            background is off so it doesn't replace the sky/fog. */}
        <EnvironmentErrorBoundary>
          <Suspense fallback={null}>
            <Environment preset="night" background={false} />
          </Suspense>
        </EnvironmentErrorBoundary>

        {/* Raised from 1.0 — was letting shadowed areas crush to black */}
        <hemisphereLight args={['#f7d9aa', '#ccbbaa', 1.3]} />
        {/* Fills the floor of the lighting the hemisphere/key lights still miss */}
        <ambientLight color="#4a5a78" intensity={0.45} />
        <directionalLight
          color="#fff5e0"
          intensity={2.0}
          position={[30, 15, 20]}
          castShadow
          shadow-mapSize-width={SHADOW_MAP_SIZE}
          shadow-mapSize-height={SHADOW_MAP_SIZE}
          shadow-radius={4}
          shadow-camera-left={-60}
          shadow-camera-right={60}
          shadow-camera-top={60}
          shadow-camera-bottom={-60}
          shadow-camera-near={0.1}
          shadow-camera-far={150}
        />
        <directionalLight color="#c0d8ff" intensity={0.55} position={[-20, 8, -10]} />
        {/* Warm rim/back light — separates enemy silhouettes from the floor at a distance */}
        <directionalLight color="#ff9d5c" intensity={0.6} position={[-15, 12, -35]} />

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
        <GridFloor pulseRef={gridPulseRef} />

        {/* Boundary ring — frames the arena just beyond spawn distance; fog
            partially swallows it at this range, which is intended. */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.49, 0]}>
          <ringGeometry args={[BOUNDARY_RING_RADIUS - 0.15, BOUNDARY_RING_RADIUS + 0.15, 128]} />
          <meshStandardMaterial
            color="#00f0ff"
            emissive="#00f0ff"
            emissiveIntensity={1.0}
            transparent
            opacity={0.35}
            side={DoubleSide}
          />
        </mesh>

        {/* Ambient dust motes — makes the arena read as an active space
            rather than empty; purely decorative. */}
        <DustMotes />

        <CameraCapture quaternionRef={cameraQuaternionRef} />
        {/* Defensive boundary — matches the pattern used for Enemy/Environment
            below. useGLTF.preload() at module scope means the weapon model is
            usually already loaded by the time this mounts, but without a
            local Suspense boundary a genuine cold suspend here has no
            enclosing fallback to catch it. */}
        <Suspense fallback={null}>
          <Weapon ref={weaponRef} />
        </Suspense>
        <MuzzleLight ref={muzzleLightRef} />
        <CameraShake ref={cameraShakeRef} />

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

        {/* Bloom — gated to high-end devices; an extra offscreen pass + blur
            isn't worth the frame-time risk on mid-range Android. */}
        {IS_HIGH_END_DEVICE && (
          <EffectComposer>
            <Bloom
              luminanceThreshold={0.6}
              luminanceSmoothing={0.2}
              intensity={0.8}
              mipmapBlur
            />
          </EffectComposer>
        )}
      </Canvas>

      {/* Vignette — cheap DOM overlay rather than a postprocessing pass so it
          still applies on low-end devices where bloom/EffectComposer is
          skipped. Sits above the canvas but below the crosshair/HUD/radar,
          and leaves the centre untouched so it doesn't dull the reticle. */}
      <div style={{
        position:      'absolute',
        inset:         0,
        background:    'radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.45) 100%)',
        pointerEvents: 'none',
        zIndex:        8,
      }} />

      {/* Muzzle screen flash — brief, subtle; sits below the HUD */}
      <div
        ref={screenFlashRef}
        style={{
          position:      'absolute',
          inset:         0,
          background:    '#ffffff',
          opacity:       0,
          pointerEvents: 'none',
          zIndex:        15,
        }}
      />

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
            borderRadius:   0,
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
          background:     '#0b1220',
          display:        'flex',
          flexDirection:  'column',
          alignItems:     'center',
          justifyContent: 'flex-start',
          paddingTop:     '18%',
          paddingLeft:    'calc(32px + env(safe-area-inset-left))',
          paddingRight:   'calc(32px + env(safe-area-inset-right))',
          paddingBottom:  'calc(40px + env(safe-area-inset-bottom))',
          zIndex:         20,
          pointerEvents:  'all',
          overflow:       'hidden',
        }}>
          {/* Heading */}
          <div style={{
            fontFamily:   "'Squada One', sans-serif",
            fontSize:     '34px',
            color:        '#f4813f',
            marginBottom: 28,
          }}>
            Paused
          </div>

          {/* Stats */}
          <div style={{ display: 'flex', flexDirection: 'column', width: '100%', maxWidth: 320 }}>

            {/* Kills */}
            <div style={{
              display:        'flex',
              flexDirection:  'column',
              alignItems:     'center',
              border:         '1px solid rgba(245,242,234,0.14)',
              padding:        '14px 16px',
              marginBottom:   24,
            }}>
              <div style={{
                fontFamily:    "'Open Sans', sans-serif",
                fontSize:      '10px',
                fontWeight:    800,
                letterSpacing: '0.20em',
                textTransform: 'uppercase',
                color:         '#f5f2ea',
                opacity:       0.4,
                marginBottom:  6,
              }}>
                Kills
              </div>
              <div style={{ fontFamily: "'Squada One', sans-serif", fontSize: '52px', color: '#f5f2ea', lineHeight: 1 }}>
                {score}
              </div>
            </div>

            {/* Lives + Incoming */}
            <div style={{
              display:        'flex',
              justifyContent: 'space-around',
              alignItems:     'flex-start',
              border:         '1px solid rgba(245,242,234,0.14)',
              padding:        '16px',
              marginBottom:   28,
            }}>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                <div style={{
                  fontFamily:    "'Open Sans', sans-serif",
                  fontSize:      '10px',
                  fontWeight:    800,
                  letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                  color:         '#f5f2ea',
                  opacity:       0.4,
                }}>
                  Lives
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {Array.from({ length: maxLives }, (_, i) => (
                    <DiamondPip key={i} filled={i < lives} size={14} color="#f4813f" />
                  ))}
                </div>
              </div>

              <div style={{ width: 1, alignSelf: 'stretch', background: 'rgba(245,242,234,0.14)' }} />

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                <div style={{
                  fontFamily:    "'Open Sans', sans-serif",
                  fontSize:      '10px',
                  fontWeight:    800,
                  letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                  color:         '#f5f2ea',
                  opacity:       0.4,
                }}>
                  Incoming
                </div>
                <div style={{
                  fontFamily: "'Squada One', sans-serif",
                  fontSize:   '28px',
                  color:      enemyCount > 0 ? '#f4813f' : 'rgba(245,242,234,0.4)',
                  lineHeight: 1,
                }}>
                  {enemyCount > 0 ? enemyCount : 'Clear'}
                </div>
              </div>

            </div>
          </div>

          {/* Quit to menu */}
          <button
            onClick={onStop}
            style={{
              width:          '100%',
              maxWidth:       320,
              padding:        '1rem 1.5rem',
              fontFamily:     "'Open Sans', sans-serif",
              fontSize:       '13px',
              fontWeight:     800,
              letterSpacing:  '0.14em',
              textTransform:  'uppercase',
              color:          '#f5f2ea',
              background:     'transparent',
              border:         '1.5px solid rgba(245,242,234,0.14)',
              borderRadius:   0,
              cursor:         'pointer',
            }}
          >
            Quit to Menu
          </button>
        </div>
      )}

      <GameOverlay onFire={!paused ? fireProjectile : undefined} gameOver={gameFailed || paused} crosshairType={crosshairType} />
      <InstructionsOverlay onDismissed={() => setGameStarted(true)} />

    </div>
  );
}
