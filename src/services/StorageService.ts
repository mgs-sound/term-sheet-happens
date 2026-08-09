/**
 * StorageService — persistence behind an interface so Capacitor Preferences
 * can replace localStorage later without touching game or UI code.
 *
 * Async by design: localStorage is sync but Capacitor Preferences is not, so
 * the interface commits to promises now.
 */

/** Bump when the save shape changes; migrations key off this. */
export const SAVE_SCHEMA_VERSION = 3; // v3: LP Register identity + queued score

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

export class WebStorageService implements StorageService {
  async read<T>(key: string): Promise<VersionedSave<T> | null> {
    try {
      const raw = localStorage.getItem(KEY_PREFIX + key);
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
      localStorage.setItem(KEY_PREFIX + key, JSON.stringify(envelope));
    } catch {
      // Quota/private-mode failures must never crash the game.
    }
  }

  async remove(key: string): Promise<void> {
    try {
      localStorage.removeItem(KEY_PREFIX + key);
    } catch {
      // Ignore, same as write.
    }
  }
}
