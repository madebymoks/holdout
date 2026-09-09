import { useState, useEffect, useCallback } from 'react';

const FONT      = "'Open Sans', sans-serif";
const LOGO_FONT = "'Squada One', sans-serif";
const STORAGE_KEY = 'striker_instructions_shown';
const AUTO_DISMISS_MS = 6000;

const BG        = '#0b1220';
const TEXT      = '#f5f2ea';
const ACCENT    = '#f4813f';
const DARK      = '#1a1208';
const BORDER    = 'rgba(245,242,234,0.14)';
const CUT_CORNER = 'polygon(0 0, calc(100% - 16px) 0, 100% 16px, 100% 100%, 0 100%)';

const STEPS = [
  { icon: '📱', label: 'Aim', text: 'Tilt and rotate your phone to move the crosshair.' },
  { icon: '👆', label: 'Shoot', text: 'Tap anywhere on screen to fire.' },
  { icon: '🗺️', label: 'Radar', text: 'The map shows where enemies are coming from. Rotate to face them.' },
  { icon: '⚠️', label: 'Incoming', text: 'Watch the count. It rises as more enemies close in.' },
  { icon: '❤️', label: 'Survive', text: "Don't let the humanoids reach you. Stay alive as long as you can." },
];

interface Props {
  onDismissed?: () => void;
}

export default function InstructionsOverlay({ onDismissed }: Props) {
  const [visible, setVisible] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) !== '1'; }
    catch { return true; }
  });
  const [fading, setFading] = useState(false);

  const dismiss = useCallback(() => {
    setFading(true);
    setTimeout(() => {
      setVisible(false);
      try { localStorage.setItem(STORAGE_KEY, '1'); } catch {}
      onDismissed?.();
    }, 400);
  }, []);

  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(dismiss, AUTO_DISMISS_MS);
    return () => clearTimeout(t);
  }, [visible, dismiss]);

  if (!visible) return null;

  return (
    <div
      onClick={dismiss}
      style={{
        position:       'absolute',
        inset:          0,
        zIndex:         30,
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        background:     'rgba(4, 7, 12, 0.72)',
        backdropFilter: 'blur(3px)',
        WebkitBackdropFilter: 'blur(3px)',
        opacity:        fading ? 0 : 1,
        transition:     'opacity 0.4s ease',
        pointerEvents:  'all',
        padding:        '28px',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background:   BG,
          border:       `1px solid ${BORDER}`,
          borderRadius: 0,
          padding:      '24px 22px',
          maxWidth:     320,
          width:        '100%',
        }}
      >
        {/* Section label */}
        <div style={{
          fontFamily:    FONT,
          fontSize:      '9px',
          fontWeight:    800,
          letterSpacing: '0.20em',
          textTransform: 'uppercase',
          color:         ACCENT,
          marginBottom:  8,
        }}>
          Mission Briefing
        </div>

        {/* Title */}
        <div style={{
          fontFamily:   LOGO_FONT,
          fontSize:     '26px',
          color:        TEXT,
          marginBottom: 18,
          lineHeight:   1.05,
        }}>
          How To <span style={{ color: ACCENT }}>Play</span>
        </div>

        {/* Steps */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {STEPS.map((step, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width:          32,
                height:         32,
                flexShrink:     0,
                display:        'flex',
                alignItems:     'center',
                justifyContent: 'center',
                fontSize:       '15px',
                border:         `1px solid ${BORDER}`,
              }}>
                {step.icon}
              </div>
              <div>
                <span style={{
                  fontFamily:    FONT,
                  fontSize:      '11px',
                  fontWeight:    800,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color:         TEXT,
                }}>
                  {step.label}
                </span>
                <span style={{
                  fontFamily: FONT,
                  fontSize:   '12px',
                  color:      TEXT,
                  opacity:    0.65,
                  lineHeight: 1.5,
                  fontWeight: 400,
                }}>
                  {' — '}{step.text}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Tip */}
        <div style={{
          border:       `1px solid ${BORDER}`,
          borderRadius: 0,
          padding:      '10px 12px',
          marginTop:    16,
          fontFamily:   FONT,
          fontSize:     '12px',
          color:        TEXT,
          opacity:      0.65,
          lineHeight:   1.5,
        }}>
          <span style={{ color: ACCENT, fontWeight: 800 }}>Tip:</span> Hold your phone up and face forward to begin. Spin your whole body — enemies attack from all directions!
        </div>

        {/* Dismiss */}
        <button
          onClick={dismiss}
          style={{
            width:          '100%',
            marginTop:      18,
            padding:        '0.75rem 1.5rem',
            fontFamily:     FONT,
            fontSize:       '12px',
            fontWeight:     800,
            letterSpacing:  '0.14em',
            textTransform:  'uppercase',
            color:          DARK,
            background:     ACCENT,
            border:         'none',
            clipPath:       CUT_CORNER,
            cursor:         'pointer',
          }}
        >
          Got It
        </button>
      </div>
    </div>
  );
}
