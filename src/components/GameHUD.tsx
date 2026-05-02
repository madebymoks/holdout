import { useRef, useEffect, type CSSProperties } from 'react';
import PixelHeart from './PixelHeart';

interface Props {
  score:     number;
  enemyCount: number;
  lives:     number;
  maxLives:  number;
  onStop:    () => void;
}

const FONT      = "'Open Sans', sans-serif";
const LOGO_FONT = "'Squada One', sans-serif";
const ACCENT    = '#f28f68';
const TEXT_DIM  = 'rgba(255, 255, 255, 0.55)';
const TEXT_MAIN = '#ffffff';
const DIVIDER   = 'rgba(100, 80, 50, 0.25)';
const LIFE_FILL = '#e05c3a';
const LIFE_EMPTY = 'rgba(255,255,255,0.12)';
const LIFE_BORDER = 'rgba(255,255,255,0.30)';

const labelStyle: CSSProperties = {
  fontFamily:    FONT,
  fontSize:      '9px',
  fontWeight:    700,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  color:         TEXT_DIM,
  marginBottom:  6,
};

function LifeIcon({ filled, animating }: { filled: boolean; animating: boolean }) {
  return (
    <PixelHeart
      size={16}
      color={LIFE_FILL}
      emptyColor={LIFE_EMPTY}
      filled={filled}
      style={{
        opacity:    filled ? 1 : 0.25,
        transform:  animating ? 'scale(0.5)' : 'scale(1)',
        transition: 'opacity 0.4s ease, transform 0.4s ease',
      }}
    />
  );
}

export default function GameHUD({ score, enemyCount, lives, maxLives, onStop }: Props) {
  const scoreFontSize = score >= 1000 ? '22px' : score >= 100 ? '26px' : '32px';

  // Track which icon is mid-animation (the one just lost)
  const prevLives    = useRef(lives);
  const animatingIdx = useRef<number | null>(null);

  if (lives < prevLives.current) {
    animatingIdx.current = lives; // index of the icon that just became empty
  }
  if (lives > prevLives.current) {
    animatingIdx.current = null;
  }
  prevLives.current = lives;

  // Clear the animating flag after transition completes
  useEffect(() => {
    if (animatingIdx.current === null) return;
    const id = setTimeout(() => { animatingIdx.current = null; }, 450);
    return () => clearTimeout(id);
  }, [lives]);

  return (
    <div style={{
      position:      'absolute',
      top:           0,
      left:          0,
      right:         0,
      paddingTop:    'calc(16px + env(safe-area-inset-top))',
      zIndex:        20,
      pointerEvents: 'none',
    }}>
      <div style={{
        background:   'transparent',
        display:      'flex',
        alignItems:   'center',
        height:       68,
        paddingLeft:  'calc(24px + env(safe-area-inset-left))',
        paddingRight: 'calc(16px + env(safe-area-inset-right))',
        borderBottom: `1px solid ${DIVIDER}`,
      }}>

        {/* ── SCORE ── */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
          <div style={labelStyle}>Kills</div>
          <div style={{
            fontFamily: LOGO_FONT,
            fontSize:   scoreFontSize,
            color:      TEXT_MAIN,
            lineHeight: 1,
          }}>
            {score}
          </div>
        </div>

        {/* divider */}
        <div style={{ width: 1, height: 38, background: DIVIDER, flexShrink: 0 }} />

        {/* ── LIVES ── */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
          <div style={labelStyle}>Lives</div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {Array.from({ length: maxLives }, (_, i) => (
              <LifeIcon
                key={i}
                filled={i < lives}
                animating={i === animatingIdx.current}
              />
            ))}
          </div>
        </div>

        {/* divider */}
        <div style={{ width: 1, height: 38, background: DIVIDER, flexShrink: 0 }} />

        {/* ── INCOMING ── */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
          <div style={labelStyle}>Incoming</div>
          <div style={{
            fontFamily: LOGO_FONT,
            fontSize:   '20px',
            color:      enemyCount > 0 ? TEXT_MAIN : TEXT_DIM,
            lineHeight: 1,
          }}>
            {enemyCount > 0 ? enemyCount : 'clear'}
          </div>
        </div>

        {/* ── Stop button ── */}
        <button
          onClick={onStop}
          style={{
            pointerEvents:  'all',
            marginLeft:     16,
            flexShrink:     0,
            background:     'transparent',
            border:         `1.5px solid ${DIVIDER}`,
            borderRadius:   6,
            width:          32,
            height:         32,
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'center',
            cursor:         'pointer',
            color:          TEXT_DIM,
            fontSize:       '18px',
            lineHeight:     1,
            fontFamily:     FONT,
            padding:        0,
          }}
        >
          ×
        </button>

      </div>
    </div>
  );
}
