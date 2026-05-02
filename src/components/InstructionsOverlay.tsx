import { useState, useEffect, useCallback } from 'react';

const FONT      = "'Open Sans', sans-serif";
const LOGO_FONT = "'Squada One', sans-serif";
const STORAGE_KEY = 'striker_instructions_shown';
const AUTO_DISMISS_MS = 6000;

const STEPS = [
  { icon: '📱', label: 'Aim', text: 'Tilt and rotate your phone to move the crosshair.' },
  { icon: '👆', label: 'Shoot', text: 'Tap anywhere on screen to fire.' },
  { icon: '🗺️', label: 'Radar', text: 'The map shows where enemies are coming from. Rotate to face them.' },
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
        background:     'rgba(26, 18, 8, 0.62)',
        backdropFilter: 'blur(3px)',
        WebkitBackdropFilter: 'blur(3px)',
        opacity:        fading ? 0 : 1,
        transition:     'opacity 0.4s ease',
        pointerEvents:  'all',
        padding:        '32px',
      }}
    >
      <div style={{
        background:   'rgba(228, 213, 168, 0.96)',
        borderRadius: '16px',
        padding:      '28px 24px',
        maxWidth:     300,
        width:        '100%',
      }}>
        {/* Title */}
        <div style={{
          fontFamily:    LOGO_FONT,
          fontSize:      '22px',
          color:         '#1a1208',
          letterSpacing: '0.06em',
          marginBottom:  20,
          textAlign:     'center',
        }}>
          How to Play
        </div>

        {/* Steps */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {STEPS.map((step, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <div style={{ fontSize: '18px', flexShrink: 0, lineHeight: 1.4 }}>{step.icon}</div>
              <div>
                <span style={{
                  fontFamily: LOGO_FONT,
                  fontSize:   '14px',
                  color:      '#f28f68',
                  letterSpacing: '0.04em',
                }}>
                  {step.label}
                </span>
                <span style={{
                  fontFamily: FONT,
                  fontSize:   '13px',
                  color:      '#1a1208',
                  lineHeight: 1.55,
                  fontWeight: 500,
                }}>
                  {' — '}{step.text}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Tip */}
        <div style={{
          fontFamily:  FONT,
          fontSize:    '12px',
          color:       '#1a1208',
          opacity:     0.6,
          marginTop:   18,
          fontStyle:   'italic',
          lineHeight:  1.5,
        }}>
          💡 Tip: Hold your phone up and face forward to begin. Spin your whole body — enemies attack from all directions!
        </div>

        {/* Dismiss hint */}
        <div style={{
          fontFamily:  FONT,
          fontSize:    '11px',
          color:       '#1a1208',
          opacity:     0.35,
          textAlign:   'center',
          marginTop:   14,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
        }}>
          Tap anywhere to dismiss
        </div>
      </div>
    </div>
  );
}
