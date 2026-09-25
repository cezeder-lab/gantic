export interface ElectronUpdateEvent {
  status: 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error';
  version?: string;
  percent?: number;
  message?: string;
}

export interface GanticElectronAPI {
  chooseDataFolder: () => Promise<string | null>;
  getDataFolder: () => Promise<string>;
  readState: () => Promise<string | null>;
  writeState: (content: string) => Promise<void>;
  readAttachment: (id: string) => Promise<string | null>;
  writeAttachment: (id: string, base64: string) => Promise<void>;
  deleteAttachments: (ids: string[]) => Promise<void>;
  checkForUpdates: () => Promise<{ skipped: boolean; reason?: string }>;
  quitAndInstallUpdate: () => Promise<void>;
  getAppVersion: () => Promise<string>;
  onUpdateEvent: (callback: (event: ElectronUpdateEvent) => void) => () => void;
  wsChoose: () => Promise<string | null>;
  wsOpen: (folder: string) => Promise<{ ok: true; name: string } | { ok: false; error: string }>;
  wsClose: () => Promise<void>;
  wsReadNew: () => Promise<string[]>;
  wsAppend: (clientId: string, lines: string[]) => Promise<void>;
  wsAppendSync: (clientId: string, lines: string[]) => boolean;
  wsWritePresence: (clientId: string, entry: unknown) => Promise<void>;
  wsReadPresence: () => Promise<unknown[]>;
  wsImportAttachments: (ids: string[]) => Promise<void>;
}

declare global {
  interface Window {
    ganticElectron?: GanticElectronAPI;
  }
}

export function getElectronAPI(): GanticElectronAPI | null {
  return typeof window !== 'undefined' && window.ganticElectron ? window.ganticElectron : null;
}
