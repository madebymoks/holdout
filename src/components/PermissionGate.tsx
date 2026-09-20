import { useEffect, useState } from 'react';
import { IonContent, IonPage, IonAlert } from '@ionic/react';
import { Capacitor } from '@capacitor/core';
import { useDeviceMotionPermission } from '../hooks/useDeviceMotionPermission';
import logoImg from './images/HOLDOUT_logo.png';

const FONT      = "'Open Sans', sans-serif";
const LOGO_FONT = "'Squada One', sans-serif";
const BG        = '#0b1220';
const TEXT      = '#f5f2ea';
const BORDER    = 'rgba(245,242,234,0.14)';
const ACCENT    = '#f4813f';
const DARK      = '#1a1208';

const SAFE_PAD = 'calc(40px + env(safe-area-inset-top)) calc(32px + env(safe-area-inset-right)) calc(40px + env(safe-area-inset-bottom)) calc(32px + env(safe-area-inset-left))';

// Shared "cut corner" panel shape used across the redesign's buttons/tags
const CUT_CORNER = 'polygon(0 0, calc(100% - 18px) 0, 100% 18px, 100% 100%, 0 100%)';

const primaryBtn: React.CSSProperties = {
  width:          '100%',
  padding:        '1rem 1.5rem',
  fontFamily:     FONT,
  fontSize:       '13px',
  fontWeight:     800,
  letterSpacing:  '0.14em',
  textTransform:  'uppercase',
  color:          DARK,
  background:     ACCENT,
  border:         'none',
  clipPath:       CUT_CORNER,
  cursor:         'pointer',
};

const sectionLabel: React.CSSProperties = {
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
};

const heading: React.CSSProperties = {
  fontFamily:    LOGO_FONT,
  fontSize:      '34px',
  lineHeight:    1.05,
  color:         TEXT,
  marginBottom:  24,
  letterSpacing: '0.01em',
};

const bodyCard: React.CSSProperties = {
  width:        '100%',
  border:       `1px solid ${BORDER}`,
  padding:      '16px 18px',
  marginBottom: 28,
  boxSizing:    'border-box',
};

const bodyText: React.CSSProperties = {
  fontFamily: FONT,
  fontSize:   '13.5px',
  fontWeight: 400,
  color:      TEXT,
  opacity:    0.75,
  lineHeight: 1.75,
  textAlign:  'left',
};

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
          <div style={{ position: 'absolute', inset: 0, background: BG, overflowY: 'auto' }}>
            <div style={{
              minHeight:      '100%',
              display:        'flex',
              flexDirection:  'column',
              alignItems:     'flex-start',
              justifyContent: 'center',
              padding:        SAFE_PAD,
              boxSizing:      'border-box',
            }}>
              <img src={logoImg} alt="Holdout" style={{ width: 120, marginBottom: 28, userSelect: 'none', alignSelf: 'center' }} />

              <div style={sectionLabel}>
                <span>◆</span> One More Step
              </div>

              <div style={heading}>
                Motion <span style={{ color: ACCENT }}>Access</span>
              </div>

              <div style={bodyCard}>
                <div style={bodyText}>
                  Holdout uses your device&rsquo;s motion to let you aim by physically moving your phone.
                </div>
              </div>

              {/* Warning shown after declining the alert */}
              {wasDeclined && (
                <div style={{
                  width:        '100%',
                  border:       '1px solid rgba(220,60,60,0.4)',
                  background:   'rgba(220,60,60,0.15)',
                  padding:      '12px 16px',
                  marginBottom: 28,
                  boxSizing:    'border-box',
                  fontFamily:   FONT,
                  fontSize:     '13px',
                  color:        '#e06060',
                  lineHeight:   1.55,
                  textAlign:    'left',
                }}>
                  Motion access is required to play. Please tap Allow to continue.
                </div>
              )}

              <button onClick={() => setShowAlert(true)} style={primaryBtn}>
                Allow Motion Access
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
          <div style={{ position: 'absolute', inset: 0, background: BG, overflowY: 'auto' }}>
            <div style={{
              minHeight:      '100%',
              display:        'flex',
              flexDirection:  'column',
              alignItems:     'flex-start',
              justifyContent: 'center',
              padding:        SAFE_PAD,
              boxSizing:      'border-box',
            }}>
              <img src={logoImg} alt="Holdout" style={{ width: 120, marginBottom: 28, userSelect: 'none', alignSelf: 'center' }} />

              <div style={sectionLabel}>
                <span>◆</span> Action Needed
              </div>

              <div style={heading}>
                Access <span style={{ color: ACCENT }}>Required</span>
              </div>

              <div style={bodyCard}>
                <div style={bodyText}>
                  Holdout needs motion sensor access to play. Without it, aiming won&rsquo;t work.
                </div>
              </div>

              {/* On Android, a re-attempt via the alert may still work */}
              {!isIos && (
                <>
                  <button onClick={() => setShowAlert(true)} style={primaryBtn}>
                    Allow Motion Access
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
                <button onClick={() => window.open('app-settings:', '_system')} style={primaryBtn}>
                  Open Settings
                </button>
              )}
            </div>
          </div>
        </IonContent>
      </IonPage>
    );
  }

  return null;
}
