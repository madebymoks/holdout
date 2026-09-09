import { useMemo } from 'react';

// Purely decorative — CSS-driven (no rAF loop) since this is a plain DOM
// screen, not a react-three-fiber canvas. Matches the in-game DustMotes'
// look (faint, slow, cool near-white) without needing a 3D context.
const MOTE_COUNT = 40;

interface Mote {
  left:     number; // %
  top:      number; // %, starting position within the zone
  size:     number; // px
  duration: number; // s
  delay:    number;  // s, negative so motes start mid-cycle instead of all at once
  opacity:  number;
}

export default function MenuDustMotes() {
  // Each mote gets its own random starting height within the zone (not just
  // the bottom edge) so, at any moment, some are drifting right across the
  // logo's own band instead of only ever appearing below it.
  const motes = useMemo<Mote[]>(() => (
    Array.from({ length: MOTE_COUNT }, () => ({
      left:     Math.random() * 100,
      top:      Math.random() * 100,
      size:     1 + Math.random() * 2,
      duration: 9 + Math.random() * 8,
      delay:    -Math.random() * 16,
      opacity:  0.2 + Math.random() * 0.2,
    }))
  ), []);

  return (
    <div style={{
      position:      'absolute',
      top:           0,
      left:          0,
      right:         0,
      height:        '45%',
      overflow:      'hidden',
      pointerEvents: 'none',
    }}>
      <style>{`
        @keyframes menu-dust-drift {
          0%   { transform: translateY(0); opacity: 0; }
          15%  { opacity: var(--mote-opacity); }
          85%  { opacity: var(--mote-opacity); }
          100% { transform: translateY(-110px); opacity: 0; }
        }
      `}</style>
      {motes.map((m, i) => (
        <div
          key={i}
          style={{
            position:        'absolute',
            top:             `${m.top}%`,
            left:            `${m.left}%`,
            width:           m.size,
            height:          m.size,
            borderRadius:    '50%',
            background:      '#bfeeff',
            ['--mote-opacity' as string]: m.opacity,
            animation:       `menu-dust-drift ${m.duration}s ${m.delay}s linear infinite`,
          }}
        />
      ))}
    </div>
  );
}
