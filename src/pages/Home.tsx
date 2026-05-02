import { useState, useEffect, useCallback, useRef } from 'react';
import { IonContent, IonPage, IonToast } from '@ionic/react';
import { Preferences } from '@capacitor/preferences';
import GameCanvas from '../components/GameCanvas';
import PixelHeart from '../components/PixelHeart';
import { useLives } from '../hooks/useLives'; // now reads from LivesContext
import { useHighScore } from '../hooks/useHighScore';
import { useRewardedAd } from '../hooks/useRewardedAd';
import { useCrosshair } from '../hooks/useCrosshair';
import { CrosshairSVG } from '../components/Crosshair';
import type { CrosshairType } from '../hooks/useCrosshair';
import { useGameSounds } from '../hooks/useGameSounds';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import logoImg from '../components/images/HOLDOUT_logo.png';
import MenuGridFloor from '../components/MenuGridFloor';
import './Home.css';

const FONT      = "'Open Sans', sans-serif";
const LOGO_FONT = "'Squada One', sans-serif";
const COLOR     = '#f28f68';
const BG        = '#121d2e';
const DARK      = '#1a1208'; // used for text ON light buttons only
const TEXT      = '#f0ece0'; // used for text ON the dark background

type Screen = 'landing' | 'playing' | 'dead' | 'instructions' | 'scores' | 'settings';

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
  boxShadow:     `0 5px 0 rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.45)`,
};

function ResetHighScore({ onReset }: { onReset: () => void }) {
  const [confirming, setConfirming] = useState(false);
  return confirming ? (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ fontFamily: "'Open Sans', sans-serif", fontSize: '12px', color: 'rgba(240,236,224,0.55)', flex: 1 }}>
        Are you sure?
      </span>
      <button
        onClick={() => { onReset(); setConfirming(false); }}
        style={{
          background: 'rgba(220,60,60,0.15)', border: '1px solid rgba(220,60,60,0.4)',
          borderRadius: 6, padding: '6px 14px', cursor: 'pointer',
          color: '#e06060', fontFamily: "'Open Sans', sans-serif", fontSize: '12px', fontWeight: 700,
        }}
      >
        Reset
      </button>
      <button
        onClick={() => setConfirming(false)}
        style={{
          background: 'transparent', border: '1px solid rgba(240,236,224,0.12)',
          borderRadius: 6, padding: '6px 14px', cursor: 'pointer',
          color: 'rgba(240,236,224,0.45)', fontFamily: "'Open Sans', sans-serif", fontSize: '12px',
        }}
      >
        Cancel
      </button>
    </div>
  ) : (
    <button
      onClick={() => setConfirming(true)}
      style={{
        background: 'transparent', border: '1px solid rgba(240,236,224,0.10)',
        borderRadius: 8, padding: '10px 16px', cursor: 'pointer', width: '100%',
        color: 'rgba(220,80,80,0.75)', fontFamily: "'Open Sans', sans-serif",
        fontSize: '13px', fontWeight: 600, textAlign: 'left',
      }}
    >
      Reset High Score
    </button>
  );
}

