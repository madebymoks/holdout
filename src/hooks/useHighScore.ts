import { useState, useCallback } from 'react';

const KEY = 'holdout_high_score';

function readHighScore(): number {
  try {
    const raw = localStorage.getItem(KEY);
    return raw !== null ? Math.max(0, Number(raw)) : 0;
  } catch {
    return 0;
  }
}

function writeHighScore(score: number): void {
  try {
    localStorage.setItem(KEY, String(score));
  } catch {}
}

export interface HighScoreState {
  highScore:        number;
  updateHighScore:  (newScore: number) => boolean;
  resetHighScore:   () => void;
}

export function useHighScore(): HighScoreState {
  const [highScore, setHighScore] = useState<number>(() => readHighScore());

  const updateHighScore = useCallback((newScore: number): boolean => {
    if (newScore <= highScore) return false;
    setHighScore(newScore);
    writeHighScore(newScore);
    return true;
  }, [highScore]);

  const resetHighScore = useCallback(() => {
    setHighScore(0);
    try { localStorage.removeItem(KEY); } catch {}
  }, []);

  return { highScore, updateHighScore, resetHighScore };
}
