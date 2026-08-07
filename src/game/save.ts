/**
 * Save-file schema and migrations. Pure TS: the platform envelope (schema
 * version + timestamp) lives in StorageService; this module owns what's
 * INSIDE a save and how old shapes migrate forward. Corrupt or unknown data
 * always degrades to null (fresh career), never a crash.
 */

import type { CareerState, GameState } from './types.ts';

/** Everything needed to restore a session exactly. */
export interface SaveData {
  career: CareerState;
  /** Current run at its last clean beat; null between runs. */
  game: GameState | null;
  /** UI screen hint; sanitized against game.phase on restore. */
  screen: string;
  /** Mid-GP-promotion career (offers/naming flow), when applicable. */
  pendingCareer: CareerState | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function looksLikeCareer(value: unknown): value is CareerState {
  return (
    isRecord(value) &&
    typeof value.tier === 'string' &&
    typeof value.fundIndex === 'number' &&
    typeof value.reputation === 'number' &&
    Array.isArray(value.ledger)
  );
}

function looksLikeGame(value: unknown): value is GameState {
  return (
    isRecord(value) &&
    typeof value.rngState === 'number' &&
    typeof value.phase === 'string' &&
    typeof value.meetingIndex === 'number' &&
    Array.isArray(value.deck) &&
    Array.isArray(value.portfolio)
  );
}

function isSaveData(value: unknown): value is SaveData {
  if (!isRecord(value)) return false;
  if (!looksLikeCareer(value.career)) return false;
  if (value.game !== null && !looksLikeGame(value.game)) return false;
  if (typeof value.screen !== 'string') return false;
  if (value.pendingCareer !== null && !looksLikeCareer(value.pendingCareer)) return false;
  return true;
}

/**
 * Migrate a persisted payload at `schemaVersion` to the current SaveData
 * shape. Returns null when the data is unknown or unusable.
 *
 * Migration stub: when the schema changes, bump SAVE_SCHEMA_VERSION in
 * StorageService and add a `case` here that upgrades the previous shape.
 */
export function migrateSave(schemaVersion: number, data: unknown): SaveData | null {
  switch (schemaVersion) {
    case 1:
      return isSaveData(data) ? data : null;
    default:
      return null;
  }
}
