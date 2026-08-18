import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { hasPin } from './storage';

interface LockState {
  isLocked: boolean;
  hasPin: boolean;
  unlock: () => void;
  lock: () => void;
  refreshPinStatus: () => void;
}

const LockContext = createContext<LockState | null>(null);

export function LockProvider({ children }: { children: ReactNode }) {
  const [isLocked, setIsLocked] = useState(true);
  const [pinExists, setPinExists] = useState(false);

  const refreshPinStatus = () => setPinExists(hasPin());

  useEffect(() => {
    refreshPinStatus();
    if (!hasPin()) {
      setIsLocked(false);
    }
  }, []);

  const unlock = () => setIsLocked(false);
  const lock = () => {
    if (hasPin()) setIsLocked(true);
  };

  return (
    <LockContext.Provider value={{ isLocked, hasPin: pinExists, unlock, lock, refreshPinStatus }}>
      {children}
    </LockContext.Provider>
  );
}

export function useLock() {
  const ctx = useContext(LockContext);
  if (!ctx) throw new Error('useLock must be used within LockProvider');
  return ctx;
}
