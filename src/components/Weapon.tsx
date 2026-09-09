import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import { createPortal, useFrame, useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { Group, MathUtils, Mesh, MeshStandardMaterial } from 'three';
import modelUrl from './models/laser_gun.glb?url';

useGLTF.preload(modelUrl);

// Local offset from the camera — lower-right quadrant of the view. The
// model's grip/stock sits near its own origin with the barrel extending
// along local +Z, so a ~180° yaw is needed to point the muzzle away from
// the camera (into the scene) instead of toward it, angled up/left toward
// the crosshair at screen centre.
const WEAPON_POSITION: [number, number, number] = [0.16, -0.65, -0.12];
const WEAPON_ROTATION: [number, number, number] = [0.42, -3.02, 0];
const WEAPON_SCALE = 0.6885;

const IDLE_PERIOD_S = 2;
const IDLE_AMPLITUDE = 0.002;
const SWAY_LERP_FACTOR = 0.15;
const SWAY_STRENGTH = 4; // scales camera turn speed into a sway kick

// The barrel opening: BodyC2Model is the foremost part of the model, its tip
// cross-section centred at (0, 0.13, 1.109) — measured directly off the
// loaded geometry rather than eyeballed, with a hair of overhang past it.
const MUZZLE_TIP: [number, number, number] = [0, 0.14, 1.28];

const KICK_DISTANCE = 0.035; // local -Z (toward the stock) at the moment of firing
const KICK_DURATION_S = 0.15;
const EMISSIVE_BOOST = 4;
const EMISSIVE_FLASH_FRAMES = 1;
const MUZZLE_FLASH_FRAMES = 3;

// The model's baked-in strip material was too dim to read as "self-lit" at
// rest — force the resting glow up to a fixed, guaranteed-visible level
// (independent of whatever the glTF happened to author) and pin the hue to
// the same cyan used everywhere else in the HUD/scene (grid floor, boundary
// ring) so the accent reads as one consistent design language.
const WEAPON_STRIP_COLOR = '#00f0ff';
const WEAPON_STRIP_BASE_INTENSITY = 2.2;

// Small light rigidly following the camera (added at the top level of the
// camera-parented portal below, not inside the swaying/recoiling group) so
// the weapon reads consistently as the player turns, independent of world
// lighting/facing direction.
const VIEWMODEL_LIGHT_POSITION: [number, number, number] = [0.15, -0.25, 0.25];

// Spikes are octahedra (a bipyramid — naturally pointed at both ends of one
// axis) squashed flat and elongated, giving sharp glass-shard tips instead
// of a rounded blob. Each is [length, thickness, thickness, zRotation].
const FLARE_SPIKES: [number, number, number, number][] = [
  [0.34, 0.014, 0.014, 0.5],   // dominant streak, matches the reference's long spike
  [0.16, 0.012, 0.012, -1.1],  // shorter counter-streak
  [0.10, 0.010, 0.010, 0],
  [0.10, 0.010, 0.010, Math.PI / 2.2],
  [0.075, 0.009, 0.009, 2.4],
  [0.075, 0.009, 0.009, -2.0],
];
const SPARK_COUNT = 6;

export interface WeaponHandle {
  fire: () => void;
}

const Weapon = forwardRef<WeaponHandle>((_props, ref) => {
  const { camera, scene, clock } = useThree();
  const { scene: weaponScene } = useGLTF(modelUrl);
  const groupRef = useRef<Group>(null);
  const flashRef = useRef<Group>(null);
  const sparkRefs = useRef<(Mesh | null)[]>([]);
  const sway = useRef({ x: 0, y: 0 });
  const prevCameraRotation = useRef({ x: camera.rotation.x, y: camera.rotation.y });
  const kickStart = useRef(-Infinity);
  const flashSpin = useRef(0);
  const emissiveFlashFrames = useRef(0);
  const muzzleFlashFrames = useRef(0);

  // R3F's default camera isn't part of the scene graph, so anything
  // parented to it won't be rendered unless the camera itself is added.
  // Its local transform stays at the origin, so this doesn't affect
  // where the camera looks or how DeviceOrientationControls drives it.
  useEffect(() => {
    scene.add(camera);
    return () => { scene.remove(camera); };
  }, [camera, scene]);

  const { model, emissiveParts } = useMemo(() => {
    const clone = weaponScene.clone(true);
    const parts: { material: MeshStandardMaterial; baseIntensity: number }[] = [];
    clone.traverse(o => {
      if (o instanceof Mesh) {
        o.castShadow = false;
        o.receiveShadow = false;
        o.renderOrder = 999;
        o.frustumCulled = false;

        // The cyan light-strip parts of this model are named "*Emission*"
        // in the source glTF — force them to a guaranteed-visible resting
        // glow (the baked value was too dim to read against a dark scene),
        // then boost those specifically for the fire flash as before.
        if (/emission/i.test(o.name) && o.material instanceof MeshStandardMaterial) {
          const material = o.material.clone();
          material.emissive.set(WEAPON_STRIP_COLOR);
          material.emissiveIntensity = WEAPON_STRIP_BASE_INTENSITY;
          o.material = material;
          parts.push({ material, baseIntensity: material.emissiveIntensity });
        }
      }
    });
    return { model: clone, emissiveParts: parts };
  }, [weaponScene]);

  useImperativeHandle(ref, () => ({
    fire() {
      kickStart.current = clock.elapsedTime;
      emissiveFlashFrames.current = EMISSIVE_FLASH_FRAMES;
      muzzleFlashFrames.current = MUZZLE_FLASH_FRAMES;

      // Randomise the flare's spin and spark scatter so consecutive shots
      // don't look identical.
      flashSpin.current = Math.random() * Math.PI * 2;
      for (const spark of sparkRefs.current) {
        if (!spark) continue;
        const angle = Math.random() * Math.PI * 2;
        const radius = 0.025 + Math.random() * 0.05;
        spark.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius, 0);
        spark.scale.setScalar(0.6 + Math.random() * 0.8);
      }
    },
  }), [clock]);

  useFrame(state => {
    const group = groupRef.current;
    if (!group) return;

    // Idle drift — slow vertical bob so the weapon reads as physically held
    const bob = Math.sin((state.clock.elapsedTime * Math.PI * 2) / IDLE_PERIOD_S) * IDLE_AMPLITUDE;
    group.position.set(WEAPON_POSITION[0], WEAPON_POSITION[1] + bob, WEAPON_POSITION[2]);

    // Movement sway — kick away from rest when the camera turns, then lerp
    // back toward the base rotation so the weapon lags and settles.
    const deltaX = camera.rotation.x - prevCameraRotation.current.x;
    const deltaY = camera.rotation.y - prevCameraRotation.current.y;
    prevCameraRotation.current.x = camera.rotation.x;
    prevCameraRotation.current.y = camera.rotation.y;

    sway.current.x = MathUtils.lerp(sway.current.x - deltaX * SWAY_STRENGTH, 0, SWAY_LERP_FACTOR);
    sway.current.y = MathUtils.lerp(sway.current.y - deltaY * SWAY_STRENGTH, 0, SWAY_LERP_FACTOR);

    group.rotation.set(
      WEAPON_ROTATION[0] + sway.current.x,
      WEAPON_ROTATION[1] + sway.current.y,
      WEAPON_ROTATION[2],
    );

    // Fire recoil — sharp kick backward along the weapon's own local Z axis,
    // eased back to rest over KICK_DURATION_S.
    const t = MathUtils.clamp((state.clock.elapsedTime - kickStart.current) / KICK_DURATION_S, 0, 1);
    const kick = KICK_DISTANCE * (1 - t) ** 3;
    if (kick > 0) group.translateZ(-kick);

    // Emissive flash — boost the cyan strip material for a single frame
    const boosted = emissiveFlashFrames.current > 0;
    if (emissiveFlashFrames.current > 0) emissiveFlashFrames.current -= 1;
    for (const part of emissiveParts) {
      part.material.emissiveIntensity = boosted ? part.baseIntensity * EMISSIVE_BOOST : part.baseIntensity;
    }

    // Muzzle flash — brief burst at the barrel tip. Billboarded: its
    // quaternion cancels the weapon group's rotation so it always faces the
    // camera flat-on, like the 2D reference, instead of being foreshortened
    // by whatever angle the barrel happens to be sitting at.
    if (flashRef.current) {
      flashRef.current.quaternion.copy(group.quaternion).invert();
      flashRef.current.rotateZ(flashSpin.current);
      flashRef.current.visible = muzzleFlashFrames.current > 0;
      if (muzzleFlashFrames.current > 0) muzzleFlashFrames.current -= 1;
    }
  });

  return createPortal(
    <group ref={groupRef} position={WEAPON_POSITION} rotation={WEAPON_ROTATION} scale={WEAPON_SCALE}>
      <primitive object={model} />
      {/* Viewmodel light — rides along with the weapon group (camera-parented,
          same as everything else here), so it consistently lights the gun as
          the player turns, independent of world lighting. Short
          distance/decay keeps its influence local to the gun rather than
          relighting the world. */}
      <pointLight position={VIEWMODEL_LIGHT_POSITION} intensity={1.3} distance={2} decay={2} color="#fff2df" />
      <group ref={flashRef} position={MUZZLE_TIP} visible={false} renderOrder={1000}>
        {/* Bright white-hot core */}
        <mesh>
          <sphereGeometry args={[0.026, 10, 10]} />
          <meshStandardMaterial color="#fffaf0" emissive="#fff2c4" emissiveIntensity={10} toneMapped={false} />
        </mesh>

        {/* Radiating shards — octahedra squashed into thin double-pointed
            spindles, sharper and more "glass shard" than a flat plane star. */}
        {FLARE_SPIKES.map(([length, thickness, , zRotation], i) => (
          <mesh key={i} rotation={[0, 0, zRotation]} scale={[length / 2, thickness, thickness]}>
            <octahedronGeometry args={[1, 0]} />
            <meshStandardMaterial
              color={i === 0 ? '#fff3d6' : '#ffd27a'}
              emissive={i === 0 ? '#ffe9a0' : '#ff9a3c'}
              emissiveIntensity={i === 0 ? 9 : 6}
              toneMapped={false}
            />
          </mesh>
        ))}

        {/* Scattered sparks — small debris flecks thrown off the core,
            re-randomised in position and size on every shot */}
        {Array.from({ length: SPARK_COUNT }, (_, i) => (
          <mesh key={i} ref={el => { sparkRefs.current[i] = el; }}>
            <octahedronGeometry args={[0.012, 0]} />
            <meshStandardMaterial color="#ffb15c" emissive="#ff7a2e" emissiveIntensity={7} toneMapped={false} />
          </mesh>
        ))}
      </group>
    </group>,
    camera,
  );
});

Weapon.displayName = 'Weapon';
export default Weapon;
