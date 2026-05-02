import { useRef, useEffect, useCallback, useState } from 'react';

import pulseSrc           from '../components/sounds/pulse.mp3';
import heavybulletpingSrc from '../components/sounds/heavybulletping.mp3';
import teleportSrc        from '../components/sounds/teleport.mp3';
import whooshSrc          from '../components/sounds/whoosh.mp3';
import winSrc             from '../components/sounds/win.mp3';

const SOURCES: Record<string, string> = {
  pulseSrc, heavybulletpingSrc, teleportSrc, whooshSrc, winSrc,
};

const MUTE_KEY = 'holdout_muted';

// ── Module-level mute state ───────────────────────────────────────────────────

let muted = localStorage.getItem(MUTE_KEY) === 'true';
const listeners = new Set<(m: boolean) => void>();

function setMuted(value: boolean) {
  muted = value;
  try { localStorage.setItem(MUTE_KEY, String(value)); } catch {}
  listeners.forEach(fn => fn(value));
}

// ── Audio state ───────────────────────────────────────────────────────────────

// AudioContext is created lazily on the FIRST play call (user gesture).
// iOS requires the context to be created inside a gesture — creating it in
// useEffect (no gesture) produces a permanently-suspended context that
// resume() cannot unblock.
let ctx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  return ctx;
}

// Raw ArrayBuffers fetched at mount (no AudioContext needed for fetching)
const rawData: Record<string, ArrayBuffer> = {};
// Decoded AudioBuffers — populated lazily on first play inside user gesture
const decoded: Record<string, AudioBuffer> = {};

async function prefetch(key: string, src: string): Promise<void> {
  if (rawData[key]) return;
  try {
    const res  = await fetch(src);
    rawData[key] = await res.arrayBuffer();
  } catch {}
}

function playSound(key: string, volume = 1): void {
  if (muted) return;

  const fire = (buf: AudioBuffer) => {
    const c = getCtx();
    const source = c.createBufferSource();
    source.buffer = buf;
    if (volume !== 1) {
      const gain = c.createGain();
      gain.gain.value = volume;
      source.connect(gain);
      gain.connect(c.destination);
    } else {
      source.connect(c.destination);
    }
    source.start();
  };

  const run = (buf: AudioBuffer) => {
    const c = getCtx();
    // Resume if suspended, then play
    if (c.state === 'suspended') {
      c.resume().then(() => fire(buf)).catch(() => {});
    } else {
      fire(buf);
    }
  };

  if (decoded[key]) {
    run(decoded[key]);
    return;
  }

  // First play for this sound — decode now (we're inside a user gesture)
  const raw = rawData[key];
  if (!raw) return;

  // getCtx() here creates the AudioContext inside the user gesture call stack
  getCtx().decodeAudioData(raw.slice(0), buf => {
    decoded[key] = buf;
    run(buf);
  });
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export interface GameSounds {
  playShot:   () => void;
  playHit:    () => void;
  playSpawn:  () => void;
  playMiss:   () => void;
  playWin:    () => void;
  isMuted:    boolean;
  toggleMute: () => void;
}

export function useGameSounds(): GameSounds {
  const [isMuted, setIsMuted] = useState(muted);

  useEffect(() => {
    const handler = (m: boolean) => setIsMuted(m);
    listeners.add(handler);
    return () => { listeners.delete(handler); };
  }, []);

  // Prefetch raw bytes at mount — no AudioContext created here
  const fetched = useRef(false);
  useEffect(() => {
    if (fetched.current) return;
    fetched.current = true;
    Object.entries(SOURCES).forEach(([key, src]) => prefetch(key, src));
  }, []);

  const playShot  = useCallback(() => playSound('pulseSrc'), []);
  const playHit   = useCallback(() => playSound('heavybulletpingSrc'), []);
  const playSpawn = useCallback(() => playSound('teleportSrc'), []);
  const playMiss  = useCallback(() => playSound('whooshSrc'), []);
  const playWin   = useCallback(() => playSound('winSrc'), []);

  const toggleMute = useCallback(() => setMuted(!muted), []);

  return { playShot, playHit, playSpawn, playMiss, playWin, isMuted, toggleMute };
}
