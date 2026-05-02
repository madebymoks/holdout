import { useEffect, useState } from 'react';
import { IonContent, IonPage, IonAlert } from '@ionic/react';
import { Capacitor } from '@capacitor/core';
import { useDeviceMotionPermission } from '../hooks/useDeviceMotionPermission';
import logoImg from './images/HOLDOUT_logo.png';

const FONT      = "'Open Sans', sans-serif";
const LOGO_FONT = "'Squada One', sans-serif";
const COLOR     = '#f28f68';
const BG        = '#121d2e';
const TEXT      = '#f0ece0';
const DARK      = '#1a1208';

const SAFE_PAD = 'calc(40px + env(safe-area-inset-top)) calc(32px + env(safe-area-inset-right)) calc(40px + env(safe-area-inset-bottom)) calc(32px + env(safe-area-inset-left))';

const btnStyle: React.CSSProperties = {
  background:    '#f2ead0',
  color:         DARK,
  border:        `3px solid ${DARK}`,
  borderRadius:  '60px',
  padding:       '0.75rem 2.2rem',
  fontSize:      '15px',
  fontFamily:    FONT,
  fontWeight:    900,
  cursor:        'pointer',
  letterSpacing: '0.18em',
  textTransform: 'uppercase',
  display:       'flex',
  alignItems:    'center',
  gap:           '10px',
  boxShadow:     '0 5px 0 rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.45)',
};

const Bracket = () => (
  <span style={{ fontSize: '24px', fontWeight: 900, lineHeight: 1, opacity: 0.55, marginTop: '-1px' }}></span>
);

interface Props {
  onGranted: () => void;
}

export default function PermissionGate({ onGranted }: Props) {
  const { permission, requestPermission } = useDeviceMotionPermission();
  const [showAlert,   setShowAlert]   = useState(false);
  const [wasDeclined, setWasDeclined] = useState(false);

  useEffect(() => {
    if (permission === 'granted') onGranted();
  }, [permission, onGranted]);

  // Still resolving persisted state — show nothing to avoid flash
  if (permission === 'unknown' || permission === 'granted') return null;

  const platform   = Capacitor.getPlatform();
  const appLabel   = platform === 'ios' ? '"Holdout"' : 'Holdout';
  const alertHeader  = platform === 'ios'
    ? `${appLabel} Would Like to Access Motion & Fitness`
    : `Allow ${appLabel} to access motion sensors?`;
  const alertMessage = platform === 'ios'
    ? 'Motion data is used to let you aim by physically moving your device.'
    : 'Holdout uses motion sensors so you can aim by moving your phone. Motion access is required to play.';

  // Pre-permission splash (iOS pending, or Android pending on first launch)
  if (permission === 'pending') {
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
            paddingTop:     '30%',
            paddingLeft:    'calc(32px + env(safe-area-inset-left))',
            paddingRight:   'calc(32px + env(safe-area-inset-right))',
            paddingBottom:  'calc(40px + env(safe-area-inset-bottom))',
            gap:            24,
          }}>
            <img src={logoImg} alt="Holdout" style={{ width: '85%', userSelect: 'none', marginBottom: 8 }} />

            <div style={{ fontSize: '40px', lineHeight: 1 }}>📱</div>

            <div style={{
              fontFamily:    LOGO_FONT,
              fontSize:      '22px',
              color:         COLOR,
              textAlign:     'center',
              letterSpacing: '0.04em',
              textShadow:    '1px 1px 0 #000',
            }}>
              Motion Access
            </div>

            <div style={{
              fontFamily: FONT,
              fontSize:   '15px',
              color:      TEXT,
              opacity:    0.75,
              textAlign:  'center',
              lineHeight: 1.6,
              maxWidth:   280,
            }}>
              Holdout uses your device motion to let you aim by moving your phone.
            </div>

            {/* Warning shown after declining the alert */}
            {wasDeclined && (
              <div style={{
                background:   'rgba(220,60,60,0.12)',
                border:       '1px solid rgba(220,60,60,0.35)',
                borderRadius: 8,
                padding:      '12px 16px',
                maxWidth:     280,
                textAlign:    'center',
                fontFamily:   FONT,
                fontSize:     '13px',
                color:        '#e07070',
                lineHeight:   1.55,
              }}>
                Motion access is required to play. Please tap Allow to continue.
              </div>
            )}

            <button onClick={() => setShowAlert(true)} style={btnStyle}>
              <Bracket />
              Allow Motion Access
              <Bracket />
            </button>

            <IonAlert
              isOpen={showAlert}
              onDidDismiss={() => setShowAlert(false)}
              header={alertHeader}
              message={alertMessage}
              buttons={[
                {
                  text:    "Don't Allow",
                  role:    'cancel',
                  handler: () => { setWasDeclined(true); },
                },
                {
                  text:    'Allow',
                  handler: () => { requestPermission(); },
                },
              ]}
            />
          </div>
        </IonContent>
      </IonPage>
    );
  }

  // Permission denied
  if (permission === 'denied') {
    const isIos = platform === 'ios';
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
            paddingTop:     '30%',
            paddingLeft:    'calc(32px + env(safe-area-inset-left))',
            paddingRight:   'calc(32px + env(safe-area-inset-right))',
            paddingBottom:  'calc(40px + env(safe-area-inset-bottom))',
            gap:            24,
          }}>
            <img src={logoImg} alt="Holdout" style={{ width: '85%', userSelect: 'none', marginBottom: 8 }} />

            <div style={{ fontSize: '40px', lineHeight: 1 }}>🚫</div>

            <div style={{
              fontFamily:    LOGO_FONT,
              fontSize:      '22px',
              color:         COLOR,
              textAlign:     'center',
              letterSpacing: '0.04em',
              textShadow:    '1px 1px 0 #000',
            }}>
              Motion Access Required
            </div>

            <div style={{
              fontFamily: FONT,
              fontSize:   '15px',
              color:      TEXT,
              opacity:    0.75,
              textAlign:  'center',
              lineHeight: 1.6,
              maxWidth:   280,
            }}>
              Holdout needs motion sensor access to play. Without it, aiming won't work.
            </div>

            {/* On Android, a re-attempt via the alert may still work */}
            {!isIos && (
              <>
                <button onClick={() => setShowAlert(true)} style={btnStyle}>
                  <Bracket />
                  Allow Motion Access
                  <Bracket />
                </button>
                <IonAlert
                  isOpen={showAlert}
                  onDidDismiss={() => setShowAlert(false)}
                  header={alertHeader}
                  message={alertMessage}
                  buttons={[
                    { text: "Don't Allow", role: 'cancel' },
                    { text: 'Allow', handler: () => { requestPermission(); } },
                  ]}
                />
              </>
            )}

            {/* iOS: native dialog won't re-appear after denial — must go to Settings */}
            {isIos && (
              <button
                onClick={() => window.open('app-settings:', '_system')}
                style={{
                  ...btnStyle,
                }}
              >
                <Bracket />
                Open Settings
                <Bracket />
              </button>
            )}
          </div>
        </IonContent>
      </IonPage>
    );
  }

  return null;
}
