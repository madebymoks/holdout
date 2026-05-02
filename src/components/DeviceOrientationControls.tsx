import { useEffect, useRef } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { Euler, Quaternion, MathUtils } from 'three';
import { Capacitor } from '@capacitor/core';
import { Motion } from '@capacitor/motion';

const _euler   = new Euler();
const _targetQ = new Quaternion();
// Rotates from device-orientation space (Z-up) to Three.js camera space (Y-up)
const _q1 = new Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5));

// How aggressively to interpolate toward the target each frame.
// Lower = smoother but laggier; higher = more responsive but jitterier.
const SLERP_ALPHA = 0.22;

export default function DeviceOrientationControls() {
  const { camera } = useThree();
  const orientationRef = useRef<{ alpha: number; beta: number; gamma: number } | null>(null);

  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      // Native bridge: polled directly from the OS sensor stack, bypassing the
      // browser event pipeline that adds latency on Android WebView.
      let handle: { remove: () => void } | null = null;
      Motion.addListener('orientation', data => {
        orientationRef.current = {
          alpha: data.alpha ?? 0,
          beta:  data.beta  ?? 0,
          gamma: data.gamma ?? 0,
        };
      }).then(h => { handle = h; }).catch(() => {});
      return () => { handle?.remove(); };
    }

    // Web fallback (browser preview / dev server)
    const handler = (e: DeviceOrientationEvent) => {
      if (e.alpha === null) return;
      orientationRef.current = {
        alpha: e.alpha ?? 0,
        beta:  e.beta  ?? 0,
        gamma: e.gamma ?? 0,
      };
    };
    window.addEventListener('deviceorientation', handler, true);
    return () => window.removeEventListener('deviceorientation', handler, true);
  }, []);

  useFrame(() => {
    const o = orientationRef.current;
    if (!o) return;

    _euler.set(
      MathUtils.degToRad(o.beta),
      MathUtils.degToRad(o.alpha),
      MathUtils.degToRad(-o.gamma),
      'YXZ',
    );

    _targetQ.setFromEuler(_euler).multiply(_q1);
    camera.quaternion.slerp(_targetQ, SLERP_ALPHA);
  });

  return null;
}
