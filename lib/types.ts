export type MemoType = 'audio' | 'video';

export interface Memo {
  id: string;
  type: MemoType;
  title: string;
  blob: Blob;
  mimeType: string;
  durationMs: number;
  createdAt: number;
  size: number;
}

export interface MemoMeta {
  id: string;
  type: MemoType;
  title: string;
  mimeType: string;
  durationMs: number;
  createdAt: number;
  size: number;
}
