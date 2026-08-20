import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Easing, Platform } from 'react-native';
import { useFonts } from 'expo-font';
import { Inter_400Regular, Inter_700Bold } from '@expo-google-fonts/inter';
import { Delete, Fingerprint, Lock } from 'lucide-react-native';
import { colors, spacing, radius, typography } from '@/lib/theme';
import { hasPin, setPin, verifyPin, isLockedOut, getLockoutMsRemaining, recordFailedAttempt, resetAttempts } from '@/lib/storage';
import { useLock } from '@/lib/lock-context';
import { formatDuration } from '@/lib/format';

type Mode = 'unlock' | 'create' | 'confirm';

export default function LockScreen() {
  const [fontsLoaded] = useFonts({ 'Inter-Regular': Inter_400Regular, 'Inter-Bold': Inter_700Bold });
  const { unlock, refreshPinStatus, biometricEnabled, authenticateWithBiometrics } = useLock();
  const [pin, setPinState] = useState('');
  const [mode, setMode] = useState<Mode>(() => (hasPin() ? 'unlock' : 'create'));
  const [firstPin, setFirstPin] = useState('');
  const [error, setError] = useState('');
  const [shakeAnim] = useState(new Animated.Value(0));
  const [lockoutMs, setLockoutMs] = useState(0);

  useEffect(() => {
    if (mode !== 'unlock') return;
    if (!isLockedOut()) return;
    const update = () => {
      const remaining = getLockoutMsRemaining();
      setLockoutMs(remaining);
      if (remaining <= 0) {
        setLockoutMs(0);
        return;
      }
      setTimeout(update, 1000);
    };
    update();
  }, [mode]);

  if (!fontsLoaded) return null;

  const triggerShake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, easing: Easing.linear, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, easing: Easing.linear, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 6, duration: 50, easing: Easing.linear, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, easing: Easing.linear, useNativeDriver: true }),
    ]).start();
  };

  const handleComplete = async (finalPin: string) => {
    if (mode === 'unlock') {
      if (isLockedOut()) {
        setError('Too many attempts. Try again later.');
        setPinState('');
        return;
      }
      const valid = await verifyPin(finalPin);
      if (valid) {
        resetAttempts();
        unlock();
      } else {
        recordFailedAttempt();
        const remaining = getLockoutMsRemaining();
        if (remaining > 0) {
          setError(`Too many attempts. Locked for ${formatDuration(remaining)}.`);
          setLockoutMs(remaining);
        } else {
          setError('Incorrect PIN');
        }
        triggerShake();
        setPinState('');
      }
    } else if (mode === 'create') {
      setFirstPin(finalPin);
      setMode('confirm');
      setPinState('');
      setError('');
    } else if (mode === 'confirm') {
      if (finalPin === firstPin) {
        await setPin(finalPin);
        refreshPinStatus();
        unlock();
      } else {
        setError('PINs do not match');
        triggerShake();
        setMode('create');
        setFirstPin('');
        setPinState('');
      }
    }
  };

  const pressDigit = (d: string) => {
    if (lockoutMs > 0) return;
    if (pin.length >= 4) return;
    const newPin = pin + d;
    setPinState(newPin);
    setError('');
    if (newPin.length === 4) {
      setTimeout(() => handleComplete(newPin), 150);
    }
  };

  const pressDelete = () => {
    setPinState(pin.slice(0, -1));
    setError('');
  };

  const handleBiometricUnlock = () => {
    authenticateWithBiometrics().catch(() => setError('Biometric unlock is unavailable.'));
  };

  const title =
    mode === 'unlock' ? 'Enter PIN' :
    mode === 'create' ? 'Create PIN' :
    'Confirm PIN';

  const subtitle =
    mode === 'create' ? 'Choose a 4-digit PIN to lock your memos' :
    mode === 'confirm' ? 'Re-enter your PIN to confirm' :
    mode === 'unlock' ? 'Enter your PIN to unlock' : '';

  const keypadDisabled = lockoutMs > 0;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.lockIconWrap}>
          <Lock color={colors.primary} size={28} strokeWidth={2} />
        </View>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>

      <Animated.View style={[styles.dotsWrap, { transform: [{ translateX: shakeAnim }] }]}>
        {[0, 1, 2, 3].map((i) => (
          <View
            key={i}
            style={[styles.dot, pin.length > i && styles.dotFilled, error ? styles.dotError : null]}
          />
        ))}
      </Animated.View>

      {error ? <Text style={styles.error}>{error}</Text> : <View style={{ height: 20 }} />}

      <View style={styles.keypad}>
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <TouchableOpacity
            key={d}
            style={[styles.key, keypadDisabled && styles.keyDisabled]}
            onPress={() => pressDigit(d)}
            activeOpacity={0.5}
            disabled={keypadDisabled}
          >
            <Text style={styles.keyText}>{d}</Text>
          </TouchableOpacity>
        ))}
        <View style={styles.keyPlaceholder} />
        <TouchableOpacity
          style={[styles.key, keypadDisabled && styles.keyDisabled]}
          onPress={() => pressDigit('0')}
          activeOpacity={0.5}
          disabled={keypadDisabled}
        >
          <Text style={styles.keyText}>0</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.key, keypadDisabled && styles.keyDisabled]}
          onPress={pressDelete}
          activeOpacity={0.5}
          disabled={keypadDisabled}
        >
          <Delete color={keypadDisabled ? colors.textMuted : colors.text} size={26} strokeWidth={2} />
        </TouchableOpacity>
      </View>
      {mode === 'unlock' && biometricEnabled && Platform.OS !== 'web' ? (
        <TouchableOpacity style={styles.biometricBtn} onPress={handleBiometricUnlock} activeOpacity={0.7}>
          <Fingerprint size={22} color={colors.primary} strokeWidth={2} />
          <Text style={styles.biometricText}>Unlock with biometrics</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxl,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  lockIconWrap: {
    width: 56,
    height: 56,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: {
    ...typography.h1,
    color: colors.text,
  },
  subtitle: {
    ...typography.bodySm,
    color: colors.textDim,
    marginTop: spacing.xs,
  },
  dotsWrap: {
    flexDirection: 'row',
    gap: spacing.md,
    marginVertical: spacing.lg,
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: radius.full,
    borderWidth: 2,
    borderColor: colors.border,
  },
  dotFilled: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  dotError: {
    borderColor: colors.error,
  },
  error: {
    ...typography.bodySm,
    color: colors.error,
    height: 20,
    textAlign: 'center',
  },
  keypad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  key: {
    width: '28%',
    maxWidth: 76,
    aspectRatio: 1,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  keyDisabled: {
    opacity: 0.4,
  },
  keyText: {
    ...typography.h1,
    color: colors.text,
  },
  biometricBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
    padding: spacing.sm,
  },
  biometricText: {
    ...typography.bodySm,
    color: colors.primary,
    fontFamily: 'Inter-Bold',
  },
  keyPlaceholder: {
    width: '28%',
    maxWidth: 76,
    aspectRatio: 1,
  },
});
