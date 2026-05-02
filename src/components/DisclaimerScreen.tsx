import { useState } from 'react';
import { IonContent, IonPage } from '@ionic/react';
import logoImg from './images/HOLDOUT_logo.png';

const FONT    = "'Open Sans', sans-serif";
const BG      = '#121d2e';
const TEXT    = '#f0ece0';
const DIM     = 'rgba(240,236,224,0.45)';
const BORDER  = 'rgba(240,236,224,0.15)';
const ACCENT  = '#a8c0d6';  // cold blue — no warm colours

const SAFE_PAD = 'calc(40px + env(safe-area-inset-top)) calc(32px + env(safe-area-inset-right)) calc(40px + env(safe-area-inset-bottom)) calc(32px + env(safe-area-inset-left))';

interface Props {
  onContinue: () => void;
}

export default function DisclaimerScreen({ onContinue }: Props) {
  const [checked, setChecked] = useState(false);

  return (
    <IonPage>
      <IonContent fullscreen>
        <div style={{
          position:       'absolute',
          inset:          0,
          background:     BG,
          display:        'flex',
          flexDirection:  'column',
          alignItems:     'center',
          justifyContent: 'flex-start',
          padding:        SAFE_PAD,
          overflowY:      'auto',
        }}>

          {/* Logo */}
          <img
            src={logoImg}
            alt="Holdout"
            style={{ width: '70%', maxWidth: 280, marginBottom: 32, userSelect: 'none' }}
          />

          {/* Warning label */}
          <div style={{
            fontFamily:    FONT,
            fontSize:      '9px',
            fontWeight:    800,
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            color:         ACCENT,
            marginBottom:  16,
          }}>
            Safety Notice
          </div>

          {/* Divider */}
          <div style={{ width: '100%', height: 1, background: BORDER, marginBottom: 24 }} />

          {/* Disclaimer text */}
          <div style={{
            fontFamily: FONT,
            fontSize:   '14px',
            fontWeight: 400,
            color:      TEXT,
            opacity:    0.7,
            lineHeight: 1.8,
            textAlign:  'left',
            width:      '100%',
            marginBottom: 32,
          }}>
            Holdout requires physical movement. Please ensure you are in a safe,
            clear open space before playing. Be aware of your surroundings at all
            times. The developer is not responsible for any injury, damage, or
            accident that occurs during gameplay.
          </div>

          {/* Divider */}
          <div style={{ width: '100%', height: 1, background: BORDER, marginBottom: 28 }} />

          {/* Checkbox */}
          <label style={{
            display:     'flex',
            alignItems:  'flex-start',
            gap:         14,
            cursor:      'pointer',
            width:       '100%',
            marginBottom: 36,
          }}>
            {/* Custom checkbox */}
            <div
              onClick={() => setChecked(c => !c)}
              style={{
                flexShrink:     0,
                width:          22,
                height:         22,
                marginTop:      1,
                border:         `2px solid ${checked ? ACCENT : BORDER}`,
                borderRadius:   4,
                background:     checked ? 'rgba(168,192,214,0.15)' : 'transparent',
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
                    stroke={ACCENT}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </div>

            <span style={{
              fontFamily: FONT,
              fontSize:   '13px',
              fontWeight: 500,
              color:      TEXT,
              opacity:    0.75,
              lineHeight: 1.6,
            }}>
              I confirm I am in a safe environment to play
            </span>
          </label>

          {/* Continue button */}
          <button
            onClick={checked ? onContinue : undefined}
            style={{
              width:          '100%',
              padding:        '0.85rem 1.5rem',
              fontFamily:     FONT,
              fontSize:       '12px',
              fontWeight:     800,
              letterSpacing:  '0.18em',
              textTransform:  'uppercase',
              color:          checked ? BG : DIM,
              background:     checked ? ACCENT : 'transparent',
              border:         `2px solid ${checked ? ACCENT : BORDER}`,
              borderRadius:   4,
              cursor:         checked ? 'pointer' : 'default',
              transition:     'background 0.2s, color 0.2s, border-color 0.2s',
            }}
          >
            [ I Understand — Let's Play ]
          </button>

        </div>
      </IonContent>
    </IonPage>
  );
}