function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60).toString().padStart(2, '0');
  const s = (total % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export const Home: React.FC = () => {
  const [screen, setScreen]           = useState<Screen>('landing');
  const [finalScore, setFinalScore]   = useState(0);
  const [isNewRecord, setIsNewRecord] = useState(false);
  const [countdown, setCountdown]     = useState('');
  const [showToast, setShowToast]     = useState(false);

  const { lives, maxLives, nextLifeAt, adUnlocked, loseLife, gainLife } = useLives();
  const { highScore, updateHighScore, resetHighScore } = useHighScore();
  const { playWin, isMuted, toggleMute }           = useGameSounds();
  const { crosshairType, setCrosshair }            = useCrosshair();
  const isOnline                                  = useOnlineStatus();
  const { adStatus, adError, prepareAd, showAd }  = useRewardedAd();

  // Dev-only: long-press reset
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleTitlePressStart = !import.meta.env.DEV ? undefined : () => {
    longPressTimer.current = setTimeout(async () => {
      localStorage.removeItem('holdout_lives');
      localStorage.removeItem('holdout_last_lost_at');
      localStorage.removeItem('holdout_high_score');
      localStorage.removeItem('holdout_muted');
      localStorage.removeItem('holdout_ad_unlocked');
      await Preferences.remove({ key: 'holdout_motion_permission' });
      // Clear Ionic Storage disclaimer
      const { getStorage } = await import('../storage');
      const s = await getStorage();
      await s.remove('holdout_disclaimer_accepted');
      window.location.reload();
    }, 5000);
  };

  const handleTitlePressEnd = !import.meta.env.DEV ? undefined : () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  // Preload ad when unlocked and not already loaded/loading
  useEffect(() => {
    if (isOnline && adUnlocked && lives < maxLives && adStatus === 'idle') prepareAd();
  }, [adUnlocked, lives, maxLives, isOnline, adStatus, prepareAd]);

  // Show toast when ad fails
  useEffect(() => {
    if (adError) setShowToast(true);
  }, [adError]);

  // Countdown tick for life regeneration
  useEffect(() => {
    if (!nextLifeAt) return;
    const tick = () => setCountdown(formatCountdown(nextLifeAt - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [nextLifeAt]);

  const handleStart = () => {
    setScreen('playing');
  };

  const handleGameOver = useCallback((score: number) => {
    setFinalScore(score);
    const isRecord = updateHighScore(score);
    setIsNewRecord(isRecord);
    if (isRecord) playWin();
    loseLife();
    setScreen('dead');
  }, [loseLife, updateHighScore, playWin]);

  // Try Again — life already deducted on death, just respawn
  const handleTryAgain = useCallback(() => {
    setScreen('playing');
  }, []);

  // Watch Ad — gain a life, stay on current screen
  const handleWatchAd = useCallback(() => {
    if (adStatus !== 'ready') return;
    showAd(() => { gainLife(); });
  }, [adStatus, showAd, gainLife]);

  // ── Instructions page ──────────────────────────────────────────────────────
  if (screen === 'instructions') {
    const steps = [
      { icon: '📱', label: 'Aim',      text: 'Physically turn and move your device in any direction to look around and line up your crosshair.' },
      { icon: '👆', label: 'Shoot',    text: 'Tap anywhere on screen to fire.' },
      { icon: '🗺️', label: 'Radar',    text: 'The map shows where humanoids are coming from. Turn to face them.' },
      { icon: '❤️', label: 'Survive',  text: "Don't let the humanoids reach you. Stay alive as long as you can." },
    ];

    const sectionLabel: React.CSSProperties = {
      fontFamily:    FONT,
      fontSize:      '9px',
      fontWeight:    800,
      letterSpacing: '0.20em',
      textTransform: 'uppercase',
      color:         TEXT,
      opacity:       0.38,
      marginBottom:  8,
    };

    const divider = (
      <div style={{ width: '100%', height: 1, background: 'rgba(240,236,224,0.08)', margin: '12px 0' }} />
    );

    return (
      <IonPage>
        <IonContent fullscreen>
          <div style={{
            position:      'absolute',
            inset:         0,
            background:    BG,
            display:       'flex',
            flexDirection: 'column',
            padding:       SAFE_PAD,
            overflowY:     'auto',
          }}>
            <div style={{
              fontFamily:    LOGO_FONT,
              fontSize:      '28px',
              color:         COLOR,
              letterSpacing: '0.06em',
              marginBottom:  16,
              textShadow:    '2px 2px 0 #000, 4px 4px 0 #000',
            }}>
              How to play
            </div>

            <div style={sectionLabel}>Controls</div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {steps.map((step, i) => (
                <div key={i} style={{
                  background:   'rgba(255,255,255,0.04)',
                  border:       '1px solid rgba(240,236,224,0.10)',
                  borderRadius: 8,
                  padding:      '10px 14px',
                  display:      'flex',
                  alignItems:   'flex-start',
                  gap:          12,
                }}>
                  <div style={{ fontSize: '20px', flexShrink: 0, lineHeight: 1.4 }}>{step.icon}</div>
                  <div>
                    <div style={{ fontFamily: LOGO_FONT, fontSize: '15px', color: COLOR, letterSpacing: '0.04em', marginBottom: 3 }}>
                      {step.label}
                    </div>
                    <div style={{ fontFamily: FONT, fontSize: '13px', color: TEXT, lineHeight: 1.5, fontWeight: 500, opacity: 0.75 }}>
                      {step.text}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ width: '100%', height: 1, background: 'rgba(240,236,224,0.08)', margin: '12px 0' }} />

            <div style={sectionLabel}>Tip</div>
            <div style={{
              background:   'rgba(255,255,255,0.04)',
              border:       '1px solid rgba(240,236,224,0.10)',
              borderRadius: 8,
              padding:      '10px 14px',
              fontFamily:   FONT,
              fontSize:     '13px',
              color:        TEXT,
              opacity:      0.55,
              fontStyle:    'italic',
              lineHeight:   1.5,
            }}>
              💡 Tip: Hold your phone up and face forward to begin. Spin your whole body — humanoids can attack from any direction!
            </div>

            {divider}

            <button onClick={() => setScreen('landing')} style={{ ...btnStyle, alignSelf: 'center' }}>
              <span style={{ fontSize: '24px', fontWeight: 900, lineHeight: 1, opacity: 0.55, marginTop: '-1px' }}>(</span>
              Main Menu
              <span style={{ fontSize: '24px', fontWeight: 900, lineHeight: 1, opacity: 0.55, marginTop: '-1px' }}>)</span>
            </button>
          </div>
        </IonContent>
      </IonPage>
    );
  }

  // ── Scores page ─────────────────────────────────────────────────────────────
  if (screen === 'scores') {
    const sectionLabel: React.CSSProperties = {
      fontFamily:    FONT,
      fontSize:      '9px',
      fontWeight:    800,
      letterSpacing: '0.20em',
      textTransform: 'uppercase',
      color:         TEXT,
      opacity:       0.38,
      marginBottom:  8,
    };

    const divider = (
      <div style={{ width: '100%', height: 1, background: 'rgba(240,236,224,0.08)', margin: '12px 0' }} />
    );

    return (
      <IonPage>
        <IonContent fullscreen>
          <div style={{
            position:      'absolute',
            inset:         0,
            background:    BG,
            display:       'flex',
            flexDirection: 'column',
            padding:       SAFE_PAD,
            overflowY:     'auto',
          }}>
            <div style={{
              fontFamily:    LOGO_FONT,
              fontSize:      '28px',
              color:         COLOR,
              letterSpacing: '0.06em',
              marginBottom:  28,
              textShadow:    '2px 2px 0 #000, 4px 4px 0 #000',
            }}>
              Best Score
            </div>

            <div style={sectionLabel}>All-Time Best</div>

            <div style={{
              background:     'rgba(255,255,255,0.04)',
              border:         '1px solid rgba(240,236,224,0.10)',
              borderRadius:   8,
              padding:        '28px 16px',
              display:        'flex',
              flexDirection:  'column',
              alignItems:     'center',
              gap:            6,
            }}>
              {highScore > 0 ? (
                <>
                  <div style={{ fontFamily: LOGO_FONT, fontSize: '80px', color: TEXT, lineHeight: 1 }}>
                    {highScore}
                  </div>
                  <div style={{
                    fontFamily:    FONT,
                    fontSize:      '11px',
                    fontWeight:    400,
                    color:         TEXT,
                    opacity:       0.4,
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                  }}>
                    {highScore === 1 ? 'Kill' : 'Kills'}
                  </div>
                </>
              ) : (
                <div style={{
                  fontFamily:  FONT,
                  fontSize:    '14px',
                  color:       TEXT,
                  opacity:     0.35,
                  textAlign:   'center',
                  lineHeight:  1.6,
                }}>
                  No score yet.{'\n'}Play a round to set your first record.
                </div>
              )}
            </div>

            {divider}

            <button onClick={() => setScreen('landing')} style={{ ...btnStyle, alignSelf: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: '24px', fontWeight: 900, lineHeight: 1, opacity: 0.55, marginTop: '-1px' }}>(</span>
              Main Menu
              <span style={{ fontSize: '24px', fontWeight: 900, lineHeight: 1, opacity: 0.55, marginTop: '-1px' }}>)</span>
            </button>
          </div>
        </IonContent>
      </IonPage>
    );
  }

  // ── Settings page ────────────────────────────────────────────────────────────
  if (screen === 'settings') {
    const CROSSHAIR_OPTIONS: { type: CrosshairType; label: string }[] = [
      { type: 'tactical', label: 'Tactical' },
      { type: 'classic',  label: 'Classic'  },
      { type: 'dot',      label: 'Dot'      },
      { type: 'circle',   label: 'Circle'   },
    ];

    const sectionLabel: React.CSSProperties = {
      fontFamily:    FONT,
      fontSize:      '9px',
      fontWeight:    800,
      letterSpacing: '0.20em',
      textTransform: 'uppercase',
      color:         TEXT,
      opacity:       0.38,
      marginBottom:  8,
    };

    const divider = (
      <div style={{ width: '100%', height: 1, background: 'rgba(240,236,224,0.08)', margin: '12px 0' }} />
    );

    return (
      <IonPage>
        <IonContent fullscreen>
          <div style={{
            position:      'absolute',
            inset:         0,
            background:    BG,
            display:       'flex',
            flexDirection: 'column',
            padding:       SAFE_PAD,
            overflowY:     'auto',
          }}>

            {/* Heading */}
            <div style={{
              fontFamily:    LOGO_FONT,
              fontSize:      '28px',
              color:         COLOR,
              letterSpacing: '0.06em',
              marginBottom:  28,
              textShadow:    '2px 2px 0 #000, 4px 4px 0 #000',
            }}>
              Settings
            </div>

            {/* ── Sound ── */}
            <div style={sectionLabel}>Sound</div>
            <button
              onClick={toggleMute}
              style={{
                display:        'flex',
                alignItems:     'center',
                justifyContent: 'space-between',
                width:          '100%',
                background:     'rgba(255,255,255,0.04)',
                border:         '1px solid rgba(240,236,224,0.10)',
                borderRadius:   8,
                padding:        '14px 16px',
                cursor:         'pointer',
                color:          TEXT,
                fontFamily:     FONT,
                fontSize:       '14px',
                fontWeight:     500,
              }}
            >
              <span>Sound Effects</span>
              <span style={{
                fontFamily:    FONT,
                fontSize:      '11px',
                fontWeight:    700,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color:         isMuted ? 'rgba(240,236,224,0.30)' : COLOR,
              }}>
                {isMuted ? 'Off' : 'On'}
              </span>
            </button>

            {divider}

            {/* ── Crosshair ── */}
            <div style={sectionLabel}>Crosshair</div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              {CROSSHAIR_OPTIONS.map(({ type, label }) => (
                <button
                  key={type}
                  onClick={() => setCrosshair(type)}
                  style={{
                    display:        'flex',
                    flexDirection:  'column',
                    alignItems:     'center',
                    gap:            8,
                    background:     crosshairType === type ? 'rgba(242,143,104,0.10)' : 'rgba(255,255,255,0.03)',
                    border:         `2px solid ${crosshairType === type ? COLOR : 'rgba(240,236,224,0.10)'}`,
                    borderRadius:   8,
                    padding:        '10px 6px 8px',
                    cursor:         'pointer',
                    flex:           1,
                  }}
                >
                  <div style={{ width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <CrosshairSVG type={type} size="42px" />
                  </div>
                  <span style={{
                    fontFamily:    FONT,
                    fontSize:      '9px',
                    fontWeight:    700,
                    letterSpacing: '0.10em',
                    textTransform: 'uppercase',
                    color:         crosshairType === type ? COLOR : 'rgba(240,236,224,0.40)',
                  }}>
                    {label}
                  </span>
                </button>
              ))}
            </div>

            {divider}

            {/* ── Stats ── */}
            <div style={sectionLabel}>Stats</div>
            <div style={{
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'space-between',
              marginBottom:   14,
            }}>
              <span style={{ fontFamily: FONT, fontSize: '14px', color: TEXT, opacity: 0.7 }}>Best Score</span>
              <span style={{ fontFamily: LOGO_FONT, fontSize: '22px', color: TEXT }}>
                {highScore > 0 ? `${highScore} ${highScore === 1 ? 'kill' : 'kills'}` : '—'}
              </span>
            </div>
            <ResetHighScore onReset={resetHighScore} />

            {divider}

            {/* ── About ── */}
            <div style={{
              fontFamily: FONT,
              fontSize:   '13px',
              color:      TEXT,
              opacity:    0.5,
              lineHeight: 1.8,
            }}>
              <div style={{ fontFamily: LOGO_FONT, fontSize: '18px', color: TEXT, opacity: 0.8, marginBottom: 4 }}>Holdout</div>
              <div>Version 1.0</div>
              <div>© 2025</div>
            </div>

            {divider}

            {/* Main Menu */}
            <button onClick={() => setScreen('landing')} style={{ ...btnStyle, alignSelf: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: '24px', fontWeight: 900, lineHeight: 1, opacity: 0.55, marginTop: '-1px' }}>(</span>
              Main Menu
              <span style={{ fontSize: '24px', fontWeight: 900, lineHeight: 1, opacity: 0.55, marginTop: '-1px' }}>)</span>
            </button>

          </div>
        </IonContent>
      </IonPage>
    );
  }

  // ── Game canvas ─────────────────────────────────────────────────────────────
  if (screen === 'playing') {
    return (
      <IonPage>
        <IonContent fullscreen>
          <GameCanvas
            permission="granted"
            onGameOver={handleGameOver}
            onStop={() => { loseLife(); setScreen('landing'); }}
            lives={lives}
            maxLives={maxLives}
            crosshairType={crosshairType}
          />
        </IonContent>
      </IonPage>
    );
  }

  // ── Death screen ─────────────────────────────────────────────────────────────
  if (screen === 'dead') {
    const gameOver   = lives === 0;
    const showAdBtn  = adUnlocked && lives < maxLives;
    const adLoading  = adStatus === 'loading' || adStatus === 'showing';
    const adDisabled = adStatus !== 'ready';

    const sectionLabel: React.CSSProperties = {
      fontFamily:    FONT,
      fontSize:      '9px',
      fontWeight:    800,
      letterSpacing: '0.20em',
      textTransform: 'uppercase',
      color:         TEXT,
      opacity:       0.38,
      marginBottom:  8,
    };

    const divider = (
      <div style={{ width: '100%', height: 1, background: 'rgba(240,236,224,0.08)', margin: '12px 0' }} />
    );

    return (
      <IonPage>
        <IonContent fullscreen>
          <div style={{
            position:      'absolute',
            inset:         0,
            background:    BG,
            display:       'flex',
            flexDirection: 'column',
            padding:       SAFE_PAD,
            overflowY:     'auto',
          }}>

            {/* Logo — 25% smaller than other pages */}
            <img src={logoImg} alt="Holdout" style={{ width: '64%', alignSelf: 'center', userSelect: 'none', marginBottom: 4 }} />

            {/* This Round / Game Over */}
            <div style={sectionLabel}>{gameOver ? 'Game Over' : 'This Round'}</div>
            <div style={{
              background:    'rgba(255,255,255,0.04)',
              border:        '1px solid rgba(240,236,224,0.10)',
              borderRadius:  8,
              padding:       '10px 16px',
              display:       'flex',
              flexDirection: 'column',
              alignItems:    'center',
              gap:           2,
            }}>
              {isNewRecord && (
                <div style={{
                  fontFamily:    FONT,
                  fontSize:      '10px',
                  fontWeight:    800,
                  letterSpacing: '0.16em',
                  textTransform: 'uppercase',
                  color:         COLOR,
                  marginBottom:  4,
                }}>
                  New High Score!
                </div>
              )}
              <div style={{ fontFamily: LOGO_FONT, fontSize: '52px', color: TEXT, lineHeight: 1 }}>
                {finalScore}
              </div>
              <div style={{
                fontFamily:    FONT,
                fontSize:      '11px',
                fontWeight:    400,
                color:         TEXT,
                opacity:       0.4,
                letterSpacing: '0.10em',
                textTransform: 'uppercase',
              }}>
                {finalScore === 1 ? 'Kill' : 'Kills'}
              </div>
              {!isNewRecord && highScore > 0 && (
                <div style={{
                  fontFamily:    FONT,
                  fontSize:      '12px',
                  fontWeight:    600,
                  color:         TEXT,
                  opacity:       0.38,
                  marginTop:     6,
                  letterSpacing: '0.08em',
                }}>
                  Best: {highScore}
                </div>
              )}
            </div>

            {divider}

            {/* Lives */}
            <div style={sectionLabel}>Lives</div>
            <div style={{
              background:    'rgba(255,255,255,0.04)',
              border:        '1px solid rgba(240,236,224,0.10)',
              borderRadius:  8,
              padding:       '12px 16px',
              display:       'flex',
              flexDirection: 'column',
              alignItems:    'center',
              gap:           10,
            }}>
              <div style={{ display: 'flex', gap: 10 }}>
                {Array.from({ length: maxLives }, (_, i) => (
                  <PixelHeart
                    key={i}
                    size={20}
                    color={COLOR}
                    emptyColor="rgba(242,143,104,0.22)"
                    filled={i < lives}
                    style={{ opacity: i < lives ? 1 : 0.3, transition: 'opacity 0.2s ease' }}
                  />
                ))}
              </div>
              {lives < maxLives && nextLifeAt && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                  <div style={{
                    fontFamily:    FONT,
                    fontSize:      '10px',
                    color:         TEXT,
                    opacity:       0.45,
                    textTransform: 'uppercase',
                    letterSpacing: '0.12em',
                  }}>
                    Next life in
                  </div>
                  <div style={{ fontFamily: LOGO_FONT, fontSize: '24px', color: TEXT, letterSpacing: '0.04em', lineHeight: 1 }}>
                    {countdown}
                  </div>
                </div>
              )}
            </div>

            {divider}

            {/* Buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, paddingBottom: 4 }}>
              {lives > 0 && (
                <button onClick={handleTryAgain} style={{ ...btnStyle, alignSelf: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: '24px', fontWeight: 900, lineHeight: 1, opacity: 0.55, marginTop: '-1px' }}>(</span>
                  Try Again
                  <span style={{ fontSize: '24px', fontWeight: 900, lineHeight: 1, opacity: 0.55, marginTop: '-1px' }}>)</span>
                </button>
              )}
              {showAdBtn && isOnline && (
                <button
                  onClick={handleWatchAd}
                  disabled={adDisabled}
                  style={{ ...btnStyle, alignSelf: 'center', justifyContent: 'center', opacity: adDisabled ? 0.45 : 1, cursor: adDisabled ? 'default' : 'pointer' }}
                >
                  <span style={{ fontSize: '24px', fontWeight: 900, lineHeight: 1, opacity: 0.55, marginTop: '-1px' }}>(</span>
                  {adLoading ? 'Loading Ad…' : 'Watch Ad for a Life'}
                  <span style={{ fontSize: '24px', fontWeight: 900, lineHeight: 1, opacity: 0.55, marginTop: '-1px' }}>)</span>
                </button>
              )}
              <button onClick={() => setScreen('landing')} style={{ ...btnStyle, alignSelf: 'center' }}>
                <span style={{ fontSize: '24px', fontWeight: 900, lineHeight: 1, opacity: 0.55, marginTop: '-1px' }}>(</span>
                Main Menu
                <span style={{ fontSize: '24px', fontWeight: 900, lineHeight: 1, opacity: 0.55, marginTop: '-1px' }}>)</span>
              </button>
            </div>

          </div>

          <IonToast
            isOpen={showToast}
            message="Ad unavailable, please try again later."
            duration={3000}
            position="bottom"
            onDidDismiss={() => setShowToast(false)}
          />
        </IonContent>
      </IonPage>
    );
  }

  // ── Landing page ─────────────────────────────────────────────────────────────
  return (
    <IonPage>
      <IonContent fullscreen>
        <div style={{
          position:      'absolute',
          inset:         0,
          background:    BG,
          display:       'flex',
          flexDirection: 'column',
          padding:       SAFE_PAD,
          overflowY:     'auto',
        }}>
          {/* Trophy button — top-left corner */}
          <button
            onClick={() => setScreen('scores')}
            style={{
              position:   'absolute',
              top:        'calc(28px + env(safe-area-inset-top))',
              left:       'calc(16px + env(safe-area-inset-left))',
              zIndex:     2,
              background: 'transparent',
              border:     'none',
              padding:    '6px',
              cursor:     'pointer',
              fontSize:   '26px',
              lineHeight: 1,
            }}
            aria-label="Best Score"
          >
            🏆
          </button>

          {/* Top-right: how to play + settings */}
          <div style={{
            position:   'absolute',
            top:        'calc(28px + env(safe-area-inset-top))',
            right:      'calc(16px + env(safe-area-inset-right))',
            zIndex:     2,
            display:    'flex',
            alignItems: 'center',
            gap:        4,
          }}>
            <button
              onClick={() => setScreen('instructions')}
              style={{ background: 'transparent', border: 'none', padding: '6px', cursor: 'pointer', fontSize: '22px', lineHeight: 1 }}
              aria-label="How to Play"
            >
              ❓
            </button>
            <button
              onClick={() => setScreen('settings')}
              style={{ background: 'transparent', border: 'none', padding: '6px', cursor: 'pointer', fontSize: '22px', lineHeight: 1 }}
              aria-label="Settings"
            >
              ⚙️
            </button>
          </div>

          <MenuGridFloor />

          {/* Logo — dev: 5s long-press resets all state */}
          <img
            src={logoImg}
            alt="Holdout"
            onPointerDown={handleTitlePressStart}
            onPointerUp={handleTitlePressEnd}
            onPointerLeave={handleTitlePressEnd}
            style={{ width: '85%', alignSelf: 'center', marginBottom: 6, userSelect: 'none', WebkitUserDrag: 'none' } as React.CSSProperties}
          />

          {/* Best Score */}
          {highScore > 0 && (
            <>
              <div style={{
                fontFamily:    FONT,
                fontSize:      '9px',
                fontWeight:    800,
                letterSpacing: '0.20em',
                textTransform: 'uppercase',
                color:         TEXT,
                opacity:       0.38,
                marginBottom:  8,
              }}>
                Best Score
              </div>
              <div style={{
                background:     'rgba(255,255,255,0.04)',
                border:         '1px solid rgba(240,236,224,0.10)',
                borderRadius:   8,
                padding:        '14px 16px',
                display:        'flex',
                alignItems:     'center',
                justifyContent: 'space-between',
              }}>
                <span style={{ fontFamily: LOGO_FONT, fontSize: '28px', color: TEXT }}>{highScore}</span>
                <span style={{
                  fontFamily:    FONT,
                  fontSize:      '11px',
                  color:         TEXT,
                  opacity:       0.4,
                  textTransform: 'uppercase',
                  letterSpacing: '0.12em',
                }}>
                  {highScore === 1 ? 'Kill' : 'Kills'}
                </span>
              </div>
              <div style={{ width: '100%', height: 1, background: 'rgba(240,236,224,0.08)', margin: '12px 0' }} />
            </>
          )}

          {/* Lives */}
          <div style={{
            fontFamily:    FONT,
            fontSize:      '9px',
            fontWeight:    800,
            letterSpacing: '0.20em',
            textTransform: 'uppercase',
            color:         TEXT,
            opacity:       0.38,
            marginBottom:  8,
          }}>
            Lives
          </div>
          <div style={{
            background:    'rgba(255,255,255,0.04)',
            border:        '1px solid rgba(240,236,224,0.10)',
            borderRadius:  8,
            padding:       '16px',
            display:       'flex',
            flexDirection: 'column',
            alignItems:    'center',
            gap:           12,
          }}>
            <div style={{ display: 'flex', gap: 10 }}>
              {Array.from({ length: maxLives }, (_, i) => (
                <PixelHeart
                  key={i}
                  size={22}
                  color={COLOR}
                  emptyColor="rgba(242,143,104,0.22)"
                  filled={i < lives}
                  style={{ opacity: i < lives ? 1 : 0.3, transition: 'opacity 0.2s ease' }}
                />
              ))}
            </div>
            {lives < maxLives && nextLifeAt && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                <div style={{
                  fontFamily:    FONT,
                  fontSize:      '10px',
                  color:         TEXT,
                  opacity:       0.45,
                  textTransform: 'uppercase',
                  letterSpacing: '0.12em',
                }}>
                  Next life in
                </div>
                <div style={{ fontFamily: LOGO_FONT, fontSize: '28px', color: TEXT, letterSpacing: '0.04em', lineHeight: 1 }}>
                  {countdown}
                </div>
              </div>
            )}
          </div>

          <div style={{ width: '100%', height: 1, background: 'rgba(240,236,224,0.08)', margin: '12px 0' }} />

          {/* Subtitle */}
          <div style={{
            color:         TEXT,
            fontFamily:    FONT,
            fontWeight:    400,
            fontSize:      '12px',
            textTransform: 'uppercase',
            letterSpacing: '0.12em',
            opacity:       0.4,
            textAlign:     'center',
            marginBottom:  16,
          }}>
            Shoot to survive
          </div>

          {/* Buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            {/* Play — hidden when lives = 0 */}
            {lives > 0 && (
              <button onClick={handleStart} style={{ ...btnStyle }}>
                <span style={{ fontSize: '24px', fontWeight: 900, lineHeight: 1, opacity: 0.55, marginTop: '-1px' }}>(</span>
                Play
                <span style={{ fontSize: '24px', fontWeight: 900, lineHeight: 1, opacity: 0.55, marginTop: '-1px' }}>)</span>
              </button>
            )}

            {/* Watch Ad — shown only after lives hit 0, until back to max */}
            {adUnlocked && lives < maxLives && isOnline && (
              <button
                onClick={handleWatchAd}
                disabled={adStatus !== 'ready'}
                style={{
                  ...btnStyle,
                  opacity: adStatus !== 'ready' ? 0.45 : 1,
                  cursor:  adStatus !== 'ready' ? 'default' : 'pointer',
                }}
              >
                <span style={{ fontSize: '24px', fontWeight: 900, lineHeight: 1, opacity: 0.55, marginTop: '-1px' }}>(</span>
                {adStatus === 'loading' || adStatus === 'showing' ? 'Loading Ad…' : 'Watch Ad for a Life'}
                <span style={{ fontSize: '24px', fontWeight: 900, lineHeight: 1, opacity: 0.55, marginTop: '-1px' }}>)</span>
              </button>
            )}
          </div>

        </div>
      </IonContent>
    </IonPage>
  );
};

export default Home;
