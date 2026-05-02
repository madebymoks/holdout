import { useState, useEffect, createContext, useContext } from 'react';

export const OnlineStatusContext = createContext<boolean>(true);

export function useOnlineStatus(): boolean {
  return useContext(OnlineStatusContext);
}

export function useOnlineStatusProvider(): boolean {
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    const on  = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener('online',  on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online',  on);
      window.removeEventListener('offline', off);
    };
  }, []);

  return isOnline;
}
