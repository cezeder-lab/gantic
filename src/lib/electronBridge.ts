export interface GanticElectronAPI {
  chooseDataFolder: () => Promise<string | null>;
  getDataFolder: () => Promise<string>;
  readState: () => Promise<string | null>;
  writeState: (content: string) => Promise<void>;
  readAttachment: (id: string) => Promise<string | null>;
  writeAttachment: (id: string, base64: string) => Promise<void>;
  deleteAttachments: (ids: string[]) => Promise<void>;
}

declare global {
  interface Window {
    ganticElectron?: GanticElectronAPI;
  }
}

export function getElectronAPI(): GanticElectronAPI | null {
  return typeof window !== 'undefined' && window.ganticElectron ? window.ganticElectron : null;
}
