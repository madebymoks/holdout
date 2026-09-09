import { useState, useEffect, useCallback, useRef } from 'react';
import { IonContent, IonPage, IonToast } from '@ionic/react';
import { Preferences } from '@capacitor/preferences';
import GameCanvas from '../components/GameCanvas';
import { useLives } from '../hooks/useLives'; // now reads from LivesContext
import { useMissions, MISSIONS, BADGES, getMissionProgress, isMissionComplete } from '../hooks/useMissions';
import BadgeIcon from '../components/BadgeIcon';
import { useHighScore } from '../hooks/useHighScore';
import { useRewardedAd } from '../hooks/useRewardedAd';
import { useCrosshair } from '../hooks/useCrosshair';
import { CrosshairSVG } from '../components/Crosshair';
import type { CrosshairType } from '../hooks/useCrosshair';
import { useGameSounds } from '../hooks/useGameSounds';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import logoImg from '../components/images/HOLDOUT_logo.png';
// import sunburstImg from '../components/images/sunburst.png';
import DiamondPip from '../components/DiamondPip';
import MenuGridFloor from '../components/MenuGridFloor';
import MenuDustMotes from '../components/MenuDustMotes';
import './Home.css';

const FONT      = "'Open Sans', sans-serif";
const LOGO_FONT = "'Squada One', sans-serif";
const COLOR     = '#f28f68';
const BG        = '#121d2e';
const DARK      = '#1a1208'; // used for text ON light buttons only
const TEXT      = '#f0ece0'; // used for text ON the dark background

