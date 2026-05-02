import { useState, useEffect, useCallback } from 'react';
import { Redirect, Route } from 'react-router-dom';
import { IonApp, IonRouterOutlet, setupIonicReact } from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import { SplashScreen } from '@capacitor/splash-screen';
import Home from './pages/Home';
import { OnlineStatusContext, useOnlineStatusProvider } from './hooks/useOnlineStatus';
import { LivesContext, useLivesProvider } from './hooks/useLives';
import PermissionGate from './components/PermissionGate';
import DisclaimerScreen from './components/DisclaimerScreen';
import { getStorage } from './storage';

/* Core CSS required for Ionic components to work properly */
import '@ionic/react/css/core.css';

/* Basic CSS for apps built with Ionic */
import '@ionic/react/css/normalize.css';
import '@ionic/react/css/structure.css';
import '@ionic/react/css/typography.css';

/* Optional CSS utils that can be commented out */
import '@ionic/react/css/padding.css';
import '@ionic/react/css/float-elements.css';
import '@ionic/react/css/text-alignment.css';
import '@ionic/react/css/text-transformation.css';
import '@ionic/react/css/flex-utils.css';
import '@ionic/react/css/display.css';

/* import '@ionic/react/css/palettes/dark.always.css'; */
/* import '@ionic/react/css/palettes/dark.class.css'; */
import '@ionic/react/css/palettes/dark.system.css';

/* Theme variables */
import './theme/variables.css';

setupIonicReact();

type LaunchStep = 'disclaimer' | 'permission' | 'menu';

const DISCLAIMER_KEY = 'holdout_disclaimer_accepted';

const App: React.FC = () => {
  const isOnline = useOnlineStatusProvider();
  const lives    = useLivesProvider();

  // null = still reading storage (native splash is visible)
  const [step, setStep] = useState<LaunchStep | null>(null);

  useEffect(() => {
    const MIN_SPLASH_MS = 3500;
    Promise.all([
      getStorage().then(s => s.get(DISCLAIMER_KEY)),
      new Promise<void>(r => setTimeout(r, MIN_SPLASH_MS)),
    ]).then(([val]) => {
      setStep(val === true ? 'permission' : 'disclaimer');
      SplashScreen.hide({ fadeOutDuration: 300 });
    });
  }, []);

  const handleDisclaimerContinue = useCallback(async () => {
    const s = await getStorage();
    await s.set(DISCLAIMER_KEY, true);
    setStep('permission');
  }, []);

  const handlePermissionGranted = useCallback(() => {
    setStep('menu');
  }, []);

  // Still reading storage — native splash is showing, render nothing
  if (step === null) return null;

  if (step === 'disclaimer') {
    return <DisclaimerScreen onContinue={handleDisclaimerContinue} />;
  }

  if (step === 'permission') {
    return <PermissionGate onGranted={handlePermissionGranted} />;
  }

  // step === 'menu'
  return (
    <OnlineStatusContext.Provider value={isOnline}>
    <LivesContext.Provider value={lives}>
      <IonApp>
        <IonReactRouter>
          <IonRouterOutlet>
            <Route exact path="/home">
              <Home />
            </Route>
            <Route exact path="/">
              <Redirect to="/home" />
            </Route>
          </IonRouterOutlet>
        </IonReactRouter>
      </IonApp>
    </LivesContext.Provider>
    </OnlineStatusContext.Provider>
  );
};

export default App;
