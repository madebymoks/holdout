import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'io.ionic.starter',
  appName: 'Holdout',
  webDir: 'dist',
  ios: {
    allowsLinkPreview: false,
    scrollEnabled:     false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration:    5000,
      launchAutoHide:        false,
      backgroundColor:       '#121d2e',
      androidSplashResourceName: 'splash',
      androidScaleType:      'CENTER_CROP',
      showSpinner:           false,
      iosSpinnerStyle:       'small',
      spinnerColor:          '#f28f68',
    },
  },
};

export default config;