type Screen = 'landing' | 'playing' | 'dead' | 'instructions' | 'scores' | 'settings' | 'missions';

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
      <span style={{ fontFamily: "'Open Sans', sans-serif", fontSize: '12px', color: 'rgba(245,242,234,0.55)', flex: 1 }}>
        Are you sure?
      </span>
      <button
        onClick={() => { onReset(); setConfirming(false); }}
        style={{
          background: 'rgba(220,60,60,0.15)', border: '1px solid rgba(220,60,60,0.4)',
          borderRadius: 0, padding: '6px 14px', cursor: 'pointer',
          color: '#e06060', fontFamily: "'Open Sans', sans-serif", fontSize: '12px', fontWeight: 700,
        }}
      >
        Reset
      </button>
      <button
        onClick={() => setConfirming(false)}
        style={{
          background: 'transparent', border: '1px solid rgba(245,242,234,0.14)',
          borderRadius: 0, padding: '6px 14px', cursor: 'pointer',
          color: 'rgba(245,242,234,0.45)', fontFamily: "'Open Sans', sans-serif", fontSize: '12px',
        }}
      >
        Cancel
      </button>
    </div>
  ) : (
    <button
      onClick={() => setConfirming(true)}
      style={{
        background: 'transparent', border: '1px solid rgba(245,242,234,0.14)',
        borderRadius: 0, padding: '10px 16px', cursor: 'pointer', width: '100%',
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
  const { stats: missionStats, claimedIds, earnedBadgeIds, isCrosshairUnlocked, claimMission, refreshStats } = useMissions();

  // Pull the latest ref-backed kill count into state whenever the Missions
  // screen is opened — see useMissions' incrementKills for why it isn't
  // synced on every single kill.
  useEffect(() => {
    if (screen === 'missions') refreshStats();
  }, [screen, refreshStats]);

  // Dev-only: long-press reset
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleTitlePressStart = !import.meta.env.DEV ? undefined : () => {
    longPressTimer.current = setTimeout(async () => {
      localStorage.removeItem('holdout_lives');
      localStorage.removeItem('holdout_last_lost_at');
      localStorage.removeItem('holdout_high_score');
      localStorage.removeItem('holdout_muted');
      localStorage.removeItem('holdout_ad_unlocked');
      localStorage.removeItem('holdout_missions_stats');
      localStorage.removeItem('holdout_missions_claimed');
      localStorage.removeItem('holdout_badges');
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
      { icon: '⚠️', label: 'Incoming', text: 'Watch the count. It rises as more humanoids close in.' },
      { icon: '❤️', label: 'Survive',  text: "Don't let the humanoids reach you. Stay alive as long as you can." },
    ];

    const I_BG        = '#0b1220';
    const I_TEXT      = '#f5f2ea';
    const I_ACCENT    = '#f4813f';
    const I_DARK      = '#1a1208';
    const I_BORDER    = 'rgba(245,242,234,0.14)';
    const I_CUT_CORNER = 'polygon(0 0, calc(100% - 18px) 0, 100% 18px, 100% 100%, 0 100%)';

    return (
      <IonPage>
        <IonContent fullscreen>
          <div style={{
            position:      'absolute',
            inset:         0,
            background:    I_BG,
            overflowY:     'auto',
          }}>
            <div style={{
              display:       'flex',
              flexDirection: 'column',
              padding:       SAFE_PAD,
            }}>

              {/* Section label */}
              <div style={{
                fontFamily:    FONT,
                fontSize:      '10px',
                fontWeight:    800,
                letterSpacing: '0.22em',
                textTransform: 'uppercase',
                color:         I_ACCENT,
                marginBottom:  10,
              }}>
                Mission Briefing
              </div>

              {/* Heading */}
              <div style={{
                fontFamily:    LOGO_FONT,
                fontSize:      '34px',
                lineHeight:    1.05,
                color:         I_TEXT,
                marginBottom:  24,
                letterSpacing: '0.01em',
              }}>
                How To <span style={{ color: I_ACCENT }}>Play</span>
              </div>

              {/* Steps */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
                {steps.map((step, i) => (
                  <div key={i} style={{
                    border:       `1px solid ${I_BORDER}`,
                    borderRadius: 0,
                    padding:      '12px 14px',
                    display:      'flex',
                    alignItems:   'center',
                    gap:          14,
                  }}>
                    <div style={{
                      width:          38,
                      height:         38,
                      flexShrink:     0,
                      display:        'flex',
                      alignItems:     'center',
                      justifyContent: 'center',
                      fontSize:       '18px',
                      border:         `1px solid ${I_BORDER}`,
                    }}>
                      {step.icon}
                    </div>
                    <div>
                      <div style={{
                        fontFamily:    FONT,
                        fontSize:      '12px',
                        fontWeight:    800,
                        letterSpacing: '0.10em',
                        textTransform: 'uppercase',
                        color:         I_TEXT,
                        marginBottom:  3,
                      }}>
                        {step.label}
                      </div>
                      <div style={{ fontFamily: FONT, fontSize: '13px', color: I_TEXT, lineHeight: 1.5, fontWeight: 400, opacity: 0.65 }}>
                        {step.text}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Tip */}
              <div style={{
                border:       `1px solid ${I_BORDER}`,
                borderRadius: 0,
                padding:      '14px 16px',
                marginBottom: 28,
                fontFamily:   FONT,
                fontSize:     '13px',
                color:        I_TEXT,
                opacity:      0.65,
                lineHeight:   1.6,
              }}>
                <span style={{ color: I_ACCENT, fontWeight: 800 }}>Tip:</span> Hold your phone up and face forward to begin. Spin your whole body — humanoids can attack from any direction!
              </div>

              {/* Main Menu */}
              <button
                onClick={() => setScreen('landing')}
                style={{
                  width:          '100%',
                  padding:        '1rem 1.5rem',
                  fontFamily:     FONT,
                  fontSize:       '13px',
                  fontWeight:     800,
                  letterSpacing:  '0.14em',
                  textTransform:  'uppercase',
                  color:          I_DARK,
                  background:     I_ACCENT,
                  border:         'none',
                  clipPath:       I_CUT_CORNER,
                  cursor:         'pointer',
                  marginBottom:   24,
                }}
              >
                Main Menu
              </button>
            </div>
          </div>
        </IonContent>
      </IonPage>
    );
  }

  // ── Missions page ────────────────────────────────────────────────────────────
  if (screen === 'missions') {
    const M_BG        = '#0b1220';
    const M_TEXT      = '#f5f2ea';
    const M_ACCENT    = '#f4813f';
    const M_DARK      = '#1a1208';
    const M_BORDER    = 'rgba(245,242,234,0.14)';
    const M_CUT_CORNER = 'polygon(0 0, calc(100% - 18px) 0, 100% 18px, 100% 100%, 0 100%)';

    return (
      <IonPage>
        <IonContent fullscreen>
          <div style={{
            position:      'absolute',
            inset:         0,
            background:    M_BG,
            overflowY:     'auto',
          }}>
            <div style={{
              display:       'flex',
              flexDirection: 'column',
              padding:       SAFE_PAD,
            }}>

              {/* Heading */}
              <div style={{
                fontFamily:   LOGO_FONT,
                fontSize:     '34px',
                color:        M_TEXT,
                marginBottom: 24,
              }}>
                Missions
              </div>

              {/* Badge shelf — earned badges in full color, unearned as dim silhouettes */}
              <div style={{ border: `1px solid ${M_BORDER}`, padding: '14px 16px', marginBottom: 24 }}>
                <div style={{
                  fontFamily:    FONT,
                  fontSize:      '10px',
                  fontWeight:    800,
                  letterSpacing: '0.16em',
                  textTransform: 'uppercase',
                  color:         M_TEXT,
                  opacity:       0.45,
                  marginBottom:  14,
                }}>
                  Badges — {earnedBadgeIds.size}/{BADGES.length}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
                  {BADGES.map(badge => {
                    const earned = earnedBadgeIds.has(badge.id);
                    return (
                      <div key={badge.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                        <BadgeIcon emblem={badge.emblem} earned={earned} size={38} />
                        <span style={{
                          fontFamily:    FONT,
                          fontSize:      '7px',
                          fontWeight:    700,
                          letterSpacing: '0.03em',
                          textTransform: 'uppercase',
                          color:         earned ? M_TEXT : 'rgba(245,242,234,0.35)',
                          textAlign:     'center',
                          lineHeight:    1.25,
                        }}>
                          {badge.name}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Mission list */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
                {MISSIONS.map(mission => {
                  const progress = getMissionProgress(mission, missionStats);
                  const complete = isMissionComplete(mission, missionStats);
                  const claimed  = claimedIds.has(mission.id);
                  const current  = Math.min(missionStats[mission.stat], mission.target);

                  return (
                    <div key={mission.id} style={{ border: `1px solid ${M_BORDER}`, padding: '14px 16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                        <div style={{
                          fontFamily:    FONT,
                          fontSize:      '13px',
                          fontWeight:    800,
                          letterSpacing: '0.08em',
                          textTransform: 'uppercase',
                          color:         M_TEXT,
                        }}>
                          {mission.label}
                        </div>
                        <div style={{
                          fontFamily:    FONT,
                          fontSize:      '10px',
                          fontWeight:    800,
                          letterSpacing: '0.06em',
                          textTransform: 'uppercase',
                          color:         claimed ? M_ACCENT : complete ? M_ACCENT : 'rgba(245,242,234,0.35)',
                        }}>
                          {claimed ? 'Claimed' : complete ? 'Complete!' : `${current}/${mission.target}`}
                        </div>
                      </div>

                      <div style={{ fontFamily: FONT, fontSize: '12px', color: M_TEXT, opacity: 0.6, lineHeight: 1.4, marginBottom: 10 }}>
                        {mission.description}
                      </div>

                      <div style={{ width: '100%', height: 5, background: 'rgba(245,242,234,0.10)' }}>
                        <div style={{ width: `${progress * 100}%`, height: '100%', background: M_ACCENT }} />
                      </div>

                      {mission.rewardCrosshair && (
                        <div style={{
                          fontFamily:    FONT,
                          fontSize:      '10px',
                          fontWeight:    700,
                          letterSpacing: '0.06em',
                          textTransform: 'uppercase',
                          color:         M_TEXT,
                          opacity:       0.4,
                          marginTop:     8,
                        }}>
                          Reward — {mission.rewardCrosshair} crosshair
                        </div>
                      )}

                      {complete && !claimed && (
                        <button
                          onClick={() => claimMission(mission.id)}
                          style={{
                            width:          '100%',
                            marginTop:      10,
                            padding:        '0.55rem',
                            fontFamily:     FONT,
                            fontSize:       '11px',
                            fontWeight:     800,
                            letterSpacing:  '0.12em',
                            textTransform:  'uppercase',
                            color:          M_DARK,
                            background:     M_ACCENT,
                            border:         'none',
                            clipPath:       M_CUT_CORNER,
                            cursor:         'pointer',
                          }}
                        >
                          Claim
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Main Menu */}
              <button
                onClick={() => setScreen('landing')}
                style={{
                  width:          '100%',
                  padding:        '1rem 1.5rem',
                  fontFamily:     FONT,
                  fontSize:       '13px',
                  fontWeight:     800,
                  letterSpacing:  '0.14em',
                  textTransform:  'uppercase',
                  color:          M_TEXT,
                  background:     'transparent',
                  border:         `1.5px solid ${M_BORDER}`,
                  cursor:         'pointer',
                  marginBottom:   24,
                }}
              >
                Main Menu
              </button>
            </div>
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

    const S_BG     = '#0b1220';
    const S_TEXT   = '#f5f2ea';
    const S_ACCENT = '#f4813f';
    const S_BORDER = 'rgba(245,242,234,0.14)';

    const sectionLabel: React.CSSProperties = {
      fontFamily:    FONT,
      fontSize:      '10px',
      fontWeight:    800,
      letterSpacing: '0.20em',
      textTransform: 'uppercase',
      color:         S_TEXT,
      opacity:       0.4,
      marginBottom:  8,
    };

    return (
      <IonPage>
        <IonContent fullscreen>
          <div style={{
            position:      'absolute',
            inset:         0,
            background:    S_BG,
            overflowY:     'auto',
          }}>
            <div style={{
              display:       'flex',
              flexDirection: 'column',
              padding:       SAFE_PAD,
            }}>

              {/* Heading */}
              <div style={{
                fontFamily:    LOGO_FONT,
                fontSize:      '34px',
                color:         S_TEXT,
                marginBottom:  24,
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
                  background:     'transparent',
                  border:         `1px solid ${S_BORDER}`,
                  borderRadius:   0,
                  padding:        '14px 16px',
                  marginBottom:   24,
                  cursor:         'pointer',
                  color:          S_TEXT,
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
                  color:         isMuted ? 'rgba(245,242,234,0.30)' : S_ACCENT,
                }}>
                  {isMuted ? 'Off' : 'On'}
                </span>
              </button>

              {/* ── Crosshair ── */}
              <div style={sectionLabel}>Crosshair</div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginBottom: 24 }}>
                {CROSSHAIR_OPTIONS.map(({ type, label }) => {
                  const unlocked = isCrosshairUnlocked(type);
                  const unlockMission = MISSIONS.find(m => m.rewardCrosshair === type);
                  return (
                    <button
                      key={type}
                      onClick={() => { if (unlocked) setCrosshair(type); }}
                      disabled={!unlocked}
                      style={{
                        display:        'flex',
                        flexDirection:  'column',
                        alignItems:     'center',
                        gap:            8,
                        background:     crosshairType === type ? 'rgba(244,129,63,0.10)' : 'transparent',
                        border:         `1.5px solid ${crosshairType === type ? S_ACCENT : S_BORDER}`,
                        borderRadius:   0,
                        padding:        '10px 6px 8px',
                        cursor:         unlocked ? 'pointer' : 'default',
                        opacity:        unlocked ? 1 : 0.45,
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
                        color:         crosshairType === type ? S_ACCENT : 'rgba(245,242,234,0.40)',
                      }}>
                        {label}
                      </span>
                      {!unlocked && unlockMission && (
                        <span style={{
                          fontFamily:    FONT,
                          fontSize:      '7px',
                          fontWeight:    600,
                          letterSpacing: '0.04em',
                          textTransform: 'uppercase',
                          color:         'rgba(245,242,234,0.35)',
                          textAlign:     'center',
                          lineHeight:    1.3,
                        }}>
                          🔒 {unlockMission.label}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* ── Stats ── */}
              <div style={sectionLabel}>Stats</div>
              <div style={{
                display:        'flex',
                alignItems:     'center',
                justifyContent: 'space-between',
                marginBottom:   14,
              }}>
                <span style={{ fontFamily: FONT, fontSize: '14px', color: S_TEXT, opacity: 0.7 }}>Best Score</span>
                <span style={{ fontFamily: LOGO_FONT, fontSize: '22px', color: S_TEXT }}>
                  {highScore > 0 ? (
                    <>
                      <span style={{ color: S_ACCENT }}>{highScore}</span> {highScore === 1 ? 'Kill' : 'Kills'}
                    </>
                  ) : '—'}
                </span>
              </div>
              <div style={{ marginBottom: 24 }}>
                <ResetHighScore onReset={resetHighScore} />
              </div>

              {/* ── About ── */}
              <div style={{
                fontFamily:   FONT,
                fontSize:     '13px',
                color:        S_TEXT,
                opacity:      0.5,
                lineHeight:   1.8,
                marginBottom: 24,
              }}>
                <div style={{ fontFamily: LOGO_FONT, fontSize: '18px', color: S_TEXT, opacity: 0.8, marginBottom: 4 }}>Holdout</div>
                <div>Version 1.0</div>
                <div>© 2025</div>
              </div>

              {/* Main Menu */}
              <button
                onClick={() => setScreen('landing')}
                style={{
                  width:          '100%',
                  padding:        '1rem 1.5rem',
                  fontFamily:     FONT,
                  fontSize:       '13px',
                  fontWeight:     800,
                  letterSpacing:  '0.14em',
                  textTransform:  'uppercase',
                  color:          S_TEXT,
                  background:     'transparent',
                  border:         `1.5px solid ${S_BORDER}`,
                  borderRadius:   0,
                  cursor:         'pointer',
                  marginBottom:   8,
                }}
              >
                Main Menu
              </button>

            </div>
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

    const D_BG        = '#0b1220';
    const D_TEXT      = '#f5f2ea';
    const D_ACCENT    = '#f4813f';
    const D_DARK      = '#1a1208';
    const D_BORDER    = 'rgba(245,242,234,0.14)';
    const D_CUT_CORNER = 'polygon(0 0, calc(100% - 18px) 0, 100% 18px, 100% 100%, 0 100%)';

    const sectionLabel: React.CSSProperties = {
      fontFamily:    FONT,
      fontSize:      '10px',
      fontWeight:    800,
      letterSpacing: '0.20em',
      textTransform: 'uppercase',
      color:         D_TEXT,
      opacity:       0.4,
      marginBottom:  8,
    };

    const [headingA, headingB] = gameOver ? ['Game', 'Over'] : ['This', 'Round'];

    const secondaryBtn: React.CSSProperties = {
      width:          '100%',
      padding:        '1rem 1.5rem',
      fontFamily:     FONT,
      fontSize:       '13px',
      fontWeight:     800,
      letterSpacing:  '0.14em',
      textTransform:  'uppercase',
      color:          D_TEXT,
      background:     'transparent',
      border:         `1.5px solid ${D_BORDER}`,
      cursor:         'pointer',
    };

    return (
      <IonPage>
        <IonContent fullscreen>
          <div style={{
            position:      'absolute',
            inset:         0,
            background:    D_BG,
            overflowY:     'auto',
          }}>
            <div style={{
              display:       'flex',
              flexDirection: 'column',
              padding:       SAFE_PAD,
            }}>

              {/* Heading */}
              <div style={{
                fontFamily:    LOGO_FONT,
                fontSize:      '34px',
                lineHeight:    1.05,
                color:         D_TEXT,
                marginBottom:  24,
                textAlign:     'center',
                letterSpacing: '0.01em',
              }}>
                {headingA} <span style={{ color: D_ACCENT }}>{headingB}</span>
              </div>

              {/* Score */}
              <div style={sectionLabel}>Kills</div>
              <div style={{
                border:        `1px solid ${D_BORDER}`,
                borderRadius:  0,
                padding:       '14px 16px',
                display:       'flex',
                flexDirection: 'column',
                alignItems:    'center',
                gap:           2,
                marginBottom:  24,
              }}>
                {isNewRecord && (
                  <div style={{
                    fontFamily:    FONT,
                    fontSize:      '10px',
                    fontWeight:    800,
                    letterSpacing: '0.16em',
                    textTransform: 'uppercase',
                    color:         D_ACCENT,
                    marginBottom:  4,
                  }}>
                    New High Score!
                  </div>
                )}
                <div style={{ fontFamily: LOGO_FONT, fontSize: '56px', color: D_TEXT, lineHeight: 1 }}>
                  {finalScore}
                </div>
                {!isNewRecord && highScore > 0 && (
                  <div style={{
                    fontFamily:    FONT,
                    fontSize:      '12px',
                    fontWeight:    600,
                    color:         D_TEXT,
                    opacity:       0.4,
                    marginTop:     6,
                    letterSpacing: '0.08em',
                  }}>
                    Best: {highScore}
                  </div>
                )}
              </div>

              {/* Lives */}
              <div style={sectionLabel}>Lives</div>
              <div style={{
                border:        `1px solid ${D_BORDER}`,
                borderRadius:  0,
                padding:       '16px',
                display:       'flex',
                flexDirection: 'column',
                alignItems:    'center',
                gap:           12,
                marginBottom:  24,
              }}>
                <div style={{ display: 'flex', gap: 10 }}>
                  {Array.from({ length: maxLives }, (_, i) => (
                    <DiamondPip key={i} filled={i < lives} size={14} color={D_ACCENT} />
                  ))}
                </div>
                {lives < maxLives && nextLifeAt && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                    <div style={{
                      fontFamily:    FONT,
                      fontSize:      '10px',
                      color:         D_TEXT,
                      opacity:       0.45,
                      textTransform: 'uppercase',
                      letterSpacing: '0.12em',
                    }}>
                      Next life in
                    </div>
                    <div style={{ fontFamily: LOGO_FONT, fontSize: '24px', color: D_TEXT, letterSpacing: '0.04em', lineHeight: 1 }}>
                      {countdown}
                    </div>
                  </div>
                )}
              </div>

              {/* Buttons */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: 4 }}>
                {lives > 0 && (
                  <button
                    onClick={handleTryAgain}
                    style={{
                      width:          '100%',
                      padding:        '1.05rem 1.5rem',
                      fontFamily:     FONT,
                      fontSize:       '14px',
                      fontWeight:     800,
                      letterSpacing:  '0.14em',
                      textTransform:  'uppercase',
                      color:          D_DARK,
                      background:     D_ACCENT,
                      border:         'none',
                      clipPath:       D_CUT_CORNER,
                      cursor:         'pointer',
                    }}
                  >
                    Try Again
                  </button>
                )}
                {showAdBtn && isOnline && (
                  <button
                    onClick={handleWatchAd}
                    disabled={adDisabled}
                    style={{
                      ...secondaryBtn,
                      opacity: adDisabled ? 0.45 : 1,
                      cursor:  adDisabled ? 'default' : 'pointer',
                    }}
                  >
                    {adLoading ? 'Loading Ad…' : 'Watch Ad for a Life'}
                  </button>
                )}
                <button onClick={() => setScreen('landing')} style={secondaryBtn}>
                  Main Menu
                </button>
              </div>

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
  const L_BG        = '#0b1220';
  const L_TEXT      = '#f5f2ea';
  const L_ACCENT    = '#f4813f';
  const L_DARK      = '#1a1208';
  const L_BORDER    = 'rgba(245,242,234,0.14)';
  const L_CUT_CORNER = 'polygon(0 0, calc(100% - 18px) 0, 100% 18px, 100% 100%, 0 100%)';

  const secondaryBtn: React.CSSProperties = {
    flex:          1,
    background:    'transparent',
    border:        '1.5px solid rgba(245,242,234,0.22)',
    padding:       '0.8rem 0.5rem',
    fontFamily:    FONT,
    fontSize:      '11px',
    fontWeight:    800,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color:         L_TEXT,
    cursor:        'pointer',
  };

  return (
    <IonPage>
      <IonContent fullscreen>
        <div style={{
          position:      'absolute',
          inset:         0,
          background:    L_BG,
          display:       'flex',
          flexDirection: 'column',
          padding:       SAFE_PAD,
          overflowY:     'auto',
        }}>
          <MenuGridFloor />
          <MenuDustMotes />

          {/* Logo, with a radiating backdrop where the character used to be */}
          <div style={{ position: 'relative', alignSelf: 'center', marginTop: 48 }}>
            {/* <img
              src={sunburstImg}
              alt=""
              aria-hidden="true"
              style={{
                position:  'absolute',
                top:       '50%',
                left:      '50%',
                width:     680,
                maxWidth:  'none',
                transform: 'translate(-50%, -50%)',
                opacity:   0.2,
                pointerEvents: 'none',
                userSelect: 'none',
              }}
            /> */}
            <img
              src={logoImg}
              alt="Holdout"
              onPointerDown={handleTitlePressStart}
              onPointerUp={handleTitlePressEnd}
              onPointerLeave={handleTitlePressEnd}
              style={{ position: 'relative', width: '78vw', maxWidth: 320, display: 'block', userSelect: 'none', WebkitUserDrag: 'none' } as React.CSSProperties}
            />
          </div>

          {/* Subtitle */}
          <div style={{
            color:         '#ffffff',
            fontFamily:    FONT,
            fontWeight:    400,
            fontSize:      '15px',
            textTransform: 'uppercase',
            letterSpacing: '0.16em',
            textAlign:     'center',
            marginTop:     -38,
          }}>
            Shoot to survive
          </div>

          {/* Lives / countdown / best score — anchored a little past the
              screen's midpoint so the bordered cards clear the subtitle above */}
          <div style={{
            position:  'absolute',
            top:       '55%',
            // Match SAFE_PAD's horizontal inset — absolutely positioned
            // elements sit in the parent's padding box, so left/right:0
            // here would ignore that padding and bleed to the screen edge.
            left:      'calc(32px + env(safe-area-inset-left))',
            right:     'calc(32px + env(safe-area-inset-right))',
            transform: 'translateY(-50%)',
            display:       'flex',
            flexDirection: 'column',
            alignItems:    'center',
          }}>
            {/* Lives + Best score, in one bordered container split by a
                divider — matches the pause screen's Lives + Incoming layout */}
            <div style={{
              display:        'flex',
              justifyContent: 'space-around',
              alignItems:     'flex-start',
              width:          '100%',
              border:         `1px solid ${L_BORDER}`,
              padding:        '18px 24px',
              marginBottom:   20,
              boxSizing:      'border-box',
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                <div style={{
                  fontFamily:    FONT,
                  fontSize:      '15px',
                  fontWeight:    800,
                  letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                  color:         L_TEXT,
                  opacity:       0.4,
                }}>
                  Lives
                </div>
                <div style={{ display: 'flex', gap: 11 }}>
                  {Array.from({ length: maxLives }, (_, i) => (
                    <DiamondPip key={i} filled={i < lives} size={20} color={L_ACCENT} />
                  ))}
                </div>

                {/* Next-life countdown */}
                {lives < maxLives && nextLifeAt && (
                  <div style={{
                    textAlign:     'center',
                    fontFamily:    FONT,
                    fontSize:      '13px',
                    fontWeight:    800,
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    color:         L_TEXT,
                    opacity:       0.55,
                    marginTop:     4,
                  }}>
                    Next life {countdown}
                  </div>
                )}
              </div>

              {/* Best score — tap through to the full scores page */}
              {highScore > 0 && (
                <>
                  <div style={{ width: 1, alignSelf: 'stretch', background: L_BORDER }} />

                  <button
                    onClick={() => setScreen('scores')}
                    style={{
                      display:        'flex',
                      flexDirection:  'column',
                      alignItems:     'center',
                      gap:            10,
                      background:     'transparent',
                      border:         'none',
                      padding:        0,
                      cursor:         'pointer',
                    }}
                  >
                    <span style={{
                      fontFamily:    FONT,
                      fontSize:      '15px',
                      fontWeight:    800,
                      letterSpacing: '0.18em',
                      textTransform: 'uppercase',
                      color:         L_TEXT,
                      opacity:       0.4,
                    }}>
                      Best
                    </span>
                    <span style={{ fontFamily: LOGO_FONT, fontSize: '46px', color: L_ACCENT, lineHeight: 1 }}>{highScore}</span>
                  </button>
                </>
              )}
            </div>
          </div>

          <div style={{ flex: 1 }} />

          {/* Buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 8 }}>
            {/* Play — hidden when lives = 0 */}
            {lives > 0 && (
              <button
                onClick={handleStart}
                style={{
                  width:          '100%',
                  padding:        '1.05rem 1.5rem',
                  fontFamily:     FONT,
                  fontSize:       '15px',
                  fontWeight:     800,
                  letterSpacing:  '0.14em',
                  textTransform:  'uppercase',
                  color:          L_DARK,
                  background:     L_ACCENT,
                  border:         'none',
                  clipPath:       L_CUT_CORNER,
                  cursor:         'pointer',
                }}
              >
                Play
              </button>
            )}

            {/* Watch Ad — shown only after lives hit 0, until back to max */}
            {adUnlocked && lives < maxLives && isOnline && (
              <button
                onClick={handleWatchAd}
                disabled={adStatus !== 'ready'}
                style={{
                  width:          '100%',
                  padding:        '1.05rem 1.5rem',
                  fontFamily:     FONT,
                  fontSize:       '13px',
                  fontWeight:     800,
                  letterSpacing:  '0.12em',
                  textTransform:  'uppercase',
                  color:          adStatus !== 'ready' ? 'rgba(245,242,234,0.35)' : L_DARK,
                  background:     adStatus !== 'ready' ? 'transparent' : L_ACCENT,
                  border:         adStatus !== 'ready' ? '1.5px solid rgba(245,242,234,0.22)' : 'none',
                  clipPath:       adStatus !== 'ready' ? undefined : L_CUT_CORNER,
                  cursor:         adStatus !== 'ready' ? 'default' : 'pointer',
                }}
              >
                {adStatus === 'loading' || adStatus === 'showing' ? 'Loading Ad…' : 'Watch Ad for a Life'}
              </button>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setScreen('instructions')} style={secondaryBtn}>How to Play</button>
              <button onClick={() => setScreen('missions')} style={secondaryBtn}>Missions</button>
              <button onClick={() => setScreen('settings')} style={secondaryBtn}>Settings</button>
            </div>
          </div>

        </div>
      </IonContent>
    </IonPage>
  );
};

export default Home;
