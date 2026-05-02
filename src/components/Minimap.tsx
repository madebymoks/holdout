import { useRef, useEffect } from 'react';
import { Quaternion } from 'three';

interface EnemyPosition { x: number; z: number; }

interface Props {
  enemyPositionsRef: React.RefObject<EnemyPosition[]>;
  cameraQuaternionRef: React.RefObject<Quaternion | null>;
}

const SIZE = 130;
const CENTER = SIZE / 2;
const SCENE_RADIUS = 55;
const SCALE = CENTER / SCENE_RADIUS;

// Cardinal markers — colours must match the scene markers in GameCanvas
export const CARDINAL_COLORS = {
  N: '#0088ff',
  E: '#ff2200',
  S: '#ffcc00',
  W: '#00cc44',
} as const;

const CARDINALS = [
  { color: CARDINAL_COLORS.N, cx: CENTER,      cy: 7            }, // top
  { color: CARDINAL_COLORS.E, cx: SIZE - 7,   cy: CENTER       }, // right
  { color: CARDINAL_COLORS.S, cx: CENTER,      cy: SIZE - 7     }, // bottom
  { color: CARDINAL_COLORS.W, cx: 7,           cy: CENTER       }, // left
];

function extractYaw(q: Quaternion): number {
  const sinY = 2 * (q.w * q.y + q.x * q.z);
  const cosY = 1 - 2 * (q.y * q.y + q.z * q.z);
  return Math.atan2(sinY, cosY);
}

export default function Minimap({ enemyPositionsRef, cameraQuaternionRef }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    let animId: number;

    function draw() {
      animId = requestAnimationFrame(draw);
      ctx.clearRect(0, 0, SIZE, SIZE);

      // Clip to circle
      ctx.save();
      ctx.beginPath();
      ctx.arc(CENTER, CENTER, CENTER - 1, 0, Math.PI * 2);
      ctx.clip();

      // Background
      ctx.fillStyle = 'rgba(18, 14, 8, 0.72)';
      ctx.fillRect(0, 0, SIZE, SIZE);

      // Cardinal marker dots at the four edges
      CARDINALS.forEach(({ color, cx, cy }) => {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(cx, cy, 5, 0, Math.PI * 2);
        ctx.fill();
      });

      // Enemy dots — world-space positions, static relative to scene
      (enemyPositionsRef.current ?? []).forEach(({ x, z }) => {
        const px = CENTER + x * SCALE;
        const pz = CENTER + z * SCALE;
        ctx.fillStyle = '#ff8800';
        ctx.beginPath();
        ctx.arc(px, pz, 3.5, 0, Math.PI * 2);
        ctx.fill();
      });

      // Arrow — rotates to show the camera's world-space facing direction
      // yaw = 0  → camera faces -Z → top of minimap (North) → canvas angle -π/2
      const q = cameraQuaternionRef.current;
      if (q) {
        const yaw = extractYaw(q);
        ctx.save();
        ctx.translate(CENTER, CENTER);
        ctx.rotate(-yaw - Math.PI / 2);
        ctx.fillStyle = 'rgba(255,255,255,0.95)';
        ctx.beginPath();
        ctx.moveTo(14, 0);   // tip
        ctx.lineTo(0, -8);   // top-back corner
        ctx.lineTo(5, 0);    // back notch
        ctx.lineTo(0, 8);    // bottom-back corner
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }

      // Player dot at centre
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(CENTER, CENTER, 3, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();

      // Border ring
      ctx.strokeStyle = 'rgba(255,255,255,0.75)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(CENTER, CENTER, CENTER - 1, 0, Math.PI * 2);
      ctx.stroke();
    }

    draw();
    return () => cancelAnimationFrame(animId);
  }, [enemyPositionsRef, cameraQuaternionRef]);

  return (
    <canvas
      ref={canvasRef}
      width={SIZE}
      height={SIZE}
      style={{
        position: 'absolute',
        bottom: 'calc(24px + env(safe-area-inset-bottom))',
        left: 'calc(24px + env(safe-area-inset-left))',
        zIndex: 20,
        borderRadius: '50%',
        pointerEvents: 'none',
      }}
    />
  );
}
