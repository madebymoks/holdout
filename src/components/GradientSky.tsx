import { useMemo } from 'react';
import { BackSide } from 'three';

const vertexShader = /* glsl */`
  varying vec3 vWorldPosition;
  void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPos.xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */`
  varying vec3 vWorldPosition;
  uniform vec3 uTopColor;
  uniform vec3 uBottomColor;
  uniform float uOffset;
  uniform float uExponent;

  void main() {
    float h = normalize(vWorldPosition).y;
    float t = max(0.0, pow(max(0.0, h + uOffset), uExponent));
    gl_FragColor = vec4(mix(uBottomColor, uTopColor, t), 1.0);
  }
`;

export default function GradientSky() {
  const uniforms = useMemo(() => ({
    uTopColor:    { value: [0.894, 0.878, 0.729] }, // #e4e0ba
    uBottomColor: { value: [0.969, 0.851, 0.667] }, // #f7d9aa
    uOffset:      { value: 0.2 },
    uExponent:    { value: 0.5 },
  }), []);

  return (
    <mesh scale={[500, 500, 500]}>
      <sphereGeometry args={[1, 32, 16]} />
      <shaderMaterial
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        side={BackSide}
      />
    </mesh>
  );
}
