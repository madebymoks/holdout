import { useRef, useEffect } from 'react';

// Matches the game's GridFloor shader exactly:
//   colour  : #00f0ff  (uColor: [0.0, 0.941, 1.0])
//   opacity : 0.30 + 0.10 * sin(t * 0.6)  (same pulse)
//   fade    : radial from centre, transparent at edges + horizon

const R = 0, G = 240, B = 255;
const rgba = (a: number) => `rgba(${R},${G},${B},${a.toFixed(4)})`;

export default function MenuGridFloor() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let animId: number;
    const t0 = performance.now();

    // Use ResizeObserver so dimensions are set as soon as the element has layout,
    // even if that happens after the initial React render (e.g. Ionic page transitions).
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const cw  = canvas.offsetWidth;
      const ch  = canvas.offsetHeight;
      if (cw > 0 && ch > 0) {
        canvas.width  = cw * dpr;
        canvas.height = ch * dpr;
      }
    };

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize(); // also try immediately in case layout is already ready

    const draw = (now: number) => {
      const elapsed = (now - t0) / 1000;
      const ctx = canvas.getContext('2d');
      const w   = canvas.width;
      const h   = canvas.height;

      // Skip frames until the canvas has real dimensions
      if (!ctx || w === 0 || h === 0) { animId = requestAnimationFrame(draw); return; }

      const cx = w / 2;

      // Mirror the game shader's opacity pulse
      const baseAlpha = 0.30 + 0.10 * Math.sin(elapsed * 0.6);

      ctx.clearRect(0, 0, w, h);

      // ── Perspective projection ────────────────────────────────────────────
      // Camera at height camH above floor, focal length = h.
      // screenY(z) = camH * h / z  →  horizon at screenY=0, near clip at screenY=h.
      // nearZ = camH so that screenY(nearZ) = h (bottom of canvas).
      const camH  = 1.5;
      const fL    = h;
      const nearZ = camH;          // 1.5 — bottom edge of canvas
      const farZ  = nearZ * 28;    // far clip
      const step  = 1.0;           // world-unit cell size (square grid)

      // Visible half-width at near clip (world units)
      const halfW = (w / 2) * (nearZ / fL);  // = w * camH / (2 * h)

      // ── Horizontal lines (constant depth, drawn as screen-horizontal) ─────
      // Enforce a minimum pixel gap so perspective compression doesn't pack
      // lines together near the horizon — keeps the squares looking large.
      const minGapPx = 18;
      let lastSy = h + minGapPx; // sentinel so the first line always draws

      for (let z = nearZ; z < farZ; z += step) {
        const sy = camH * fL / z;        // screen y
        if (sy < 1) break;

        // Skip if too close to the previous drawn line
        if (lastSy - sy < minGapPx) continue;
        lastSy = sy;

        // Depth fade: opaque near bottom, transparent near horizon
        const t     = sy / h;                              // 1=bottom, 0=horizon
        const depth = Math.min(1, Math.pow(t, 1.1) * 3);  // smooth ramp

        const alpha = baseAlpha * depth;
        if (alpha < 0.004) continue;

        const grad = ctx.createLinearGradient(0, sy, w, sy);
        grad.addColorStop(0,    rgba(0));
        grad.addColorStop(0.15, rgba(alpha));
        grad.addColorStop(0.85, rgba(alpha));
        grad.addColorStop(1,    rgba(0));

        ctx.beginPath();
        ctx.lineWidth   = 1;
        ctx.strokeStyle = grad;
        ctx.moveTo(0, sy);
        ctx.lineTo(w, sy);
        ctx.stroke();
      }

      // ── Vertical lines (converge to vanishing point at top centre) ────────
      // Step in screen-pixel space at the bottom edge so spacing is always even
      // regardless of aspect ratio. Fade is based on screen position — lines are
      // fully visible across the canvas and only fade in the outermost 20%.
      const cellPx   = (step * fL) / nearZ;  // canvas px per cell at bottom edge
      const startBx  = cx - Math.ceil(cx / cellPx) * cellPx;

      for (let bx = startBx; bx <= w + cellPx; bx += cellPx) {
        const normX    = Math.abs(bx - cx) / (w * 0.5);
        const sideFade = Math.max(0, 1 - Math.max(0, normX - 0.8) / 0.2);
        if (sideFade < 0.01) continue;

        const grad = ctx.createLinearGradient(cx, 0, bx, h);
        grad.addColorStop(0,    rgba(0));
        grad.addColorStop(0.15, rgba(baseAlpha * sideFade * 0.6));
        grad.addColorStop(1,    rgba(baseAlpha * sideFade));

        ctx.beginPath();
        ctx.lineWidth   = 2;
        ctx.strokeStyle = grad;
        ctx.moveTo(cx, 0);
        ctx.lineTo(bx, h);
        ctx.stroke();
      }

      animId = requestAnimationFrame(draw);
    };

    animId = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animId);
      observer.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position:      'absolute',
        bottom:        0,
        left:          0,
        width:         '100%',
        height:        '33%',
        display:       'block',
        pointerEvents: 'none',
      }}
    />
  );
}
