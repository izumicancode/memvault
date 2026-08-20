import type { Memo, MemoMeta } from './types';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { File, Paths } from 'expo-file-system';
import type { AccentTheme } from './theme';

const DB_NAME = 'memo-vault';
const DB_VERSION = 1;
const STORE = 'memos';
const NATIVE_MEMOS_KEY = 'memo-vault-native-memos';
const ACCENT_THEME_KEY = 'memo-vault-accent-theme';
const LOCK_KEY = 'memo-vault-pin';
const BIOMETRIC_KEY = 'memo-vault-biometric';
const ATTEMPTS_KEY = 'memo-vault-pin-attempts';
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB

export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE;

type NativeMemo = Omit<Memo, 'blob'> & { blobData: string };

function isNative(): boolean {
  return Platform.OS !== 'web';
}

async function blobToDataUri(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  for (let index = 0; index < bytes.length; index += 1) binary += String.fromCharCode(bytes[index]);
  return `data:${blob.type || 'application/octet-stream'};base64,${btoa(binary)}`;
}

function dataUriToBlob(dataUri: string): Blob {
  const [header, encoded] = dataUri.split(',');
  const binary = atob(encoded ?? '');
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new Blob([bytes], { type: header?.match(/data:([^;]+)/)?.[1] ?? 'application/octet-stream' });
}

async function getNativeMemos(): Promise<NativeMemo[]> {
  const raw = await AsyncStorage.getItem(NATIVE_MEMOS_KEY);
  return raw ? JSON.parse(raw) as NativeMemo[] : [];
}

async function saveNativeMemos(memos: NativeMemo[]): Promise<void> {
  await AsyncStorage.setItem(NATIVE_MEMOS_KEY, JSON.stringify(memos));
}

export async function getAccentTheme(): Promise<AccentTheme> {
  const value = isNative()
    ? await AsyncStorage.getItem(ACCENT_THEME_KEY)
    : localStorage.getItem(ACCENT_THEME_KEY);
  return value === 'violet' || value === 'amber' || value === 'rose' ? value : 'blue';
}

export async function setAccentTheme(theme: AccentTheme): Promise<void> {
  if (isNative()) await AsyncStorage.setItem(ACCENT_THEME_KEY, theme);
  else localStorage.setItem(ACCENT_THEME_KEY, theme);
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveMemo(memo: Memo): Promise<void> {
  if (isNative()) {
    const memos = await getNativeMemos();
    const nativeMemo: NativeMemo = { ...memo, blobData: await blobToDataUri(memo.blob) };
    const next = memos.filter((item) => item.id !== memo.id);
    next.push(nativeMemo);
    await saveNativeMemos(next);
    return;
  }
  const db = await openDB();
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
      const putReq = store.put(memo);
      
      putReq.onsuccess = () => {
        console.log('[memVault] Put operation succeeded:', memo.id);
      };
      putReq.onerror = () => {
        console.error('[memVault] Put operation failed:', putReq.error);
      };
      
      tx.oncomplete = () => { 
        console.log('[memVault] Transaction complete for memo:', memo.id);
        db.close(); 
        resolve(); 
      };
      tx.onerror = () => { 
        console.error('[memVault] Transaction error:', tx.error);
        db.close(); 
        reject(new Error(`Transaction failed: ${tx.error}`));
      };
      tx.onabort = () => {
        console.error('[memVault] Transaction aborted');
        db.close();
        reject(new Error('Transaction aborted'));
      };
    } catch (error) {
      db.close();
      reject(error);
    }
  });
}

export async function deleteMemo(id: string): Promise<void> {
  const memo = await getMemo(id);
  if (!memo) return;
  await saveMemo({ ...memo, deletedAt: Date.now() });
}

export async function permanentlyDeleteMemo(id: string): Promise<void> {
  if (isNative()) {
    await saveNativeMemos((await getNativeMemos()).filter((memo) => memo.id !== id));
    return;
  }
  const db = await openDB();
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(id);
      tx.oncomplete = () => { 
        console.log('[memVault] Memo deleted:', id);
        db.close(); 
        resolve(); 
      };
      tx.onerror = () => { 
        console.error('[memVault] Delete transaction error:', tx.error);
        db.close(); 
        reject(tx.error); 
      };
    } catch (error) {
      db.close();
      reject(error);
    }
  });
}

