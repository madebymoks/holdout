import type { CrosshairType } from '../hooks/useCrosshair';

export type { CrosshairType };

interface SVGProps {
  type?:   CrosshairType;
  pulsed?: boolean;
  size?:   string;
}

// Standalone SVG — no positioning wrapper. Used in-game and in settings previews.
export function CrosshairSVG({ type = 'tactical', pulsed = false, size = '25vw' }: SVGProps) {
  const c      = 100;
  const color  = 'white';
  const shadow = { filter: 'drop-shadow(0 0 1.5px rgba(0,0,0,0.9))' } as React.CSSProperties;
  const pulse  = (scale: number): React.CSSProperties => ({
    transformOrigin: '100px 100px',
    transform:       pulsed ? `scale(${scale})` : 'scale(1)',
    transition:      pulsed ? 'none' : 'transform 60ms ease-out',
  });

  // ── Classic ──────────────────────────────────────────────────────────────
  if (type === 'classic') {
    const gap = 14, len = 26, lw = 2;
    return (
      <svg width={size} height={size} viewBox="0 0 200 200" style={shadow}>
        <g style={pulse(1.4)}>
          <line x1={c}       y1={c-gap-len} x2={c}       y2={c-gap}     stroke={color} strokeWidth={lw} strokeLinecap="round" />
          <line x1={c}       y1={c+gap}     x2={c}       y2={c+gap+len} stroke={color} strokeWidth={lw} strokeLinecap="round" />
          <line x1={c-gap-len} y1={c}       x2={c-gap}   y2={c}         stroke={color} strokeWidth={lw} strokeLinecap="round" />
          <line x1={c+gap}   y1={c}         x2={c+gap+len} y2={c}       stroke={color} strokeWidth={lw} strokeLinecap="round" />
        </g>
        <circle cx={c} cy={c} r={2.5} fill={color} />
      </svg>
    );
  }

  // ── Dot ──────────────────────────────────────────────────────────────────
  if (type === 'dot') {
    return (
      <svg width={size} height={size} viewBox="0 0 200 200" style={shadow}>
        <circle cx={c} cy={c} r={5} fill={color} style={pulse(2.2)} />
      </svg>
    );
  }

  // ── Circle ───────────────────────────────────────────────────────────────
  if (type === 'circle') {
    return (
      <svg width={size} height={size} viewBox="0 0 200 200" style={shadow}>
        <circle cx={c} cy={c} r={52} fill="none" stroke={color} strokeWidth={2} style={pulse(1.3)} />
        <circle cx={c} cy={c} r={3}  fill={color} />
      </svg>
    );
  }

  // ── Tactical (default) ───────────────────────────────────────────────────
  const r = 88;
  const ticks = [20, 30, 40, 50, 60, 70];
  const tickLen = 6;
  const capDist = 78, capThick = 9, capLen = 16;
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" style={shadow}>
      <circle cx={c} cy={c} r={r} fill="none" stroke={color} strokeWidth={2.5} style={pulse(1.4)} />
      <line x1={c} y1={c-r} x2={c} y2={c+r} stroke={color} strokeWidth={1.5} />
      <line x1={c-r} y1={c} x2={c+r} y2={c} stroke={color} strokeWidth={1.5} />
      <rect x={c-capThick/2} y={c-capDist-capLen/2} width={capThick} height={capLen} fill={color} />
      <rect x={c-capThick/2} y={c+capDist-capLen/2} width={capThick} height={capLen} fill={color} />
      <rect x={c-capDist-capLen/2} y={c-capThick/2} width={capLen}  height={capThick} fill={color} />
      <rect x={c+capDist-capLen/2} y={c-capThick/2} width={capLen}  height={capThick} fill={color} />
      {ticks.map(d => (
        <g key={`v${d}`}>
          <line x1={c-tickLen/2} y1={c-d} x2={c+tickLen/2} y2={c-d} stroke={color} strokeWidth={1.5} />
          <line x1={c-tickLen/2} y1={c+d} x2={c+tickLen/2} y2={c+d} stroke={color} strokeWidth={1.5} />
        </g>
      ))}
      {ticks.map(d => (
        <g key={`h${d}`}>
          <line x1={c-d} y1={c-tickLen/2} x2={c-d} y2={c+tickLen/2} stroke={color} strokeWidth={1.5} />
          <line x1={c+d} y1={c-tickLen/2} x2={c+d} y2={c+tickLen/2} stroke={color} strokeWidth={1.5} />
        </g>
      ))}
    </svg>
  );
}

// Default export — centred absolute overlay, used standalone if needed.
export default function Crosshair({ type = 'tactical', pulsed = false }: { type?: CrosshairType; pulsed?: boolean }) {
  return (
    <div style={{
      position:       'absolute',
      inset:          0,
      display:        'flex',
      alignItems:     'center',
      justifyContent: 'center',
      pointerEvents:  'none',
    }}>
      <CrosshairSVG type={type} pulsed={pulsed} />
    </div>
  );
}
