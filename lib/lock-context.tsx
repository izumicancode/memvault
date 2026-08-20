import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Platform, AppState } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { hasPin, isBiometricEnabled } from './storage';

interface LockState {
  isLocked: boolean;
  hasPin: boolean;
  unlock: () => void;
  lock: () => void;
  refreshPinStatus: () => void;
  biometricEnabled: boolean;
  authenticateWithBiometrics: () => Promise<boolean>;
}

const LockContext = createContext<LockState | null>(null);

export function LockProvider({ children }: { children: ReactNode }) {
  const [isLocked, setIsLocked] = useState(true);
  const [pinExists, setPinExists] = useState(false);
  const [biometricEnabled, setBiometricEnabledState] = useState(false);

  const refreshPinStatus = () => {
    setPinExists(hasPin());
    setBiometricEnabledState(isBiometricEnabled());
  };

  const authenticateWithBiometrics = async () => {
    if (Platform.OS === 'web' || !hasPin() || !isBiometricEnabled()) return false;
    const available = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    if (!available || !enrolled) return false;
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Unlock Memo Vault',
      cancelLabel: 'Use PIN',
      disableDeviceFallback: true,
    });
    if (result.success) setIsLocked(false);
    return result.success;
  };

  useEffect(() => {
    refreshPinStatus();
    if (!hasPin()) {
      setIsLocked(false);
    }
    if (hasPin() && isBiometricEnabled()) {
      authenticateWithBiometrics().catch(() => {});
    }
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active' && hasPin()) setIsLocked(true);
    });
    return () => subscription.remove();
  }, []);

  const unlock = () => setIsLocked(false);
  const lock = () => {
    if (hasPin()) setIsLocked(true);
  };

  return (
    <LockContext.Provider value={{ isLocked, hasPin: pinExists, unlock, lock, refreshPinStatus, biometricEnabled, authenticateWithBiometrics }}>
      {children}
    </LockContext.Provider>
  );
}

export function useLock() {
  const ctx = useContext(LockContext);
  if (!ctx) throw new Error('useLock must be used within LockProvider');
  return ctx;
}
