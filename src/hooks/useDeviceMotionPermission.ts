import { useState, useEffect, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { Motion } from '@capacitor/motion';

export type PermissionState = 'unknown' | 'pending' | 'granted' | 'denied';

const PREF_KEY = 'holdout_motion_permission';

const platform  = Capacitor.getPlatform();
const isIos     = platform === 'ios';
const isAndroid = platform === 'android';
// On iOS 13+, requestPermission is required. Treat any native iOS build as
// needing the prompt — don't rely solely on the function check, which can
// return undefined in some WKWebView configurations before a gesture fires.
const needsIosPerm = isIos;

// Read persisted result synchronously if available, otherwise 'unknown'
async function loadPersisted(): Promise<PermissionState> {
  try {
    const { value } = await Preferences.get({ key: PREF_KEY });
    if (value === 'granted') return 'granted';
    if (value === 'denied')  return 'denied';
  } catch {}
  return 'unknown';
}

async function persist(state: 'granted' | 'denied') {
  try { await Preferences.set({ key: PREF_KEY, value: state }); } catch {}
}

export function useDeviceMotionPermission() {
  // Start as 'unknown' — PermissionGate waits until resolved before rendering app
  const [permission, setPermission] = useState<PermissionState>('unknown');

  // On mount: check persisted result, then probe if needed
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const stored = await loadPersisted();

      if (cancelled) return;

      // Already decided in a previous session
      if (stored === 'denied')  { setPermission('denied');  return; }

      if (stored === 'granted') {
        if (!isIos) {
          setPermission('granted');
          return;
        }
        // iOS: WKWebView requires requestPermission() once per session to re-activate motion
        // events, even when the OS-level permission is already granted. When already granted,
        // the call returns immediately without showing a dialog or needing a user gesture.
        const requestFn =
          typeof (DeviceOrientationEvent as any).requestPermission === 'function'
            ? (DeviceOrientationEvent as any).requestPermission.bind(DeviceOrientationEvent)
            : typeof (DeviceMotionEvent as any).requestPermission === 'function'
              ? (DeviceMotionEvent as any).requestPermission.bind(DeviceMotionEvent)
              : null;
        if (requestFn) {
          try {
            const result = await requestFn();
            if (!cancelled) setPermission(result === 'granted' ? 'granted' : 'pending');
          } catch {
            // Silent re-request failed — fall back to permission screen. The tap will call
            // requestPermission() in a user gesture context and resolve instantly since OS
            // already has permission granted.
            if (!cancelled) setPermission('pending');
          }
        } else {
          if (!cancelled) setPermission('granted');
        }
        return;
      }

      // Web: no permission gate needed
      if (!isIos && !isAndroid) { setPermission('granted'); return; }

      // Android: probe @capacitor/motion to confirm sensors fire
      if (isAndroid) {
        let resolved = false;
        let handle: { remove: () => void } | null = null;

        const finish = async (state: 'granted' | 'denied') => {
          if (resolved) return;
          resolved = true;
          handle?.remove();
          clearTimeout(timer);
          await persist(state);
          if (!cancelled) setPermission(state);
        };

        try {
          handle = await Motion.addListener('accel', (data) => {
            // Any non-zero accel means sensors are live
            if (data.acceleration.x !== 0 || data.acceleration.y !== 0 || data.acceleration.z !== 0) {
              finish('granted');
            }
          });
        } catch {
          finish('denied');
          return;
        }

        const timer = setTimeout(() => finish('denied'), 2500);
        return;
      }

      // iOS: show the prompt splash (permission === 'pending' triggers PermissionGate UI)
      setPermission('pending');
    })();

    return () => { cancelled = true; };
  }, []);

  // Called by the UI button — only meaningful on iOS.
  //
  // CRITICAL: DeviceOrientationEvent.requestPermission() must be called with NO prior
  // awaits in the call stack. Any await before it breaks the user-gesture chain and iOS
  // silently suppresses the native permission dialog. Persistence happens AFTER the call.
  const requestPermission = useCallback(async (): Promise<PermissionState> => {
    if (!needsIosPerm) {
      await persist('granted');
      setPermission('granted');
      return 'granted';
    }

    // Resolve the function reference synchronously — no awaits yet.
    const requestFn =
      typeof (DeviceOrientationEvent as any).requestPermission === 'function'
        ? (DeviceOrientationEvent as any).requestPermission.bind(DeviceOrientationEvent)
        : typeof (DeviceMotionEvent as any).requestPermission === 'function'
          ? (DeviceMotionEvent as any).requestPermission.bind(DeviceMotionEvent)
          : null;

    if (!requestFn) {
      // No permission API — older iOS or misconfigured WKWebView; grant silently.
      await persist('granted');
      setPermission('granted');
      return 'granted';
    }

    // Call immediately — this is the first await, preserving the user gesture context.
    // iOS shows the native dialog here and resolves when the user responds.
    let result: string;
    try {
      result = await requestFn();
    } catch {
      await Preferences.remove({ key: PREF_KEY });
      await persist('denied');
      setPermission('denied');
      return 'denied';
    }

    // Persist the result now that the gesture-sensitive call is done.
    await Preferences.remove({ key: PREF_KEY });
    const state: PermissionState = result === 'granted' ? 'granted' : 'denied';
    await persist(state);
    setPermission(state);
    return state;
  }, []);

  return { permission, requestPermission };
}