export async function renameMemo(id: string, title: string): Promise<void> {
  const memo = await getMemo(id);
  if (!memo) throw new Error('Memo not found');
  await saveMemo({ ...memo, title: title.trim() || memo.title });
}

export async function updateMemoMetadata(
  id: string,
  metadata: Partial<Pick<Memo, 'tags' | 'isFavorite' | 'isArchived'>>,
): Promise<void> {
  const memo = await getMemo(id);
  if (!memo) throw new Error('Memo not found');
  await saveMemo({ ...memo, ...metadata });
}

export async function restoreMemo(id: string): Promise<void> {
  const memo = await getMemo(id);
  if (!memo) return;
  const { deletedAt: _deletedAt, ...restoredMemo } = memo;
  await saveMemo(restoredMemo);
}

export async function getMemo(id: string): Promise<Memo | undefined> {
  if (isNative()) {
    const memo = (await getNativeMemos()).find((item) => item.id === id);
    if (!memo) return undefined;
    const { blobData, ...metadata } = memo;
    return { ...metadata, blob: dataUriToBlob(blobData) };
  }
  const db = await openDB();
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(id);
      
      req.onsuccess = () => { 
        console.log('[memVault] Got memo:', id, !!req.result);
        resolve(req.result as Memo | undefined); 
      };
      req.onerror = () => { 
        console.error('[memVault] Get operation failed:', req.error);
        reject(req.error); 
      };
      
      tx.oncomplete = () => { db.close(); };
      tx.onerror = () => { 
        console.error('[memVault] Get transaction error:', tx.error);
        reject(tx.error); 
      };
    } catch (error) {
      db.close();
      reject(error);
    }
  });
}

export async function getMemoPlaybackUri(id: string): Promise<string | undefined> {
  if (!isNative()) return undefined;
  const memo = (await getNativeMemos()).find((item) => item.id === id);
  if (!memo) return undefined;
  const encoded = memo.blobData.split(',')[1] ?? '';
  const extensionByMime: Record<string, string> = {
    'audio/mp4': 'm4a',
    'audio/mpeg': 'mp3',
    'audio/aac': 'aac',
    'audio/wav': 'wav',
    'audio/x-wav': 'wav',
    'audio/webm': 'webm',
    'video/mp4': 'mp4',
    'video/webm': 'webm',
  };
  const extension = extensionByMime[memo.mimeType] ?? (memo.type === 'video' ? 'mp4' : 'm4a');
  const file = new File(Paths.cache, `memo-vault-${id}.${extension}`);
  file.write(encoded, { encoding: 'base64' });
  return file.uri;
}

export async function listMemos(): Promise<MemoMeta[]> {
  if (isNative()) {
    return (await getNativeMemos())
      .map(({ blobData: _blobData, ...memo }) => memo)
      .sort((a, b) => b.createdAt - a.createdAt);
  }
  const db = await openDB();
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).getAll();
      
      req.onsuccess = () => {
        const all = (req.result as Memo[]) ?? [];
        console.log('[memVault] Loaded memos count:', all.length);
        const metas: MemoMeta[] = all
          .filter((m) => !m.deletedAt)
          .map((m) => ({
            id: m.id,
            type: m.type,
            title: m.title,
            mimeType: m.mimeType,
            durationMs: m.durationMs,
            createdAt: m.createdAt,
            size: m.size,
            tags: m.tags,
            isFavorite: m.isFavorite,
            isArchived: m.isArchived,
          }))
          .sort((a, b) => b.createdAt - a.createdAt);
        resolve(metas);
      };
      
      req.onerror = () => { 
        console.error('[memVault] GetAll operation failed:', req.error);
        reject(req.error); 
      };
      
      tx.oncomplete = () => { db.close(); };
      tx.onerror = () => { 
        console.error('[memVault] List transaction error:', tx.error);
        reject(tx.error); 
      };
    } catch (error) {
      db.close();
      reject(error);
    }
  });
}

