import { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, useWindowDimensions } from 'react-native';
import { Audio } from 'expo-av';
import { Mic, Video, Square, AudioLines, Camera, Plus } from 'lucide-react-native';
import { colors, spacing, radius, typography } from '@/lib/theme';
import { saveMemo, MAX_FILE_SIZE_BYTES } from '@/lib/storage';
import { formatDuration } from '@/lib/format';
import type { MemoType } from '@/lib/types';

type RecordingState = 'idle' | 'recording' | 'saving';

export default function RecordScreen() {
  const [mode, setMode] = useState<MemoType>('audio');
  const [state, setState] = useState<RecordingState>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState('');
  const [showAddMenu, setShowAddMenu] = useState(false);
  const { width } = useWindowDimensions();
  const horizontalPadding = Math.min(spacing.lg, Math.max(spacing.md, width * 0.06));

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const nativeRecordingRef = useRef<Audio.Recording | null>(null);

  useEffect(() => {
    return () => {
      stopTimer();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  // Start camera preview when video mode is selected (even before recording)
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (mode === 'video' && state === 'idle' && !streamRef.current) {
      navigator.mediaDevices
        .getUserMedia({ video: { facingMode: 'user' }, audio: false })
        .then((stream) => {
          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.play().catch(() => {});
          }
        })
        .catch(() => {
          // Camera not available, will show placeholder
        });
    }
    // When switching away from video or starting recording, the stream will be handled elsewhere
  }, [mode, state]);

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const startTimer = () => {
    setElapsed(0);
    timerRef.current = setInterval(() => {
      setElapsed((e) => e + 100);
    }, 100);
  };

  const stopPreviewStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const startRecording = async () => {
    setError('');
    if (Platform.OS !== 'web') {
      if (mode === 'video') {
        setError('Video recording is available in the web preview.');
        return;
      }
      try {
        const permission = await Audio.requestPermissionsAsync();
        if (!permission.granted) {
          setError('Microphone permission is required to record.');
          return;
        }
        await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
        const recording = new Audio.Recording();
        await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
        await recording.startAsync();
        nativeRecordingRef.current = recording;
        setState('recording');
        startTimer();
      } catch {
        setError('Could not start recording. Check microphone permissions.');
      }
      return;
    }
    try {
      // Stop preview stream first, we need audio+video
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }

      const constraints: MediaStreamConstraints =
        mode === 'audio'
          ? { audio: true, video: false }
          : { audio: true, video: { facingMode: 'user' } };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (mode === 'video' && videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }

      const mimeType = mode === 'audio'
        ? MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : ''
        : MediaRecorder.isTypeSupported('video/webm') ? 'video/webm' : '';

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: mimeType || (mode === 'audio' ? 'audio/webm' : 'video/webm') });
        const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const title = `${mode === 'audio' ? 'Voice' : 'Video'} Memo ${new Date().toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`;

        const memo = {
          id,
          type: mode,
          title,
          blob,
          mimeType: blob.type,
          durationMs: elapsed,
          createdAt: Date.now(),
          size: blob.size,
        };

        try {
          console.log('[memVault] Saving memo:', { id, type: mode, size: blob.size, durationMs: elapsed });
          await saveMemo(memo);
          console.log('[memVault] Memo saved successfully');
        } catch (error) {
          console.error('[memVault] Failed to save memo:', error);
          setError(`Failed to save memo: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }

        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop());
          streamRef.current = null;
        }
        setState('idle');
        setElapsed(0);

        // Restart preview if in video mode
        if (mode === 'video') {
          navigator.mediaDevices
            .getUserMedia({ video: { facingMode: 'user' }, audio: false })
            .then((s) => {
              streamRef.current = s;
              if (videoRef.current) {
                videoRef.current.srcObject = s;
                videoRef.current.play().catch(() => {});
              }
            })
            .catch(() => {});
        }
      };

      recorder.start(100);
      mediaRecorderRef.current = recorder;
      setState('recording');
      startTimer();
    } catch {
      setError('Could not access microphone/camera. Check permissions.');
    }
  };

  const stopRecording = () => {
    stopTimer();
    if (Platform.OS !== 'web') {
      const recording = nativeRecordingRef.current;
      if (!recording) return;
      setState('saving');
      void (async () => {
        try {
          await recording.stopAndUnloadAsync();
          const uri = recording.getURI();
          if (!uri) throw new Error('Recording file unavailable');
          const blob = await (await fetch(uri)).blob();
          const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
          await saveMemo({
            id,
            type: 'audio',
            title: `Voice Memo ${new Date().toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`,
            blob,
            mimeType: blob.type || 'audio/mp4',
            durationMs: elapsed,
            createdAt: Date.now(),
            size: blob.size,
          });
          setError('');
        } catch {
          setError('Could not save the recording. Please try again.');
        } finally {
          nativeRecordingRef.current = null;
          setState('idle');
          setElapsed(0);
          await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
        }
      })();
      return;
    }
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      setState('saving');
      recorder.stop();
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const switchMode = (newMode: MemoType) => {
    if (state !== 'idle') return;
    // Stop preview when switching to audio
    if (newMode === 'audio' && streamRef.current) {
      stopPreviewStream();
    }
    setMode(newMode);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const isVideo = file.type.startsWith('video/');
    const isAudio = file.type.startsWith('audio/');
    if (!isVideo && !isAudio) {
      setError('Please select an audio or video file.');
      return;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setError(`File is too large. Maximum size is ${Math.round(MAX_FILE_SIZE_BYTES / (1024 * 1024))} MB.`);
      return;
    }

    const memoType: MemoType = isVideo ? 'video' : 'audio';
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const title = file.name.replace(/\.[^/.]+$/, '');

    // Get duration for audio/video files
    const url = URL.createObjectURL(file);
    const mediaEl = isVideo ? document.createElement('video') : document.createElement('audio');
    mediaEl.preload = 'metadata';
    mediaEl.src = url;

    mediaEl.onloadedmetadata = async () => {
      const durationMs = isFinite(mediaEl.duration) ? mediaEl.duration * 1000 : 0;
      URL.revokeObjectURL(url);

      const memo = {
        id,
        type: memoType,
        title,
        blob: file,
        mimeType: file.type,
        durationMs,
        createdAt: Date.now(),
        size: file.size,
      };

      try {
        console.log('[memVault] Saving uploaded file:', { id, type: memoType, size: file.size, durationMs });
        await saveMemo(memo);
        console.log('[memVault] File saved successfully');
        setShowAddMenu(false);
        setError('');
      } catch (error) {
        console.error('[memVault] Failed to save file:', error);
        setError(`Failed to save file: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    };

    mediaEl.onerror = async () => {
      URL.revokeObjectURL(url);
      // Save without duration if we can't read metadata
      const memo = {
        id,
        type: memoType,
        title,
        blob: file,
        mimeType: file.type,
        durationMs: 0,
        createdAt: Date.now(),
        size: file.size,
      };

      try {
        await saveMemo(memo);
        setShowAddMenu(false);
        setError('');
      } catch {
        setError('Failed to save file.');
      }
    };
  };

  const openFilePicker = (type: 'audio' | 'video') => {
    setShowAddMenu(false);
    if (fileInputRef.current) {
      fileInputRef.current.accept = type === 'video' ? 'video/*' : 'audio/*';
      fileInputRef.current.click();
    }
  };

  const isWeb = Platform.OS === 'web';

  return (
    <View style={[styles.container, { paddingHorizontal: horizontalPadding }]}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>Record</Text>
            <Text style={styles.subtitle}>Capture a voice or video memo</Text>
          </View>
          {isWeb && (
            <TouchableOpacity style={styles.addBtn} onPress={() => setShowAddMenu(true)} activeOpacity={0.7}>
              <Plus size={20} color={colors.text} strokeWidth={2} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {!isWeb && (
        <View style={styles.notice}>
          <Text style={styles.noticeText}>Audio recording is ready on this device. Video recording is available in the web preview.</Text>
        </View>
      )}

      {isWeb && (
        <>
          <View style={styles.modeSwitch}>
            <TouchableOpacity
              style={[styles.modeBtn, mode === 'audio' && styles.modeBtnActive]}
              onPress={() => switchMode('audio')}
              disabled={state !== 'idle'}
            >
              <Mic size={18} color={mode === 'audio' ? colors.text : colors.textDim} strokeWidth={2} />
              <Text style={[styles.modeBtnText, mode === 'audio' && styles.modeBtnTextActive]}>Voice</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeBtn, mode === 'video' && styles.modeBtnActive]}
              onPress={() => switchMode('video')}
              disabled={state !== 'idle'}
            >
              <Video size={18} color={mode === 'video' ? colors.text : colors.textDim} strokeWidth={2} />
              <Text style={[styles.modeBtnText, mode === 'video' && styles.modeBtnTextActive]}>Video</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.previewArea}>
            {mode === 'video' && (
              <video
                ref={videoRef}
                muted
                playsInline
                style={{
                  width: '100%',
                  height: '100%',
                  borderRadius: 16,
                  objectFit: 'cover',
                  display: state === 'idle' || state === 'recording' || state === 'saving' ? 'block' : 'none',
                }}
              />
            )}
            {state === 'idle' && mode === 'audio' && (
              <View style={styles.previewPlaceholder}>
                <AudioLines size={64} color={colors.textMuted} strokeWidth={1.5} />
                <Text style={styles.previewText}>Ready to record voice</Text>
              </View>
            )}
            {state === 'idle' && mode === 'video' && (
              <View style={styles.previewPlaceholder} pointerEvents="none">
                <Camera size={64} color={colors.textMuted} strokeWidth={1.5} />
                <Text style={styles.previewText}>Camera preview</Text>
              </View>
            )}
            {state === 'recording' && (
              <View style={styles.recordingBadge} pointerEvents="none">
                <View style={styles.recDot} />
                <Text style={styles.recText}>REC {formatDuration(elapsed)}</Text>
              </View>
            )}
            {state === 'saving' && (
              <View style={styles.previewPlaceholder}>
                <Text style={styles.previewText}>Saving...</Text>
              </View>
            )}
          </View>

          {state === 'recording' && (
            <Text style={styles.timer}>{formatDuration(elapsed)}</Text>
          )}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={styles.controls}>
            {state === 'idle' ? (
              <TouchableOpacity style={styles.recordBtn} onPress={startRecording} activeOpacity={0.7}>
                <View style={styles.recordBtnInner} />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.stopBtn} onPress={stopRecording} activeOpacity={0.7}>
                <Square color={colors.text} size={28} strokeWidth={2} fill={colors.text} />
              </TouchableOpacity>
            )}
          </View>

          {/* Hidden file input for uploads */}
          <input
            ref={fileInputRef}
            type="file"
            style={{ display: 'none' }}
            onChange={handleFileUpload}
          />

          {/* Add menu modal */}
          {showAddMenu && (
            <TouchableOpacity style={styles.menuOverlay} onPress={() => setShowAddMenu(false)} activeOpacity={1}>
              <View style={styles.menuSheet}>
                <View style={styles.menuHandle} />
                <Text style={styles.menuTitle}>Add from file</Text>
                <TouchableOpacity style={styles.menuItem} onPress={() => openFilePicker('audio')} activeOpacity={0.7}>
                  <View style={[styles.menuIcon, { backgroundColor: 'rgba(59,130,246,0.12)' }]}>
                    <Mic size={20} color={colors.primary} strokeWidth={2} />
                  </View>
                  <View>
                    <Text style={styles.menuItemTitle}>Audio file</Text>
                    <Text style={styles.menuItemDesc}>Upload an existing audio recording</Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity style={styles.menuItem} onPress={() => openFilePicker('video')} activeOpacity={0.7}>
                  <View style={[styles.menuIcon, { backgroundColor: 'rgba(16,185,129,0.12)' }]}>
                    <Video size={20} color={colors.accent} strokeWidth={2} />
                  </View>
                  <View>
                    <Text style={styles.menuItemTitle}>Video file</Text>
                    <Text style={styles.menuItemDesc}>Upload an existing video clip</Text>
                  </View>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl,
  },
  header: {
    marginBottom: spacing.xl,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    ...typography.title,
    color: colors.text,
  },
  subtitle: {
    ...typography.bodySm,
    color: colors.textDim,
    marginTop: spacing.xs,
  },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  notice: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.lg,
  },
  noticeText: {
    ...typography.bodySm,
    color: colors.textDim,
  },
  modeSwitch: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 4,
    marginBottom: spacing.md,
  },
  modeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.md,
  },
  modeBtnActive: {
    backgroundColor: colors.surfaceAlt,
  },
  modeBtnText: {
    ...typography.bodySm,
    color: colors.textDim,
    fontFamily: 'Inter-Bold',
  },
  modeBtnTextActive: {
    color: colors.text,
  },
  previewArea: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    marginBottom: spacing.md,
    overflow: 'hidden',
    position: 'relative',
    minHeight: 200,
  },
  previewPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  previewText: {
    ...typography.bodySm,
    color: colors.textMuted,
  },
  recordingBadge: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.full,
  },
  recDot: {
    width: 8,
    height: 8,
    borderRadius: radius.full,
    backgroundColor: colors.error,
  },
  recText: {
    ...typography.caption,
    color: colors.text,
    fontFamily: 'Inter-Bold',
  },
  timer: {
    ...typography.mono,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  error: {
    ...typography.bodySm,
    color: colors.error,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  controls: {
    alignItems: 'center',
    paddingBottom: spacing.xl,
  },
  recordBtn: {
    width: 72,
    height: 72,
    borderRadius: radius.full,
    backgroundColor: colors.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordBtnInner: {
    width: 28,
    height: 28,
    borderRadius: radius.full,
    backgroundColor: colors.text,
  },
  stopBtn: {
    width: 72,
    height: 72,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.border,
  },
  menuOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  menuSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  menuHandle: {
    width: 40,
    height: 4,
    borderRadius: radius.full,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: spacing.lg,
  },
  menuTitle: {
    ...typography.h2,
    color: colors.text,
    marginBottom: spacing.lg,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  menuIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuItemTitle: {
    ...typography.body,
    color: colors.text,
  },
  menuItemDesc: {
    ...typography.caption,
    color: colors.textMuted,
  },
});
