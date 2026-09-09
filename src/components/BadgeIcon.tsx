import type { BadgeEmblemType } from '../hooks/useMissions';

interface Props {
  emblem: BadgeEmblemType;
  earned: boolean;
  size?:  number;
}

const ICE = '#7de8f2';
const DIM = 'rgba(245,242,234,0.28)';
const c = 50;

// Small inline-SVG emblems for the badge shelf — cold cyan/ice when earned,
// a dim outline silhouette when not. Placeholder-quality line art, but each
// emblem is a distinct shape so the shelf reads at a glance.
export default function BadgeIcon({ emblem, earned, size = 40 }: Props) {
  const stroke = earned ? ICE : DIM;
  const fill   = earned ? 'rgba(0,240,255,0.12)' : 'none';
  const glow: React.CSSProperties | undefined = earned
    ? { filter: 'drop-shadow(0 0 4px rgba(125,232,242,0.55))' }
    : undefined;

  let shape: React.ReactNode;
  switch (emblem) {
    case 'droplet':
      shape = <path d="M50 14 C63 33 71 45 71 57 A21 21 0 0 1 29 57 C29 45 37 33 50 14 Z" fill={fill} stroke={stroke} strokeWidth={3} strokeLinejoin="round" />;
      break;
    case 'bars':
      shape = (
        <g fill="none" stroke={stroke} strokeWidth={6} strokeLinecap="round">
          <line x1={30} y1={72} x2={30} y2={54} />
          <line x1={50} y1={72} x2={50} y2={38} />
          <line x1={70} y1={72} x2={70} y2={24} />
        </g>
      );
      break;
    case 'chevrons':
      shape = (
        <g fill="none" stroke={stroke} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round">
          <path d="M26 42 L50 24 L74 42" />
          <path d="M26 56 L50 38 L74 56" />
          <path d="M26 70 L50 52 L74 70" />
        </g>
      );
      break;
    case 'shield':
      shape = <path d="M50 15 L77 25 V49 C77 66 65 77 50 85 C35 77 23 66 23 49 V25 Z" fill={fill} stroke={stroke} strokeWidth={3.5} strokeLinejoin="round" />;
      break;
    case 'cycle':
      shape = (
        <g fill="none" stroke={stroke} strokeWidth={4.5} strokeLinecap="round" strokeLinejoin="round">
          <path d="M26 42 A24 24 0 0 1 69 27" />
          <path d="M74 58 A24 24 0 0 1 31 73" />
          <path d="M60 20 L69 27 L64 38" fill="none" />
          <path d="M40 80 L31 73 L36 62" fill="none" />
        </g>
      );
      break;
    case 'skull-reticle':
      shape = (
        <g fill="none" stroke={stroke} strokeWidth={3}>
          <circle cx={c} cy={c} r={34} />
          <line x1={c} y1={8}  x2={c} y2={22} />
          <line x1={c} y1={78} x2={c} y2={92} />
          <line x1={8}  y1={c} x2={22} y2={c} />
          <line x1={78} y1={c} x2={92} y2={c} />
          <circle cx={41} cy={46} r={5} fill={stroke} stroke="none" />
          <circle cx={59} cy={46} r={5} fill={stroke} stroke="none" />
          <path d="M39 60 Q50 68 61 60" strokeWidth={3} strokeLinecap="round" />
        </g>
      );
      break;
    case 'target-dart':
      shape = (
        <g fill="none" stroke={stroke} strokeWidth={3}>
          <circle cx={c} cy={c} r={33} />
          <circle cx={c} cy={c} r={19} />
          <circle cx={c} cy={c} r={4} fill={stroke} stroke="none" />
          <line x1={74} y1={26} x2={57} y2={43} strokeWidth={4} strokeLinecap="round" />
          <path d="M74 26 L85 17 L83 31 Z" fill={stroke} stroke="none" />
        </g>
      );
      break;
    case 'skull-crown':
      shape = (
        <g fill="none" stroke={stroke} strokeWidth={3}>
          <circle cx={c} cy={58} r={25} />
          <circle cx={41} cy={54} r={5} fill={stroke} stroke="none" />
          <circle cx={59} cy={54} r={5} fill={stroke} stroke="none" />
          <path d="M40 68 Q50 76 60 68" strokeWidth={3} strokeLinecap="round" />
          <path d="M25 33 L33 17 L41 30 L50 14 L59 30 L67 17 L75 33" strokeLinejoin="round" />
        </g>
      );
      break;
  }

  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={glow}>
      {shape}
    </svg>
  );
}
