import { useEffect, useState } from 'react';
import { IonToast } from '@ionic/react';
import { useRewardedAd } from '../hooks/useRewardedAd';

const FONT      = "'Open Sans', sans-serif";
const LOGO_FONT = "'Squada One', sans-serif";
const COLOR     = '#f28f68';
const DARK      = '#1a1208';
const BG        = 'rgba(26, 18, 8, 0.82)';

interface Props {
  score:       number;
  highScore:   number;
  isNewRecord: boolean;
  lives:       number;
  maxLives:    number;
  nextLifeAt:  number | null;
  onContinue:  () => void;   // use a life to continue (life already deducted on death)
  onWatchAd:   () => void;   // called AFTER reward is confirmed
  onQuit:      () => void;   // come back later → main menu
}

function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60).toString().padStart(2, '0');
  const s = (total % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

const outlineBtn = (disabled = false): React.CSSProperties => ({
  background:    'transparent',
  color:         disabled ? 'rgba(242,143,104,0.4)' : COLOR,
  border:        `2px solid ${disabled ? 'rgba(242,143,104,0.4)' : COLOR}`,
  borderRadius:  '60px',
  padding:       '0.7rem 1.8rem',
  fontSize:      '14px',
  fontFamily:    FONT,
  fontWeight:    700,
  cursor:        disabled ? 'default' : 'pointer',
  letterSpacing: '0.10em',
  textTransform: 'uppercase',
  width:         '100%',
});

const solidBtn: React.CSSProperties = {
  background:    '#f2ead0',
  color:         DARK,
  border:        `3px solid ${DARK}`,
  borderRadius:  '60px',
  padding:       '0.7rem 1.8rem',
  fontSize:      '14px',
  fontFamily:    FONT,
  fontWeight:    900,
  cursor:        'pointer',
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  width:         '100%',
  boxShadow:     '0 4px 0 rgba(0,0,0,0.30)',
};

export default function DeathOverlay({ score, highScore, isNewRecord, lives, maxLives, nextLifeAt, onContinue, onWatchAd, onQuit }: Props) {
  const [countdown, setCountdown] = useState('');
  const [showToast, setShowToast] = useState(false);
  const gameOver = lives === 0;

  const { adStatus, adError, prepareAd, showAd } = useRewardedAd();

  // Preload the ad as soon as the overlay appears
  useEffect(() => {
    prepareAd();
  }, [prepareAd]);

  // Show toast when ad fails
  useEffect(() => {
    if (adError) setShowToast(true);
  }, [adError]);

  // Countdown tick
  useEffect(() => {
    if (!nextLifeAt) return;
    const tick = () => setCountdown(formatCountdown(nextLifeAt - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [nextLifeAt]);

  const handleWatchAd = () => {
    if (adStatus !== 'ready') return;
    showAd(() => {
      // Only called inside the Rewarded event — never before
      onWatchAd();
    });
  };

  const adLoading  = adStatus === 'loading' || adStatus === 'showing';
  const adDisabled = adStatus !== 'ready';

  return (
    <>
      <div style={{
        position:             'absolute',
        inset:                0,
        zIndex:               40,
        display:              'flex',
        alignItems:           'center',
        justifyContent:       'center',
        background:           BG,
        backdropFilter:       'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        padding:              '32px',
      }}>
        <div style={{
          background:    'rgba(228, 213, 168, 0.97)',
          borderRadius:  '20px',
          padding:       '32px 28px',
          maxWidth:      320,
          width:         '100%',
          display:       'flex',
          flexDirection: 'column',
          alignItems:    'center',
          gap:           20,
        }}>

          {/* Title */}
          <div style={{
            fontFamily:    LOGO_FONT,
            fontSize:      '32px',
            color:         DARK,
            letterSpacing: '0.06em',
            textShadow:    '2px 2px 0 rgba(0,0,0,0.15)',
            textAlign:     'center',
          }}>
            {gameOver ? 'Game Over' : 'You Died'}
          </div>

          {/* Score + high score */}
          <div style={{ textAlign: 'center' }}>
            {isNewRecord && (
              <div style={{
                fontFamily:    FONT,
                fontSize:      '11px',
                fontWeight:    800,
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                color:         COLOR,
                marginBottom:  6,
              }}>
                New High Score!
              </div>
            )}
            <div style={{
              fontFamily:    LOGO_FONT,
              fontSize:      '52px',
              color:         DARK,
              lineHeight:    1,
            }}>
              {score}
            </div>
            <div style={{
              fontFamily:    FONT,
              fontSize:      '11px',
              fontWeight:    400,
              color:         DARK,
              opacity:       0.4,
              marginTop:     4,
              letterSpacing: '0.10em',
              textTransform: 'uppercase',
            }}>
              {score === 1 ? 'Kill' : 'Kills'}
            </div>
            {!isNewRecord && (
              <div style={{
                fontFamily:    FONT,
                fontSize:      '12px',
                fontWeight:    600,
                color:         DARK,
                opacity:       0.45,
                marginTop:     10,
                letterSpacing: '0.08em',
              }}>
                Best: {highScore}
              </div>
            )}
          </div>

          {/* Life dots */}
          <div style={{ display: 'flex', gap: 10 }}>
            {Array.from({ length: maxLives }, (_, i) => (
              <div key={i} style={{
                width:        18,
                height:       18,
                borderRadius: '50%',
                background:   i < lives ? COLOR : 'transparent',
                border:       `2px solid ${COLOR}`,
                transition:   'background 0.2s ease',
              }} />
            ))}
          </div>

          {/* Countdown (game over + regen in progress) */}
          {gameOver && nextLifeAt && (
            <div style={{ textAlign: 'center' }}>
              <div style={{
                fontFamily:    FONT,
                fontSize:      '12px',
                color:         DARK,
                opacity:       0.5,
                textTransform: 'uppercase',
                letterSpacing: '0.10em',
                marginBottom:  6,
              }}>
                Next life in
              </div>
              <div style={{
                fontFamily:    LOGO_FONT,
                fontSize:      '36px',
                color:         DARK,
                letterSpacing: '0.04em',
                lineHeight:    1,
              }}>
                {countdown}
              </div>
            </div>
          )}

          {/* Buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%' }}>

            {/* Watch Ad */}
            <button
              onClick={handleWatchAd}
              disabled={adDisabled}
              style={outlineBtn(adDisabled)}
            >
              {adLoading ? 'Loading Ad…' : 'Watch Ad for a Life'}
            </button>

            {/* Use a Life to Continue (lives > 0 only) */}
            {!gameOver && (
              <button onClick={onContinue} style={solidBtn}>
                Use a Life to Continue
              </button>
            )}

            {/* Come Back Later (game over only) */}
            {gameOver && (
              <button onClick={onQuit} style={solidBtn}>
                Come Back Later
              </button>
            )}

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
    </>
  );
}
