/**
 * StorageService — persistence behind an interface: localStorage on the web,
 * Capacitor Preferences in the native shell (wired in ./index.ts).
 *
 * Async by design: localStorage is sync but Capacitor Preferences is not, so
 * the interface commits to promises.
 */

import { Preferences } from '@capacitor/preferences';

/** Bump when the save shape changes; migrations key off this. */
export const SAVE_SCHEMA_VERSION = 1;

/** Envelope written around every persisted value. */
export interface VersionedSave<T> {
  schemaVersion: number;
  savedAt: string; // ISO timestamp
  data: T;
}

export interface StorageService {
  /** Returns the envelope, or null when absent/unreadable. Never throws. */
  read<T>(key: string): Promise<VersionedSave<T> | null>;
  /** Wraps `data` in a fresh envelope at the current schema version. */
  write<T>(key: string, data: T): Promise<void>;
  remove(key: string): Promise<void>;
}

const KEY_PREFIX = 'tsh.';

/** Raw string store under the envelope — the only part that differs per platform. */
interface RawStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

/** Envelope handling and the never-throw policy, over any raw string store. */
class EnvelopeStorageService implements StorageService {
  private readonly store: RawStore;

  constructor(store: RawStore) {
    this.store = store;
  }

  async read<T>(key: string): Promise<VersionedSave<T> | null> {
    try {
      const raw = await this.store.get(KEY_PREFIX + key);
      if (raw === null) return null;
      const parsed = JSON.parse(raw) as VersionedSave<T>;
      if (typeof parsed.schemaVersion !== 'number') return null;
      return parsed;
    } catch {
      // Corrupt JSON or storage unavailable (private mode) reads as "no save".
      return null;
    }
  }

  async write<T>(key: string, data: T): Promise<void> {
    const envelope: VersionedSave<T> = {
      schemaVersion: SAVE_SCHEMA_VERSION,
      savedAt: new Date().toISOString(),
      data,
    };
    try {
      await this.store.set(KEY_PREFIX + key, JSON.stringify(envelope));
    } catch {
      // Quota/private-mode failures must never crash the game.
    }
  }

  async remove(key: string): Promise<void> {
    try {
      await this.store.remove(KEY_PREFIX + key);
    } catch {
      // Ignore, same as write.
    }
  }
}

export class WebStorageService extends EnvelopeStorageService {
  constructor() {
    super({
      get: async (key) => localStorage.getItem(key),
      set: async (key, value) => localStorage.setItem(key, value),
      remove: async (key) => localStorage.removeItem(key),
    });
  }
}

/**
 * Native saves. Preferences sits on UserDefaults on iOS, which the OS never
 * purges — unlike WKWebView localStorage, which it can evict under storage
 * pressure and take the Career Ledger with it.
 */
export class CapacitorStorageService extends EnvelopeStorageService {
  constructor() {
    super({
      get: async (key) => (await Preferences.get({ key })).value,
      set: (key, value) => Preferences.set({ key, value }),
      remove: (key) => Preferences.remove({ key }),
    });
  }
}
