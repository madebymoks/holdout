import { useState, useRef, useCallback } from 'react';
import { CrosshairSVG } from './Crosshair';
import type { CrosshairType } from '../hooks/useCrosshair';

interface Props {
  onFire?:        () => void;
  gameOver?:      boolean;
  crosshairType?: CrosshairType;
}

const COOLDOWN_MS = 120;

export default function GameOverlay({ onFire, gameOver, crosshairType = 'tactical' }: Props) {
  const [pulsed, setPulsed] = useState(false);

  // A ref rather than state: the gate must be checked and set synchronously
  // on tap, not after a React re-render, or a fast second tap can slip
  // through (or get dropped) depending on render timing.
  const cooldownRef   = useRef(false);
  const cooldownTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pulseTimer    = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fire = useCallback(() => {
    if (cooldownRef.current) return;
    cooldownRef.current = true;

    setPulsed(true);
    if (pulseTimer.current) clearTimeout(pulseTimer.current);
    pulseTimer.current = setTimeout(() => setPulsed(false), 60);

    if (cooldownTimer.current) clearTimeout(cooldownTimer.current);
    cooldownTimer.current = setTimeout(() => { cooldownRef.current = false; }, COOLDOWN_MS);

    onFire?.();
  }, [onFire]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    fire();
  }, [fire]);

  return (
    <div
      style={{
        position:      'absolute',
        inset:         0,
        pointerEvents: gameOver ? 'none' : 'all',
        touchAction:   'none',
        cursor:        gameOver ? 'default' : 'crosshair',
        zIndex:        10,
      }}
      onPointerDown={!gameOver ? handlePointerDown : undefined}
    >
      {!gameOver && (
        <div style={{
          position:      'absolute',
          top:           '50%',
          left:          '50%',
          transform:     'translate(-50%, -50%)',
          pointerEvents: 'none',
        }}>
          <CrosshairSVG type={crosshairType} pulsed={pulsed} />
        </div>
      )}
    </div>
  );
}
