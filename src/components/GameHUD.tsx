import { useRef, useEffect, type CSSProperties } from 'react';
import DiamondPip from './DiamondPip';

interface Props {
  score:     number;
  enemyCount: number;
  lives:     number;
  maxLives:  number;
  onStop:    () => void;
}

const FONT      = "'Open Sans', sans-serif";
const LOGO_FONT = "'Squada One', sans-serif";
const ACCENT    = '#f4813f';
const TEXT_DIM  = 'rgba(245,242,234,0.5)';
const TEXT_MAIN = '#f5f2ea';
const BORDER    = 'rgba(245,242,234,0.16)';

const labelStyle: CSSProperties = {
  fontFamily:    FONT,
  fontSize:      '10px',
  fontWeight:    800,
  letterSpacing: '0.16em',
  textTransform: 'uppercase',
  color:         TEXT_DIM,
  marginBottom:  6,
};

export default function GameHUD({ score, enemyCount, lives, maxLives, onStop }: Props) {
  const scoreFontSize = score >= 1000 ? '24px' : score >= 100 ? '28px' : '34px';

  // Track which pip is mid-animation (the one just lost)
  const prevLives    = useRef(lives);
  const animatingIdx = useRef<number | null>(null);

  if (lives < prevLives.current) {
    animatingIdx.current = lives; // index of the pip that just became empty
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
      zIndex:        20,
      pointerEvents: 'none',
      background:    'linear-gradient(to bottom, rgba(11,18,32,0.88) 0%, rgba(11,18,32,0.55) 70%, transparent 100%)',
    }}>
      <div style={{
        display:      'grid',
        gridTemplateColumns: '1fr auto 1fr',
        alignItems:   'flex-start',
        paddingTop:   'calc(20px + env(safe-area-inset-top))',
        paddingBottom: 14,
        paddingLeft:  'calc(20px + env(safe-area-inset-left))',
        paddingRight: 'calc(16px + env(safe-area-inset-right))',
        borderBottom: `1px solid ${BORDER}`,
      }}>

        {/* ── KILLS ── */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
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

        {/* ── INCOMING — true centre column, unaffected by the side columns' widths ── */}
        <div style={{
          display:       'flex',
          flexDirection: 'column',
          alignItems:    'center',
          border:        `1px solid ${enemyCount > 0 ? 'rgba(244,129,63,0.4)' : BORDER}`,
          padding:       '6px 14px',
          justifySelf:   'center',
        }}>
          <div style={labelStyle}>Incoming</div>
          <div style={{
            fontFamily: LOGO_FONT,
            fontSize:   '20px',
            color:      enemyCount > 0 ? ACCENT : TEXT_DIM,
            lineHeight: 1,
          }}>
            {enemyCount > 0 ? enemyCount : 'Clear'}
          </div>
        </div>

        {/* ── LIVES + stop, stacked so the button sits top-right ── */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, justifySelf: 'end' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={labelStyle}>Lives</div>
            <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
              {Array.from({ length: maxLives }, (_, i) => (
                <DiamondPip
                  key={i}
                  filled={i < lives}
                  size={9}
                  color={ACCENT}
                  style={{
                    transform:  i === animatingIdx.current ? 'rotate(45deg) scale(0.5)' : 'rotate(45deg) scale(1)',
                    transition: 'opacity 0.4s ease, transform 0.4s ease',
                  }}
                />
              ))}
            </div>
          </div>

          <button
            onClick={onStop}
            style={{
              pointerEvents:  'all',
              flexShrink:     0,
              background:     'transparent',
              border:         `1.5px solid ${BORDER}`,
              borderRadius:   0,
              width:          34,
              height:         34,
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
    </div>
  );
}
