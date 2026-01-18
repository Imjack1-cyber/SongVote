import { useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { KeepAwake } from '@capacitor-community/keep-awake';

export function useNative() {
  const [isNative, setIsNative] = useState(false);

  useEffect(() => {
    setIsNative(Capacitor.isNativePlatform());
  }, []);

  const vibrate = async (style: ImpactStyle = ImpactStyle.Medium) => {
    if (Capacitor.isNativePlatform()) {
      try {
        await Haptics.impact({ style });
      } catch (e) {
        // Fallback or ignore if haptics fail
      }
    } else {
      // Optional: Web Vibration API Fallback
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(style === ImpactStyle.Heavy ? 50 : 20);
      }
    }
  };

  const keepAwake = async () => {
    if (Capacitor.isNativePlatform()) {
      try {
        await KeepAwake.keepAwake();
      } catch (e) {
        console.warn('KeepAwake failed', e);
      }
    }
  };

  const allowSleep = async () => {
    if (Capacitor.isNativePlatform()) {
      try {
        await KeepAwake.allowSleep();
      } catch (e) {
        console.warn('AllowSleep failed', e);
      }
    }
  };

  return {
    isNative,
    vibrate,
    keepAwake,
    allowSleep
  };
}