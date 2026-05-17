import { useCallback, useRef, useState } from 'react';
import { AdMob, RewardAdPluginEvents, AdMobRewardItem, AdLoadInfo } from '@capacitor-community/admob';
import { Capacitor } from '@capacitor/core';

const AD_ID = Capacitor.getPlatform() === 'ios'
  ? import.meta.env.VITE_ADMOB_REWARDED_IOS as string
  : import.meta.env.VITE_ADMOB_REWARDED_ANDROID as string;


export type AdStatus = 'idle' | 'loading' | 'ready' | 'showing' | 'failed';

export interface RewardedAdState {
  adStatus:   AdStatus;
  adError:    string | null;
  prepareAd:  () => Promise<void>;
  showAd:     (onRewarded: () => void) => Promise<void>;
}

export function useRewardedAd(): RewardedAdState {
  const [adStatus, setAdStatus] = useState<AdStatus>('idle');
  const [adError,  setAdError]  = useState<string | null>(null);
  const rewardedRef = useRef<(() => void) | null>(null);
  const listenersRef = useRef<ReturnType<typeof AdMob.addListener>[]>([]);

  const prepareAd = useCallback(async () => {
    setAdStatus('loading');
    setAdError(null);

    try {
      await AdMob.initialize({ testingDevices: [] });

      // Remove any previous listeners before re-adding
      await Promise.all(listenersRef.current.map(p => p.then(h => h.remove())));
      listenersRef.current = [];

      listenersRef.current.push(
        AdMob.addListener(RewardAdPluginEvents.Loaded, (_info: AdLoadInfo) => {
          setAdStatus('ready');
        }),

        AdMob.addListener(RewardAdPluginEvents.FailedToLoad, () => {
          setAdStatus('failed');
          setAdError('Ad unavailable, please try again later.');
        }),

        AdMob.addListener(RewardAdPluginEvents.Rewarded, (_reward: AdMobRewardItem) => {
          if (rewardedRef.current) {
            rewardedRef.current();
            rewardedRef.current = null;
          }
        }),

        AdMob.addListener(RewardAdPluginEvents.Dismissed, () => {
          setAdStatus('idle');
        }),

        AdMob.addListener(RewardAdPluginEvents.FailedToShow, () => {
          setAdStatus('failed');
          setAdError('Ad unavailable, please try again later.');
        }),
      );

      await AdMob.prepareRewardVideoAd({
        adId:      AD_ID,
        isTesting: false,
        npa:       false,
      });
    } catch {
      setAdStatus('failed');
      setAdError('Ad unavailable, please try again later.');
    }
  }, []);

  const showAd = useCallback(async (onRewarded: () => void) => {
    if (adStatus !== 'ready') return;
    rewardedRef.current = onRewarded;
    setAdStatus('showing');
    try {
      await AdMob.showRewardVideoAd();
    } catch {
      rewardedRef.current = null;
      setAdStatus('failed');
      setAdError('Ad unavailable, please try again later.');
    }
  }, [adStatus]);

  return { adStatus, adError, prepareAd, showAd };
}
