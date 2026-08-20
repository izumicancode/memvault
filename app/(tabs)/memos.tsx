import { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, RefreshControl, Modal, Platform, useWindowDimensions, TextInput } from 'react-native';
import { Mic, Video, Trash2, Play, Pause, X, FolderOpen, Search, MoreVertical, Pencil } from 'lucide-react-native';
import { colors, spacing, radius, typography } from '@/lib/theme';
import { listMemos, deleteMemo, getMemo, renameMemo } from '@/lib/storage';
import { formatDuration, formatDate, formatSize } from '@/lib/format';
import type { MemoMeta } from '@/lib/types';

export default function MemosScreen() {
  const [memos, setMemos] = useState<MemoMeta[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [playingUrl, setPlayingUrl] = useState<string | null>(null);
  const [playingType, setPlayingType] = useState<'audio' | 'video'>('audio');
  const [isPaused, setIsPaused] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'audio' | 'video'>('all');
  const [sortMode, setSortMode] = useState<'newest' | 'oldest' | 'largest'>('newest');
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameTitle, setRenameTitle] = useState('');
  const { width } = useWindowDimensions();
  const horizontalPadding = Math.min(spacing.lg, Math.max(spacing.md, width * 0.06));
  const filteredMemos = memos.filter((memo) => {
    const matchesQuery = memo.title.toLowerCase().includes(query.trim().toLowerCase());
    return matchesQuery && (filterType === 'all' || memo.type === filterType);
  }).sort((a, b) => {
    if (sortMode === 'oldest') return a.createdAt - b.createdAt;
    if (sortMode === 'largest') return b.size - a.size;
    return b.createdAt - a.createdAt;
  });
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const load = useCallback(async () => {
    try {
      console.log('[memVault] Loading memos...');
      const list = await listMemos();
      console.log('[memVault] Memos loaded:', list.length);
      setMemos(list);
    } catch (error) {
      console.error('[memVault] Error loading memos:', error);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const playMemo = async (memo: MemoMeta) => {
    // Stop current playback
    if (playingUrl) {
      URL.revokeObjectURL(playingUrl);
    }
    if (audioRef.current) {
      audioRef.current.pause();
    }
    if (videoRef.current) {
      videoRef.current.pause();
    }

    try {
      const full = await getMemo(memo.id);
      if (!full) return;
      const url = URL.createObjectURL(full.blob);
      setPlayingUrl(url);
      setPlayingType(memo.type);
      setPlayingId(memo.id);
      setIsPaused(false);

      // Play after a tick so the element gets the new src
      setTimeout(() => {
        if (memo.type === 'audio' && audioRef.current) {
          audioRef.current.src = url;
          audioRef.current.play().catch(() => {});
        } else if (memo.type === 'video' && videoRef.current) {
          videoRef.current.src = url;
          videoRef.current.play().catch(() => {});
        }
      }, 100);
    } catch {
      // ignore
    }
  };

  const togglePause = () => {
    if (playingType === 'audio' && audioRef.current) {
      if (isPaused) {
        audioRef.current.play().catch(() => {});
        setIsPaused(false);
      } else {
        audioRef.current.pause();
        setIsPaused(true);
      }
    } else if (playingType === 'video' && videoRef.current) {
      if (isPaused) {
        videoRef.current.play().catch(() => {});
        setIsPaused(false);
      } else {
        videoRef.current.pause();
        setIsPaused(true);
      }
    }
  };

  const closePlayer = () => {
    if (audioRef.current) audioRef.current.pause();
    if (videoRef.current) videoRef.current.pause();
    if (playingUrl) URL.revokeObjectURL(playingUrl);
    setPlayingUrl(null);
    setPlayingId(null);
    setIsPaused(false);
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    if (playingId === deleteId) closePlayer();
    await deleteMemo(deleteId);
    setDeleteId(null);
    await load();
  };

  const openRename = (memo: MemoMeta) => {
    setRenameId(memo.id);
    setRenameTitle(memo.title);
  };

  const saveRename = async () => {
    if (!renameId || !renameTitle.trim()) return;
    await renameMemo(renameId, renameTitle);
    setRenameId(null);
    setRenameTitle('');
    await load();
  };

  const renderItem = ({ item }: { item: MemoMeta }) => (
    <View style={styles.memoCard}>
      <TouchableOpacity
        style={styles.memoMain}
        onPress={() => playMemo(item)}
        activeOpacity={0.7}
      >
        <View style={[styles.memoIcon, item.type === 'video' && styles.memoIconVideo]}>
          {item.type === 'audio' ? (
            <Mic size={20} color={colors.primary} strokeWidth={2} />
          ) : (
            <Video size={20} color={colors.accent} strokeWidth={2} />
          )}
        </View>
        <View style={styles.memoInfo}>
          <Text style={styles.memoTitle} numberOfLines={1}>{item.title}</Text>
          <Text style={styles.memoMeta}>
            {formatDuration(item.durationMs)} · {formatSize(item.size)} · {formatDate(item.createdAt)}
          </Text>
        </View>
        {playingId === item.id && (
          <View style={styles.playingBadge}>
            {isPaused ? <Pause size={14} color={colors.text} strokeWidth={2} /> : <Play size={14} color={colors.text} strokeWidth={2} />}
          </View>
        )}
      </TouchableOpacity>
      <TouchableOpacity style={styles.deleteBtn} onPress={() => openRename(item)} activeOpacity={0.6}>
        <MoreVertical size={18} color={colors.textMuted} strokeWidth={2} />
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={[styles.container, { paddingHorizontal: horizontalPadding }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Memos</Text>
        <Text style={styles.subtitle}>{memos.length} saved {memos.length === 1 ? 'memo' : 'memos'}</Text>
      </View>

      <View style={styles.searchBox}>
        <Search size={18} color={colors.textMuted} strokeWidth={2} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search memos"
          placeholderTextColor={colors.textMuted}
          style={styles.searchInput}
          returnKeyType="search"
        />
      </View>
      <View style={styles.filters}>
        {(['all', 'audio', 'video'] as const).map((type) => (
          <TouchableOpacity
            key={type}
            style={[styles.filterBtn, filterType === type && styles.filterBtnActive]}
            onPress={() => setFilterType(type)}
            activeOpacity={0.7}
          >
            <Text style={[styles.filterText, filterType === type && styles.filterTextActive]}>
              {type === 'all' ? 'All' : type === 'audio' ? 'Voice' : 'Video'}
            </Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity style={styles.sortBtn} onPress={() => setSortMode((mode) => mode === 'newest' ? 'oldest' : mode === 'oldest' ? 'largest' : 'newest')} activeOpacity={0.7}>
          <Text style={styles.sortText}>{sortMode === 'newest' ? 'Recent' : sortMode === 'oldest' ? 'Oldest' : 'Largest'}</Text>
        </TouchableOpacity>
      </View>

      {memos.length > 0 && (
        <View style={styles.summaryRow}>
          <Text style={styles.summaryText}>{filteredMemos.length} shown</Text>
          <Text style={styles.summaryText}>{formatSize(memos.reduce((total, memo) => total + memo.size, 0))} stored</Text>
        </View>
      )}

      {filteredMemos.length === 0 ? (
        <View style={styles.empty}>
          <FolderOpen size={56} color={colors.textMuted} strokeWidth={1.5} />
          <Text style={styles.emptyTitle}>{memos.length === 0 ? 'No memos yet' : 'No matches'}</Text>
          <Text style={styles.emptyText}>{memos.length === 0 ? 'Record a voice or video memo to see it here' : 'Try another search or filter'}</Text>
        </View>
      ) : (
        <FlatList
          data={filteredMemos}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: spacing.xl }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        />
      )}

      {/* Hidden media elements for playback (web only) */}
      {Platform.OS === 'web' && (
        <>
          <audio ref={audioRef} onEnded={closePlayer} />
          {/* Video player modal */}
          <Modal visible={!!playingUrl && playingType === 'video'} transparent animationType="slide" onRequestClose={closePlayer}>
            <View style={styles.videoModal}>
              <View style={styles.videoModalContent}>
                <TouchableOpacity style={styles.closeBtn} onPress={closePlayer}>
                  <X size={24} color={colors.text} strokeWidth={2} />
                </TouchableOpacity>
                {playingUrl && (
                  <video
                    ref={videoRef}
                    src={playingUrl}
                    controls
                    autoPlay
                    playsInline
                    style={{ width: '100%', maxHeight: '70vh', borderRadius: 12 }}
                    onEnded={closePlayer}
                  />
                )}
              </View>
            </View>
          </Modal>

          {/* Audio player modal */}
          <Modal visible={!!playingUrl && playingType === 'audio'} transparent animationType="slide" onRequestClose={closePlayer}>
            <View style={styles.audioModal}>
              <View style={styles.audioModalContent}>
                <View style={styles.audioModalHeader}>
                  <View style={styles.audioIconLarge}>
                    <Mic size={32} color={colors.primary} strokeWidth={2} />
                  </View>
                  <TouchableOpacity style={styles.closeBtn} onPress={closePlayer}>
                    <X size={24} color={colors.text} strokeWidth={2} />
                  </TouchableOpacity>
                </View>
                <Text style={styles.audioModalTitle} numberOfLines={1}>
                  {memos.find((m) => m.id === playingId)?.title ?? 'Voice Memo'}
                </Text>
                <TouchableOpacity style={styles.audioPlayBtn} onPress={togglePause} activeOpacity={0.7}>
                  {isPaused ? <Play size={28} color={colors.text} strokeWidth={2} /> : <Pause size={28} color={colors.text} strokeWidth={2} />}
                </TouchableOpacity>
                <Text style={styles.audioModalDuration}>
                  {playingId ? formatDuration(memos.find((m) => m.id === playingId)?.durationMs ?? 0) : '0:00'}
                </Text>
              </View>
            </View>
          </Modal>
        </>
      )}

      {/* Delete confirmation */}
      <Modal visible={!!deleteId} transparent animationType="fade" onRequestClose={() => setDeleteId(null)}>
        <View style={styles.deleteModal}>
          <View style={styles.deleteModalContent}>
            <View style={styles.deleteIconWrap}>
              <Trash2 size={28} color={colors.error} strokeWidth={2} />
            </View>
            <Text style={styles.deleteTitle}>Delete memo?</Text>
            <Text style={styles.deleteText}>This memo will be permanently deleted.</Text>
            <View style={styles.deleteActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setDeleteId(null)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmDeleteBtn} onPress={confirmDelete}>
                <Text style={styles.confirmDeleteBtnText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={!!renameId} transparent animationType="fade" onRequestClose={() => setRenameId(null)}>
        <View style={styles.deleteModal}>
          <View style={styles.deleteModalContent}>
            <Pencil size={26} color={colors.primary} strokeWidth={2} />
            <Text style={styles.deleteTitle}>Rename memo</Text>
            <TextInput
              value={renameTitle}
              onChangeText={setRenameTitle}
              placeholder="Memo title"
              placeholderTextColor={colors.textMuted}
              style={styles.renameInput}
              autoFocus
            />
            <View style={styles.deleteActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setRenameId(null)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmDeleteBtn} onPress={saveRename}>
                <Text style={styles.confirmDeleteBtnText}>Save</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.removeAction} onPress={() => { setRenameId(null); setDeleteId(renameId); }}>
              <Trash2 size={16} color={colors.error} />
              <Text style={styles.removeActionText}>Delete memo</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
    marginBottom: spacing.lg,
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
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  searchInput: {
    ...typography.bodySm,
    color: colors.text,
    flex: 1,
    minHeight: 44,
  },
  filters: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  filterBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterText: {
    ...typography.caption,
    color: colors.textDim,
    fontFamily: 'Inter-Bold',
  },
  filterTextActive: {
    color: colors.text,
  },
  sortBtn: {
    marginLeft: 'auto',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceAlt,
  },
  sortText: {
    ...typography.caption,
    color: colors.textDim,
    fontFamily: 'Inter-Bold',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  summaryText: {
    ...typography.caption,
    color: colors.textMuted,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingBottom: spacing.xxl,
  },
  emptyTitle: {
    ...typography.h2,
    color: colors.text,
  },
  emptyText: {
    ...typography.bodySm,
    color: colors.textMuted,
    textAlign: 'center',
  },
  renameInput: {
    ...typography.body,
    color: colors.text,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    width: '100%',
    paddingHorizontal: spacing.md,
    marginTop: spacing.md,
  },
  removeAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
    padding: spacing.sm,
  },
  removeActionText: {
    ...typography.bodySm,
    color: colors.error,
  },
  memoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    marginBottom: spacing.sm,
    paddingRight: spacing.sm,
  },
  memoMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.md,
  },
  memoIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memoIconVideo: {
    backgroundColor: 'rgba(16,185,129,0.12)',
  },
  memoInfo: {
    flex: 1,
    gap: 2,
  },
  memoTitle: {
    ...typography.body,
    color: colors.text,
  },
  memoMeta: {
    ...typography.caption,
    color: colors.textMuted,
  },
  playingBadge: {
    width: 28,
    height: 28,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoModal: {
    flex: 1,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  videoModalContent: {
    width: '100%',
    maxWidth: 500,
    position: 'relative',
  },
  closeBtn: {
    position: 'absolute',
    top: -spacing.xl,
    right: 0,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  audioModal: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  audioModalContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.md,
    paddingBottom: spacing.xxl,
  },
  audioModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    position: 'relative',
  },
  audioIconLarge: {
    width: 64,
    height: 64,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  audioModalTitle: {
    ...typography.h2,
    color: colors.text,
    textAlign: 'center',
  },
  audioPlayBtn: {
    width: 64,
    height: 64,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  audioModalDuration: {
    ...typography.bodySm,
    color: colors.textDim,
  },
  deleteModal: {
    flex: 1,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  deleteModalContent: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xl,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    gap: spacing.sm,
  },
  deleteIconWrap: {
    width: 56,
    height: 56,
    borderRadius: radius.full,
    backgroundColor: 'rgba(239,68,68,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  deleteTitle: {
    ...typography.h2,
    color: colors.text,
  },
  deleteText: {
    ...typography.bodySm,
    color: colors.textDim,
    textAlign: 'center',
  },
  deleteActions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
    width: '100%',
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
  },
  cancelBtnText: {
    ...typography.body,
    color: colors.text,
    fontFamily: 'Inter-Bold',
  },
  confirmDeleteBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.error,
    alignItems: 'center',
  },
  confirmDeleteBtnText: {
    ...typography.body,
    color: colors.text,
    fontFamily: 'Inter-Bold',
  },
});
