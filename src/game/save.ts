/**
 * Save-file schema and migrations. Pure TS: the platform envelope (schema
 * version + timestamp) lives in StorageService; this module owns what's
 * INSIDE a save and how old shapes migrate forward. Corrupt or unknown data
 * always degrades to null (fresh career), never a crash.
 */

import { fundCarryM } from './carry.ts';
import type { CareerState, GameState, ScoreSubmission } from './types.ts';
import { roundM } from './util.ts';

/** Everything needed to restore a session exactly. */
export interface SaveData {
  career: CareerState;
  /** Current run at its last clean beat; null between runs. */
  game: GameState | null;
  /** UI screen hint; sanitized against game.phase on restore. */
  screen: string;
  /** Mid-GP-promotion career (offers/naming flow), when applicable. */
  pendingCareer: CareerState | null;
  /** Latest register submission that couldn't reach the API; retried on boot. */
  pendingScore: ScoreSubmission | null;
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
    typeof value.careerCarryM === 'number' &&
    'playerName' in value &&
    'careerId' in value &&
    'boardOptIn' in value &&
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
  if (value.pendingScore !== null && !isRecord(value.pendingScore)) return false;
  return true;
}

/** v1 -> v2: backfill carry fields, computed from the figures already saved. */
function upgradeV1(data: unknown): unknown {
  if (!isRecord(data)) return data;

  const upgradeCareer = (c: unknown): unknown => {
    if (!isRecord(c)) return c;
    const ledger = Array.isArray(c.ledger)
      ? c.ledger.map((e) =>
          isRecord(e) &&
          typeof e.returnedM === 'number' &&
          typeof e.fundSizeM === 'number' &&
          typeof e.carryM !== 'number'
            ? { ...e, carryM: fundCarryM(e.returnedM, e.fundSizeM) }
            : e,
        )
      : c.ledger;
    const careerCarryM =
      typeof c.careerCarryM === 'number'
        ? c.careerCarryM
        : Array.isArray(ledger)
          ? roundM(
              ledger.reduce(
                (sum: number, e) => (isRecord(e) && typeof e.carryM === 'number' ? sum + e.carryM : sum),
                0,
              ),
            )
          : 0;
    return { ...c, ledger, careerCarryM };
  };

  let game = data.game;
  if (isRecord(game) && isRecord(game.harvest)) {
    const h = game.harvest;
    if (
      typeof h.returnedM === 'number' &&
      typeof game.fundSizeM === 'number' &&
      typeof h.carryM !== 'number'
    ) {
      game = { ...game, harvest: { ...h, carryM: fundCarryM(h.returnedM, game.fundSizeM) } };
    }
  }

  return {
    ...data,
    career: upgradeCareer(data.career),
    pendingCareer: data.pendingCareer == null ? null : upgradeCareer(data.pendingCareer),
    game,
  };
}

/**
 * Migrate a persisted payload at `schemaVersion` to the current SaveData
 * shape. Returns null when the data is unknown or unusable.
 *
 * When the schema changes again: bump SAVE_SCHEMA_VERSION in StorageService,
 * add an upgrade step here, and chain older versions through it.
 */
/** v2 -> v3: register identity defaults + the queued-submission slot. */
function upgradeV2(data: unknown): unknown {
  if (!isRecord(data)) return data;
  const upgradeCareer = (c: unknown): unknown =>
    isRecord(c)
      ? {
          playerName: null,
          careerId: null,
          boardOptIn: null,
          ...c,
        }
      : c;
  return {
    pendingScore: null,
    ...data,
    career: upgradeCareer(data.career),
    pendingCareer: data.pendingCareer == null ? null : upgradeCareer(data.pendingCareer),
  };
}

export function migrateSave(schemaVersion: number, data: unknown): SaveData | null {
  switch (schemaVersion) {
    case 3:
      return isSaveData(data) ? data : null;
    case 2: {
      const upgraded = upgradeV2(data);
      return isSaveData(upgraded) ? (upgraded as SaveData) : null;
    }
    case 1: {
      const upgraded = upgradeV2(upgradeV1(data));
      return isSaveData(upgraded) ? (upgraded as SaveData) : null;
    }
    default:
      return null;
  }
}
