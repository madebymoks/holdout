import { useState, useEffect, useCallback, useRef, createContext, useContext } from 'react';
import { App } from '@capacitor/app';

const MAX_LIVES = 4;
const REGEN_MS  = 5 * 60 * 1000;

const KEYS = {
  lives:      'holdout_lives',
  lastLost:   'holdout_last_lost_at',
  adUnlocked: 'holdout_ad_unlocked',
} as const;

function readStorage(): { lives: number; lastLostAt: number | null; adUnlocked: boolean } {
  try {
    const l = localStorage.getItem(KEYS.lives);
    const t = localStorage.getItem(KEYS.lastLost);
    const a = localStorage.getItem(KEYS.adUnlocked);
    return {
      lives:      l !== null ? Math.min(MAX_LIVES, Math.max(0, Number(l))) : MAX_LIVES,
      lastLostAt: t !== null ? Number(t) : null,
      adUnlocked: a === 'true',
    };
  } catch {
    return { lives: MAX_LIVES, lastLostAt: null, adUnlocked: false };
  }
}

function writeStorage(lives: number, lastLostAt: number | null, adUnlocked: boolean) {
  try {
    localStorage.setItem(KEYS.lives, String(lives));
    if (lastLostAt !== null) {
      localStorage.setItem(KEYS.lastLost, String(lastLostAt));
    } else {
      localStorage.removeItem(KEYS.lastLost);
    }
    if (adUnlocked) {
      localStorage.setItem(KEYS.adUnlocked, 'true');
    } else {
      localStorage.removeItem(KEYS.adUnlocked);
    }
  } catch {}
}

function applyRegen(lives: number, lastLostAt: number | null): { lives: number; lastLostAt: number | null } {
  if (lastLostAt === null) return { lives, lastLostAt: null };
  if (lives >= MAX_LIVES)  return { lives: MAX_LIVES, lastLostAt: null };
  const elapsed  = Date.now() - lastLostAt;
  const regained = Math.floor(elapsed / REGEN_MS);
  if (regained <= 0) return { lives, lastLostAt };
  const newLives    = Math.min(MAX_LIVES, lives + regained);
  const newLastLost = newLives >= MAX_LIVES ? null : lastLostAt + regained * REGEN_MS;
  return { lives: newLives, lastLostAt: newLastLost };
}

export interface LivesState {
  lives:       number;
  maxLives:    number;
  nextLifeAt:  number | null;
  adUnlocked:  boolean;
  loseLife:    () => void;
  gainLife:    () => void;
}

// Context — consumed anywhere in the tree via useLives()
export const LivesContext = createContext<LivesState>({
  lives:      MAX_LIVES,
  maxLives:   MAX_LIVES,
  nextLifeAt: null,
  adUnlocked: false,
  loseLife:   () => {},
  gainLife:   () => {},
});

export function useLives(): LivesState {
  return useContext(LivesContext);
}

// The actual hook — call this ONCE at the app root and pass into LivesContext.Provider
export function useLivesProvider(): LivesState {
  // Initialise synchronously from localStorage so there is never a flash to MAX_LIVES
  const [lives, setLives] = useState<number>(() => {
    const stored  = readStorage();
    const applied = applyRegen(stored.lives, stored.lastLostAt);
    const newAdUnlocked = applied.lives < MAX_LIVES ? stored.adUnlocked : false;
    writeStorage(applied.lives, applied.lastLostAt, newAdUnlocked);
    return applied.lives;
  });
  const [lastLostAt, setLastLostAt] = useState<number | null>(() => {
    const stored  = readStorage();
    const applied = applyRegen(stored.lives, stored.lastLostAt);
    return applied.lastLostAt;
  });
  const [adUnlocked, setAdUnlocked] = useState<boolean>(() => {
    const stored  = readStorage();
    const applied = applyRegen(stored.lives, stored.lastLostAt);
    return applied.lives < MAX_LIVES ? stored.adUnlocked : false;
  });

  const livesRef       = useRef(lives);
  const lastLostAtRef  = useRef(lastLostAt);
  const adUnlockedRef  = useRef(adUnlocked);
  livesRef.current      = lives;
  lastLostAtRef.current = lastLostAt;
  adUnlockedRef.current = adUnlocked;

  const checkRegen = useCallback(() => {
    const applied = applyRegen(livesRef.current, lastLostAtRef.current);
    if (applied.lives !== livesRef.current || applied.lastLostAt !== lastLostAtRef.current) {
      const newAdUnlocked = applied.lives < MAX_LIVES ? adUnlockedRef.current : false;
      setLives(applied.lives);
      setLastLostAt(applied.lastLostAt);
      setAdUnlocked(newAdUnlocked);
      writeStorage(applied.lives, applied.lastLostAt, newAdUnlocked);
    }
  }, []);

  useEffect(() => {
    const id = setInterval(checkRegen, 30_000);
    return () => clearInterval(id);
  }, [checkRegen]);

  useEffect(() => {
    let handle: Awaited<ReturnType<typeof App.addListener>> | null = null;
    App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) checkRegen();
    }).then(h => { handle = h; });
    return () => { handle?.remove(); };
  }, [checkRegen]);

  const loseLife = useCallback(() => {
    const current = livesRef.current;
    if (current <= 0) return;
    const next         = current - 1;
    const newLostAt    = lastLostAtRef.current ?? Date.now();
    const newAdUnlocked = next === 0 ? true : adUnlockedRef.current;
    setLives(next);
    setLastLostAt(newLostAt);
    setAdUnlocked(newAdUnlocked);
    writeStorage(next, newLostAt, newAdUnlocked);
  }, []);

  const gainLife = useCallback(() => {
    const current = livesRef.current;
    if (current >= MAX_LIVES) return;
    const next         = Math.min(MAX_LIVES, current + 1);
    const newLostAt    = next >= MAX_LIVES ? null : lastLostAtRef.current;
    const newAdUnlocked = next >= MAX_LIVES ? false : adUnlockedRef.current;
    setLives(next);
    setLastLostAt(newLostAt);
    setAdUnlocked(newAdUnlocked);
    writeStorage(next, newLostAt, newAdUnlocked);
  }, []);

  const nextLifeAt = lives >= MAX_LIVES || lastLostAt === null
    ? null
    : lastLostAt + REGEN_MS;

  return { lives, maxLives: MAX_LIVES, nextLifeAt, adUnlocked, loseLife, gainLife };
}
