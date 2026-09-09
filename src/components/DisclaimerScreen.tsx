import { useState } from 'react';
import { IonContent, IonPage } from '@ionic/react';
import logoImg from './images/HOLDOUT_logo.png';

const FONT      = "'Open Sans', sans-serif";
const LOGO_FONT = "'Squada One', sans-serif";
const BG        = '#0b1220';
const TEXT      = '#f5f2ea';
const DIM       = 'rgba(245,242,234,0.45)';
const BORDER    = 'rgba(245,242,234,0.14)';
const ACCENT    = '#f4813f';
const DARK      = '#1a1208';

const SAFE_PAD = 'calc(28px + env(safe-area-inset-top)) calc(32px + env(safe-area-inset-right)) calc(40px + env(safe-area-inset-bottom)) calc(32px + env(safe-area-inset-left))';

// Shared "cut corner" panel shape used across the redesign's buttons/tags
const CUT_CORNER = 'polygon(0 0, calc(100% - 18px) 0, 100% 18px, 100% 100%, 0 100%)';

interface Props {
  onContinue: () => void;
}

export default function DisclaimerScreen({ onContinue }: Props) {
  const [checked, setChecked] = useState(false);

  return (
    <IonPage>
      <IonContent fullscreen>
        <div style={{ position: 'absolute', inset: 0, background: BG, overflowY: 'auto' }}>

          {/* Hazard stripe */}
          <div style={{
            width:      '100%',
            height:     8,
            background: `repeating-linear-gradient(135deg, ${ACCENT} 0 12px, #000 12px 24px)`,
          }} />

          <div style={{
            display:        'flex',
            flexDirection:  'column',
            alignItems:     'flex-start',
            padding:        SAFE_PAD,
          }}>

            {/* Logo */}
            <img
              src={logoImg}
              alt="Holdout"
              style={{ width: 120, marginBottom: 28, userSelect: 'none', alignSelf: 'center' }}
            />

            {/* Section label */}
            <div style={{
              display:       'flex',
              alignItems:    'center',
              gap:           8,
              fontFamily:    FONT,
              fontSize:      '10px',
              fontWeight:    800,
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              color:         ACCENT,
              marginBottom:  10,
            }}>
              <span>⚠</span> Simulation Briefing
            </div>

            {/* Heading */}
            <div style={{
              fontFamily:   LOGO_FONT,
              fontSize:     '34px',
              lineHeight:   1.05,
              color:        TEXT,
              marginBottom: 24,
              letterSpacing: '0.01em',
            }}>
              Clear the<br />
              <span style={{ color: ACCENT }}>Area</span> First
            </div>

            {/* Disclaimer text card */}
            <div style={{
              width:        '100%',
              border:       `1px solid ${BORDER}`,
              borderRadius: 0,
              padding:      '16px 18px',
              marginBottom: 28,
              boxSizing:    'border-box',
            }}>
              <div style={{
                fontFamily: FONT,
                fontSize:   '13.5px',
                fontWeight: 400,
                color:      TEXT,
                opacity:    0.75,
                lineHeight: 1.75,
                textAlign:  'left',
              }}>
                Holdout requires physical movement. Please ensure you are in a safe,
                clear open space before playing. Be aware of your surroundings at all
                times. The developer is not responsible for any injury, damage, or
                accident that occurs during gameplay.
              </div>
            </div>

            {/* Checkbox */}
            <label style={{
              display:      'flex',
              alignItems:   'flex-start',
              gap:          14,
              cursor:       'pointer',
              width:        '100%',
              marginBottom: 32,
            }}>
              <div
                onClick={() => setChecked(c => !c)}
                style={{
                  flexShrink:     0,
                  width:          22,
                  height:         22,
                  marginTop:      1,
                  border:         `2px solid ${checked ? ACCENT : BORDER}`,
                  background:     checked ? ACCENT : 'transparent',
                  display:        'flex',
                  alignItems:     'center',
                  justifyContent: 'center',
                  transition:     'border-color 0.2s, background 0.2s',
                }}
              >
                {checked && (
                  <svg width="13" height="10" viewBox="0 0 13 10" fill="none">
                    <polyline
                      points="1.5,5 5,8.5 11.5,1.5"
                      stroke={DARK}
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </div>

              <span style={{
                fontFamily:    FONT,
                fontSize:      '12px',
                fontWeight:    700,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                color:         TEXT,
                opacity:       0.8,
                lineHeight:    1.6,
              }}>
                I confirm I am in a safe environment to play
              </span>
            </label>

            {/* Continue button */}
            <button
              onClick={checked ? onContinue : undefined}
              style={{
                width:          '100%',
                padding:        '1rem 1.5rem',
                fontFamily:     FONT,
                fontSize:       '13px',
                fontWeight:     800,
                letterSpacing:  '0.14em',
                textTransform:  'uppercase',
                color:          checked ? DARK : DIM,
                background:     checked ? ACCENT : 'transparent',
                border:         checked ? 'none' : `2px solid ${BORDER}`,
                clipPath:       checked ? CUT_CORNER : undefined,
                cursor:         checked ? 'pointer' : 'default',
                transition:     'background 0.2s, color 0.2s, border-color 0.2s',
              }}
            >
              I Understand — Let's Play
            </button>

            {/* Decorative accent underline */}
            <div style={{ width: '38%', height: 3, background: ACCENT, marginTop: 20, opacity: 0.8 }} />

          </div>
        </div>
      </IonContent>
    </IonPage>
  );
}
