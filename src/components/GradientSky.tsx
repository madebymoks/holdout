import { useMemo } from 'react';
import { BackSide, Color } from 'three';

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

interface Props {
  topColor?:    string;
  bottomColor?: string;
}

export default function GradientSky({ topColor = '#0c1626', bottomColor = '#1d2b40' }: Props) {
  const uniforms = useMemo(() => ({
    uTopColor:    { value: new Color(topColor).toArray() },
    uBottomColor: { value: new Color(bottomColor).toArray() },
    uOffset:      { value: 0.2 },
    uExponent:    { value: 0.5 },
  }), [topColor, bottomColor]);

  return (
    // Scaled to sit just inside the camera's far plane (120) so it isn't
    // clipped — this game's camera never moves, so a sphere centred on the
    // origin always fully encloses the view regardless of look direction.
    <mesh scale={[110, 110, 110]}>
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