export async function listTrash(): Promise<MemoMeta[]> {
  if (isNative()) {
    return (await getNativeMemos())
      .filter((memo) => !!memo.deletedAt)
      .map(({ blobData: _blobData, ...memo }) => memo)
      .sort((a, b) => (b.deletedAt ?? 0) - (a.deletedAt ?? 0));
  }
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => {
      resolve((req.result as Memo[]).filter((memo) => !!memo.deletedAt).map((memo) => ({
        id: memo.id,
        type: memo.type,
        title: memo.title,
        mimeType: memo.mimeType,
        durationMs: memo.durationMs,
        createdAt: memo.createdAt,
        size: memo.size,
        tags: memo.tags,
        isFavorite: memo.isFavorite,
        isArchived: memo.isArchived,
        deletedAt: memo.deletedAt,
      })));
    };
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
    tx.onerror = () => reject(tx.error);
  });
}

// --- PIN lock ---
// The PIN is hashed with SHA-256 via the Web Crypto API before storage.
// This prevents the raw PIN from being readable in localStorage/DevTools.
// Note: this is a client-side lock for casual privacy, not cryptographic security.

async function hashPin(pin: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(`memo-vault-salt:${pin}`);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Constant-time string comparison to avoid timing side-channels.
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

export async function setPin(pin: string): Promise<void> {
  const hashed = await hashPin(pin);
  try {
    localStorage.setItem(LOCK_KEY, hashed);
    resetAttempts();
  } catch {
    // ignore
  }
}

export function clearPin(): void {
  try {
    localStorage.removeItem(LOCK_KEY);
    localStorage.removeItem(BIOMETRIC_KEY);
    resetAttempts();
  } catch {
    // ignore
  }
}

export function hasPin(): boolean {
  try {
    return localStorage.getItem(LOCK_KEY) !== null;
  } catch {
    return false;
  }
}

export function isBiometricEnabled(): boolean {
  try {
    return localStorage.getItem(BIOMETRIC_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setBiometricEnabled(enabled: boolean): void {
  try {
    if (enabled) localStorage.setItem(BIOMETRIC_KEY, 'true');
    else localStorage.removeItem(BIOMETRIC_KEY);
  } catch {
    // ignore
  }
}

export function getHashedPin(): string | null {
  try {
    return localStorage.getItem(LOCK_KEY);
  } catch {
    return null;
  }
}

export async function verifyPin(pin: string): Promise<boolean> {
  const stored = getHashedPin();
  if (!stored) return false;
  const hashed = await hashPin(pin);
  return constantTimeEqual(hashed, stored);
}

// --- Brute-force protection ---
// Tracks failed attempts and enforces a backoff after too many tries.

interface AttemptState {
  count: number;
  lockedUntil: number;
}

const MAX_ATTEMPTS = 5;
const BACKOFF_MS = [0, 0, 0, 0, 30_000, 60_000, 300_000]; // 30s, 60s, 5min

function getAttempts(): AttemptState {
  try {
    const raw = localStorage.getItem(ATTEMPTS_KEY);
    if (!raw) return { count: 0, lockedUntil: 0 };
    return JSON.parse(raw) as AttemptState;
  } catch {
    return { count: 0, lockedUntil: 0 };
  }
}

function saveAttempts(state: AttemptState): void {
  try {
    localStorage.setItem(ATTEMPTS_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

export function resetAttempts(): void {
  saveAttempts({ count: 0, lockedUntil: 0 });
}

export function isLockedOut(): boolean {
  const state = getAttempts();
  return Date.now() < state.lockedUntil;
}

export function getLockoutMsRemaining(): number {
  const state = getAttempts();
  return Math.max(0, state.lockedUntil - Date.now());
}

export function recordFailedAttempt(): void {
  const state = getAttempts();
  const newCount = state.count + 1;
  const backoffIndex = Math.min(newCount, BACKOFF_MS.length - 1);
  const backoff = BACKOFF_MS[backoffIndex] ?? 0;
  saveAttempts({ count: newCount, lockedUntil: backoff > 0 ? Date.now() + backoff : 0 });
}
