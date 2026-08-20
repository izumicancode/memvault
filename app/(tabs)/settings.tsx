import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch, Modal, Platform, useWindowDimensions, AppState, ScrollView } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { Lock, Unlock, Shield, Info, Fingerprint, Trash2, Palette } from 'lucide-react-native';
import { colors, spacing, radius, typography, accentThemes, AccentTheme } from '@/lib/theme';
import { hasPin, setPin, clearPin, setBiometricEnabled } from '@/lib/storage';
// setPin is now async (hashes the PIN before storage)
import { useLock } from '@/lib/lock-context';
import { useTheme } from '@/lib/theme-context';

export default function SettingsScreen() {
  const { lock, refreshPinStatus, hasPin: pinExists, biometricEnabled } = useLock();
  const { accentTheme, selectAccentTheme } = useTheme();
  const [lockEnabled, setLockEnabled] = useState(hasPin());
  const [showPinSetup, setShowPinSetup] = useState(false);
  const [pinStep, setPinStep] = useState<'create' | 'confirm'>('create');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState('');
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const { width } = useWindowDimensions();
  const horizontalPadding = Math.min(spacing.lg, Math.max(spacing.md, width * 0.06));

  useEffect(() => {
    if (Platform.OS === 'web') return;
    const checkBiometricAvailability = async () => {
      try {
        const [hardware, enrolled] = await Promise.all([
          LocalAuthentication.hasHardwareAsync(),
          LocalAuthentication.isEnrolledAsync(),
        ]);
        setBiometricAvailable(hardware && enrolled);
      } catch {
        setBiometricAvailable(false);
      }
    };

    checkBiometricAvailability();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') checkBiometricAvailability();
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    setLockEnabled(pinExists);
  }, [pinExists]);

  const toggleLock = (value: boolean) => {
    if (value) {
      // Start PIN creation flow
      setPinStep('create');
      setNewPin('');
      setConfirmPin('');
      setError('');
      setShowPinSetup(true);
    } else {
      // Remove PIN
      clearPin();
      setLockEnabled(false);
      refreshPinStatus();
    }
  };

  const handlePinDigit = (d: string) => {
    setError('');
    if (pinStep === 'create') {
      if (newPin.length >= 4) return;
      const next = newPin + d;
      setNewPin(next);
      if (next.length === 4) {
        setPinStep('confirm');
      }
    } else {
      if (confirmPin.length >= 4) return;
      const next = confirmPin + d;
      setConfirmPin(next);
      if (next.length === 4) {
        setTimeout(async () => {
          if (next === newPin) {
            await setPin(next);
            setLockEnabled(true);
            refreshPinStatus();
            setShowPinSetup(false);
            setNewPin('');
            setConfirmPin('');
          } else {
            setError('PINs do not match');
            setPinStep('create');
            setNewPin('');
            setConfirmPin('');
          }
        }, 150);
      }
    }
  };

  const handlePinDelete = () => {
    setError('');
    if (pinStep === 'create') {
      setNewPin(newPin.slice(0, -1));
    } else {
      setConfirmPin(confirmPin.slice(0, -1));
    }
  };

  const closePinSetup = () => {
    setShowPinSetup(false);
    setNewPin('');
    setConfirmPin('');
    setError('');
  };

  const currentPin = pinStep === 'create' ? newPin : confirmPin;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingHorizontal: horizontalPadding }]}
      contentInsetAdjustmentBehavior="automatic"
    >
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Security</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <View style={[styles.rowIcon, { backgroundColor: 'rgba(59,130,246,0.12)' }]}>
                {lockEnabled ? <Lock size={20} color={colors.primary} strokeWidth={2} /> : <Unlock size={20} color={colors.textMuted} strokeWidth={2} />}
              </View>
              <View>
                <Text style={styles.rowTitle}>App Lock</Text>
                <Text style={styles.rowDesc}>Require a PIN to open the app</Text>
              </View>
            </View>
            <Switch
              value={lockEnabled}
              onValueChange={toggleLock}
              accessibilityRole="switch"
              accessibilityLabel="App Lock"
              accessibilityState={{ checked: lockEnabled }}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={colors.text}
            />
          </View>
          {lockEnabled && (
            <TouchableOpacity style={styles.lockNowBtn} onPress={lock} activeOpacity={0.7}>
              <Lock size={16} color={colors.primary} strokeWidth={2} />
              <Text style={styles.lockNowText}>Lock Now</Text>
            </TouchableOpacity>
          )}
          {Platform.OS !== 'web' && (
            <View style={styles.row}>
              <View style={styles.rowLeft}>
                <View style={[styles.rowIcon, { backgroundColor: 'rgba(139,92,246,0.12)' }]}>
                  <Fingerprint size={20} color="#A78BFA" strokeWidth={2} />
                </View>
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle}>Fingerprint / Face Unlock</Text>
                  <Text style={styles.rowDesc}>
                    {!lockEnabled
                      ? 'Enable App Lock first to use biometrics'
                      : biometricAvailable
                        ? 'Use fingerprint or face recognition'
                        : 'Set up fingerprint or face unlock in phone settings'}
                  </Text>
                </View>
              </View>
              <Switch
                value={biometricEnabled}
                disabled={!biometricAvailable || !lockEnabled}
                accessibilityRole="switch"
                accessibilityLabel="Fingerprint or Face Unlock"
                accessibilityState={{ checked: biometricEnabled, disabled: !biometricAvailable || !lockEnabled }}
                onValueChange={async (value) => {
                  if (!value) {
                    setBiometricEnabled(false);
                    refreshPinStatus();
                    return;
                  }
                  try {
                    const result = await LocalAuthentication.authenticateAsync({
                      promptMessage: 'Confirm fingerprint unlock for Memo Vault',
                      cancelLabel: 'Cancel',
                      disableDeviceFallback: true,
                    });
                    if (result.success) {
                      setBiometricEnabled(true);
                      refreshPinStatus();
                    }
                  } catch {
                    setBiometricEnabled(false);
                    refreshPinStatus();
                  }
                }}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor={colors.text}
              />
            </View>
          )}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Appearance</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <View style={[styles.rowIcon, { backgroundColor: 'rgba(245,158,11,0.12)' }]}>
                <Palette size={20} color={colors.warning} strokeWidth={2} />
              </View>
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>Accent color</Text>
                <Text style={styles.rowDesc}>Personalize buttons and highlights</Text>
              </View>
            </View>
          </View>
          <View style={styles.themeChoices}>
            {(Object.keys(accentThemes) as AccentTheme[]).map((theme) => (
              <TouchableOpacity
                key={theme}
                accessibilityLabel={`${theme} accent theme`}
                style={[styles.themeChoice, accentTheme === theme && styles.themeChoiceSelected]}
                onPress={() => selectAccentTheme(theme)}
                activeOpacity={0.7}
              >
                <View style={[styles.themeSwatch, { backgroundColor: accentThemes[theme].primary }]} />
                <Text style={[styles.themeLabel, accentTheme === theme && styles.themeLabelSelected]}>
                  {theme[0].toUpperCase() + theme.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>About</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <View style={[styles.rowIcon, { backgroundColor: 'rgba(16,185,129,0.12)' }]}>
                <Shield size={20} color={colors.accent} strokeWidth={2} />
              </View>
              <View>
                <Text style={styles.rowTitle}>Privacy</Text>
                <Text style={styles.rowDesc}>Memos are stored locally on this device</Text>
              </View>
            </View>
          </View>
          <View style={styles.divider} />
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <View style={[styles.rowIcon, { backgroundColor: 'rgba(156,163,175,0.12)' }]}>
                <Info size={20} color={colors.textDim} strokeWidth={2} />
              </View>
              <View>
                <Text style={styles.rowTitle}>Memo Vault</Text>
                <Text style={styles.rowDesc}>Version 1.0.0</Text>
              </View>
            </View>
          </View>
        </View>
      </View>

      {/* PIN Setup Modal */}
      <Modal visible={showPinSetup} transparent animationType="fade" onRequestClose={closePinSetup}>
        <View style={styles.pinModal}>
          <View style={styles.pinModalContent}>
            <Text style={styles.pinModalTitle}>
              {pinStep === 'create' ? 'Create PIN' : 'Confirm PIN'}
            </Text>
            <Text style={styles.pinModalSubtitle}>
              {pinStep === 'create' ? 'Choose a 4-digit PIN' : 'Re-enter to confirm'}
            </Text>
            <View style={styles.pinDots}>
              {[0, 1, 2, 3].map((i) => (
                <View
                  key={i}
                  style={[styles.pinDot, currentPin.length > i && styles.pinDotFilled, error ? styles.pinDotError : null]}
                />
              ))}
            </View>
            {error ? <Text style={styles.pinError}>{error}</Text> : <View style={{ height: 20 }} />}
            <View style={styles.pinKeypad}>
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
                <TouchableOpacity key={d} style={styles.pinKey} onPress={() => handlePinDigit(d)} activeOpacity={0.5}>
                  <Text style={styles.pinKeyText}>{d}</Text>
                </TouchableOpacity>
              ))}
              <View style={styles.pinKeyPlaceholder} />
              <TouchableOpacity style={styles.pinKey} onPress={() => handlePinDigit('0')} activeOpacity={0.5}>
                <Text style={styles.pinKeyText}>0</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.pinKey} onPress={handlePinDelete} activeOpacity={0.5}>
                <Trash2 size={22} color={colors.text} strokeWidth={2} />
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.pinCancel} onPress={closePinSetup}>
              <Text style={styles.pinCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xxl,
  },
  header: {
    marginBottom: spacing.xl,
  },
  title: {
    ...typography.title,
    color: colors.text,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    ...typography.caption,
    color: colors.textMuted,
    fontFamily: 'Inter-Bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
  },
  rowText: {
    flex: 1,
  },
  themeChoices: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  themeChoice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  themeChoiceSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.surfaceAlt,
  },
  themeSwatch: {
    width: 14,
    height: 14,
    borderRadius: radius.full,
  },
  themeLabel: {
    ...typography.caption,
    color: colors.textDim,
  },
  themeLabelSelected: {
    color: colors.text,
    fontFamily: 'Inter-Bold',
  },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTitle: {
    ...typography.body,
    color: colors.text,
  },
  rowDesc: {
    ...typography.caption,
    color: colors.textMuted,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginLeft: 56,
  },
  lockNowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    backgroundColor: 'rgba(59,130,246,0.08)',
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  lockNowText: {
    ...typography.bodySm,
    color: colors.primary,
    fontFamily: 'Inter-Bold',
  },
  pinModal: {
    flex: 1,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  pinModalContent: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xl,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
  },
  pinModalTitle: {
    ...typography.h1,
    color: colors.text,
  },
  pinModalSubtitle: {
    ...typography.bodySm,
    color: colors.textDim,
    marginTop: spacing.xs,
  },
  pinDots: {
    flexDirection: 'row',
    gap: spacing.md,
    marginVertical: spacing.lg,
  },
  pinDot: {
    width: 14,
    height: 14,
    borderRadius: radius.full,
    borderWidth: 2,
    borderColor: colors.border,
  },
  pinDotFilled: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  pinDotError: {
    borderColor: colors.error,
  },
  pinError: {
    ...typography.bodySm,
    color: colors.error,
    height: 20,
  },
  pinKeypad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  pinKey: {
    width: '28%',
    maxWidth: 68,
    aspectRatio: 1,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  pinKeyText: {
    ...typography.h2,
    color: colors.text,
  },
  pinKeyPlaceholder: {
    width: '28%',
    maxWidth: 68,
    aspectRatio: 1,
  },
  pinCancel: {
    marginTop: spacing.lg,
    paddingVertical: spacing.sm,
  },
  pinCancelText: {
    ...typography.bodySm,
    color: colors.textDim,
  },
});
