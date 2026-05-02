import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Mesh, CylinderGeometry, Matrix4 } from 'three';

interface WaveVertex {
  x: number;
  y: number;
  z: number;
  ang: number;
  amp: number;
  speed: number;
}

export default function Sea() {
  const meshRef = useRef<Mesh>(null);
  const wavesRef = useRef<WaveVertex[]>([]);

  const geometry = useMemo(() => {
    const geo = new CylinderGeometry(600, 600, 4000, 80, 20);

    // Preserve your original rotation setup
    geo.applyMatrix4(new Matrix4().makeRotationX(-Math.PI / 2));

    const position = geo.attributes.position;
    for (let i = 0; i < position.count; i++) {
      wavesRef.current[i] = {
        x: position.getX(i),
        y: position.getY(i),
        z: position.getZ(i),
        ang: Math.random() * Math.PI * 2,
        amp: 5 + Math.random() * 15,
        speed: 0.016 + Math.random() * 0.032,
      };
    }

    return geo;
  }, []);

  useFrame(() => {
    if (!meshRef.current) return;

    const position = geometry.attributes.position;

    for (let i = 0; i < wavesRef.current.length; i++) {
      const wave = wavesRef.current[i];
      position.setX(i, wave.x + Math.cos(wave.ang) * wave.amp);
      position.setY(i, wave.y + Math.sin(wave.ang) * wave.amp);
      wave.ang += wave.speed;
    }

    position.needsUpdate = true;
    geometry.computeVertexNormals();

    // Your original rotation axis, preserved
    meshRef.current.rotation.x += 0.005;
  });

  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      position={[0, -650, -300]}
      rotation={[0, Math.PI / 2, 0]}
      receiveShadow
    >
      <meshPhongMaterial
        color="#68c3c0"
        transparent
        opacity={0.99}
        flatShading
      />
    </mesh>
  );
}