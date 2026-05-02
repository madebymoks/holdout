import { useState, useCallback } from 'react';

export type CrosshairType = 'tactical' | 'classic' | 'dot' | 'circle';

const KEY    = 'holdout_crosshair';
const VALID  = new Set<string>(['tactical', 'classic', 'dot', 'circle']);

function read(): CrosshairType {
  try {
    const v = localStorage.getItem(KEY);
    if (v && VALID.has(v)) return v as CrosshairType;
  } catch {}
  return 'tactical';
}

export function useCrosshair() {
  const [crosshairType, setCrosshairType] = useState<CrosshairType>(read);

  const setCrosshair = useCallback((type: CrosshairType) => {
    setCrosshairType(type);
    try { localStorage.setItem(KEY, type); } catch {}
  }, []);

  return { crosshairType, setCrosshair };
}
