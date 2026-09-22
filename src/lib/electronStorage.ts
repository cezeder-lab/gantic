import type { StateStorage } from 'zustand/middleware';
import { getElectronAPI } from './electronBridge';

/**
 * Zustand persist storage that writes to a real file (via the Electron main
 * process) when running as a desktop app, and falls back to localStorage in
 * the plain browser build. On first read inside Electron, if no data file
 * exists yet but a previous browser session left data in localStorage
 * (upgrading from an older build), that data is migrated into the file once.
 */
export const appStorage: StateStorage = {
  getItem: async (name) => {
    const api = getElectronAPI();
    if (!api) return localStorage.getItem(name);

    const fromFile = await api.readState();
    if (fromFile !== null) return fromFile;

    const fromBrowser = localStorage.getItem(name);
    if (fromBrowser) {
      await api.writeState(fromBrowser);
      return fromBrowser;
    }
    return null;
  },

  setItem: async (name, value) => {
    const api = getElectronAPI();
    if (!api) {
      localStorage.setItem(name, value);
      return;
    }
    await api.writeState(value);
  },

  removeItem: async (name) => {
    const api = getElectronAPI();
    if (!api) {
      localStorage.removeItem(name);
      return;
    }
    await api.writeState('');
  },
};
