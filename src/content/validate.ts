/**
 * Runtime content validation, shared by the app loader (src/content/index.ts)
 * and the CLI checker (scripts/validate-content.ts, run under plain Node with
 * type stripping — hence the explicit .ts import extension).
 *
 * Pure functions, no I/O: callers hand in parsed JSON, we hand back errors.
 */

import {
  EXIT_BUCKETS,
  LP_REQUEST_KINDS,
  SECTORS,
  VERDICT_BUCKETS,
  type Content,
  type FirmNameParts,
  type FlavorLines,
  type Pitch,
  type Thesis,
} from './types.ts';

/**
 * Editorial constraint from the tone guide: one twist, under 20 words.
 * (Not gameplay tuning — this bounds the writing, not the game.)
 */
export const MAX_IDEA_WORDS = 20;
/** LP requests must fit one line on the engagement letter (tokens count as 2). */
export const MAX_LP_REQUEST_CHARS = 36;

export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isSector(value: unknown): boolean {
  return typeof value === 'string' && (SECTORS as readonly string[]).includes(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.length > 0 && value.every(isNonEmptyString);
}

/**
 * Validate one pitches/*.json batch. `label` names the file in error messages.
 * Structural errors abort the batch; per-pitch errors accumulate.
 */
export function validatePitchBatch(
  label: string,
  data: unknown,
): { pitches: Pitch[]; errors: string[] } {
  const errors: string[] = [];
  if (!isRecord(data) || !Array.isArray(data.pitches)) {
    return { pitches: [], errors: [`${label}: expected { "pitches": [...] }`] };
  }
  const pitches: Pitch[] = [];
  data.pitches.forEach((raw: unknown, i: number) => {
    const where = `${label} pitch[${i}]`;
    if (!isRecord(raw)) {
      errors.push(`${where}: not an object`);
      return;
    }
    if (!isNonEmptyString(raw.id)) errors.push(`${where}: missing/empty "id"`);
    if (!isNonEmptyString(raw.name)) errors.push(`${where}: missing/empty "name"`);
    if (!isNonEmptyString(raw.idea)) errors.push(`${where}: missing/empty "idea"`);
    if (!isSector(raw.sector)) {
      errors.push(`${where} (${String(raw.id)}): unknown sector "${String(raw.sector)}"`);
    }
    if (isNonEmptyString(raw.idea)) {
      const words = countWords(raw.idea);
      if (words > MAX_IDEA_WORDS) {
        errors.push(
          `${where} (${String(raw.id)}): idea is ${words} words (max ${MAX_IDEA_WORDS})`,
        );
      }
    }
    pitches.push(raw as unknown as Pitch);
  });
  return { pitches, errors };
}

/** Cross-file checks: ids and names must be unique across ALL pitches. */
export function validatePitchPool(pitches: Pitch[]): string[] {
  const errors: string[] = [];
  const seenIds = new Map<string, number>();
  const seenNames = new Map<string, number>();
  for (const p of pitches) {
    seenIds.set(p.id, (seenIds.get(p.id) ?? 0) + 1);
    const nameKey = p.name.trim().toLowerCase();
    seenNames.set(nameKey, (seenNames.get(nameKey) ?? 0) + 1);
  }
  for (const [id, n] of seenIds) if (n > 1) errors.push(`duplicate pitch id "${id}" (x${n})`);
  for (const [name, n] of seenNames) {
    if (n > 1) errors.push(`duplicate pitch name "${name}" (x${n})`);
  }
  return errors;
}

export function validateTheses(data: unknown): { theses: Thesis[]; errors: string[] } {
  const errors: string[] = [];
  if (!isRecord(data) || !Array.isArray(data.theses)) {
    return { theses: [], errors: ['theses.json: expected { "theses": [...] }'] };
  }
  const theses: Thesis[] = [];
  const seenIds = new Set<string>();
  data.theses.forEach((raw: unknown, i: number) => {
    const where = `theses.json thesis[${i}]`;
    if (!isRecord(raw)) {
      errors.push(`${where}: not an object`);
      return;
    }
    if (!isNonEmptyString(raw.id)) errors.push(`${where}: missing/empty "id"`);
    else if (seenIds.has(raw.id)) errors.push(`${where}: duplicate id "${raw.id}"`);
    else seenIds.add(raw.id);
    if (!isNonEmptyString(raw.line)) errors.push(`${where}: missing/empty "line"`);
    const sectors = raw.sectors;
    if (!Array.isArray(sectors) || sectors.length !== 2 || !sectors.every(isSector)) {
      errors.push(`${where} (${String(raw.id)}): "sectors" must be exactly 2 known sectors`);
    } else if (sectors[0] === sectors[1]) {
      errors.push(`${where} (${String(raw.id)}): the 2 sectors must be distinct`);
    }
    theses.push(raw as unknown as Thesis);
  });
  return { theses, errors };
}

export function validateFirmNameParts(data: unknown): {
  parts: FirmNameParts;
  errors: string[];
} {
  const errors: string[] = [];
  const empty: FirmNameParts = { prefixes: [], suffixes: [] };
  if (!isRecord(data)) return { parts: empty, errors: ['firmNames.json: not an object'] };
  if (!isStringArray(data.prefixes)) {
    errors.push('firmNames.json: "prefixes" must be a non-empty string array');
  }
  if (!isStringArray(data.suffixes)) {
    errors.push('firmNames.json: "suffixes" must be a non-empty string array');
  }
  return errors.length > 0
    ? { parts: empty, errors }
    : { parts: { prefixes: data.prefixes as string[], suffixes: data.suffixes as string[] }, errors };
}

/**
 * Assemble and validate a full Content bundle from parsed JSON. Shared by
 * the eager loader (tests/scripts) and the lazy loader (app). Throws with
 * every error listed when anything is invalid.
 */
export function assembleContent(
  pitchBatches: ReadonlyArray<readonly [string, unknown]>,
  thesesData: unknown,
  firmNamesData: unknown,
  linesData: unknown,
): Content {
  const errors: string[] = [];
  const pitches: Pitch[] = [];
  for (const [label, data] of pitchBatches) {
    const batch = validatePitchBatch(label, data);
    errors.push(...batch.errors);
    pitches.push(...batch.pitches);
  }
  errors.push(...validatePitchPool(pitches));

  const { theses, errors: thesisErrors } = validateTheses(thesesData);
  errors.push(...thesisErrors);
  const { parts: firmNames, errors: firmErrors } = validateFirmNameParts(firmNamesData);
  errors.push(...firmErrors);
  const { lines, errors: lineErrors } = validateFlavorLines(linesData);
  errors.push(...lineErrors);

  if (errors.length > 0 || lines === null) {
    throw new Error(`Content validation failed:\n- ${errors.join('\n- ')}`);
  }
  return { pitches, theses, firmNames, lines };
}

export function validateFlavorLines(data: unknown): { lines: FlavorLines | null; errors: string[] } {
  const errors: string[] = [];
  if (!isRecord(data)) return { lines: null, errors: ['lines.json: not an object'] };

  const pools = [
    'rehireCard',
    'zombieFundJabs',
    'vetoLines',
    'founderWalkLines',
    'vetoHeartbreak',
    'poachLines',
    'lpOfferQuirks',
    'founderMoods',
    'boardSeatLocked',
    'finalCardPitches',
    'enlightenmentLines',
    'creditsLines',
    'portfolioEmpty',
  ] as const;
  for (const pool of pools) {
    if (!isStringArray(data[pool])) {
      errors.push(`lines.json: "${pool}" must be a non-empty string array`);
    }
  }

  const stages = data.reputationStages;
  if (!isStringArray(stages) || stages.length !== 5) {
    errors.push('lines.json: "reputationStages" must be exactly 5 non-empty strings');
  }

  const verdicts = data.verdicts;
  if (!isRecord(verdicts)) {
    errors.push('lines.json: "verdicts" must be an object keyed by verdict bucket');
  } else {
    for (const bucket of VERDICT_BUCKETS) {
      if (!isStringArray(verdicts[bucket])) {
        errors.push(`lines.json: verdicts.${bucket} must be a non-empty string array`);
      }
    }
  }

  const shares = data.shareLines;
  if (!isRecord(shares)) {
    errors.push('lines.json: "shareLines" must be an object keyed by verdict bucket');
  } else {
    for (const bucket of VERDICT_BUCKETS) {
      if (!isStringArray(shares[bucket])) {
        errors.push(`lines.json: shareLines.${bucket} must be a non-empty string array`);
      }
    }
  }
  if (!isStringArray(data.shareCareerLines)) {
    errors.push('lines.json: "shareCareerLines" must be a non-empty string array');
  }

  const stamps = data.verdictStamps;
  if (!isRecord(stamps)) {
    errors.push('lines.json: "verdictStamps" must be an object keyed by verdict bucket');
  } else {
    for (const bucket of VERDICT_BUCKETS) {
      if (!isNonEmptyString(stamps[bucket])) {
        errors.push(`lines.json: verdictStamps.${bucket} must be a non-empty string`);
      }
    }
  }

  const labels = data.harvestOutcomeLabels;
  if (!isRecord(labels)) {
    errors.push('lines.json: "harvestOutcomeLabels" must be an object keyed by exit bucket');
  } else {
    for (const bucket of EXIT_BUCKETS) {
      if (!isNonEmptyString(labels[bucket])) {
        errors.push(`lines.json: harvestOutcomeLabels.${bucket} must be a non-empty string`);
      }
    }
  }

  if (!isNonEmptyString(data.harvestPushZeroedLabel)) {
    errors.push('lines.json: "harvestPushZeroedLabel" must be a non-empty string');
  }

  const bands = data.fundIDifficulty;
  if (
    !Array.isArray(bands) ||
    bands.length !== 3 ||
    !bands.every((b) => isRecord(b) && isNonEmptyString(b.label) && isNonEmptyString(b.blurb))
  ) {
    errors.push(
      'lines.json: "fundIDifficulty" must be exactly 3 { label, blurb } entries (soft, standard, brutal)',
    );
  }

  const vc = data.vetoChallenge;
  if (
    !isRecord(vc) ||
    !isNonEmptyString(vc.title) ||
    !isNonEmptyString(vc.youChose) ||
    !isNonEmptyString(vc.stampWon) ||
    !isNonEmptyString(vc.stampLost) ||
    !isStringArray(vc.intros) ||
    !isStringArray(vc.won) ||
    !isStringArray(vc.lost) ||
    !isStringArray(vc.highLowIntros) ||
    !isStringArray(vc.highLowWon) ||
    !isStringArray(vc.highLowLost) ||
    !isStringArray(vc.diceIntros) ||
    !isStringArray(vc.diceWon) ||
    !isStringArray(vc.diceLost) ||
    !isStringArray(vc.sticksIntros) ||
    !isStringArray(vc.sticksWon) ||
    !isStringArray(vc.sticksLost)
  ) {
    errors.push('lines.json: "vetoChallenge" needs a title and non-empty intros / won / lost arrays');
  }

  const status = data.portfolioStatusLabels;
  if (!isRecord(status) || !isNonEmptyString(status.active) || !isNonEmptyString(status.writtenOff)) {
    errors.push('lines.json: "portfolioStatusLabels" must have non-empty "active" and "writtenOff"');
  }

  const pr = data.profile;
  const sk = isRecord(pr) ? pr.skills : null;
  if (
    !isRecord(pr) ||
    !isNonEmptyString(pr.title) ||
    !isNonEmptyString(pr.name) ||
    !Array.isArray(pr.aboutByStage) ||
    pr.aboutByStage.length !== 5 ||
    !pr.aboutByStage.every(isNonEmptyString) ||
    !isNonEmptyString(pr.openToWork) ||
    !isNonEmptyString(pr.experienceTitle) ||
    !isNonEmptyString(pr.skillsTitle) ||
    !isNonEmptyString(pr.endorsed) ||
    !isNonEmptyString(pr.empty) ||
    !isRecord(sk) ||
    !isStringArray(sk.base) ||
    !['unicorns', 'vetoedRight', 'returned', 'neverReturned', 'enlightened'].every((k) =>
      isNonEmptyString(sk[k]),
    )
  ) {
    errors.push(
      'lines.json: "profile" needs title / name / 5 aboutByStage lines / openToWork / experienceTitle / skillsTitle / endorsed / empty and skills.{base[],unicorns,vetoedRight,returned,neverReturned,enlightened}',
    );
  }

  const ob = isRecord(pr) ? pr.onboarding : null;
  if (
    !isRecord(ob) ||
    !['defaultName', 'about', 'startCta', 'endorsedNamed', 'endorsedAnon'].every((k) =>
      isNonEmptyString(ob[k]),
    ) ||
    !isStringArray(ob.skills)
  ) {
    errors.push(
      'lines.json: "profile.onboarding" needs namePlaceholder / about / endorsedNamed / endorsedAnon / cta and skills[]',
    );
  }

  const op = data.offerProfiles;
  if (
    !isRecord(op) ||
    !['bigChecks', 'dealFlow', 'lpDarling'].every((k) => {
      const v = op[k];
      return isRecord(v) && isNonEmptyString(v.label) && isNonEmptyString(v.blurb);
    })
  ) {
    errors.push('lines.json: "offerProfiles" needs { label, blurb } for bigChecks / dealFlow / lpDarling');
  }

  const jb = data.jobs;
  if (!isRecord(jb) || !isNonEmptyString(jb.nextOffer)) {
    errors.push('lines.json: "jobs" needs a nextOffer label');
  }

  const lr = data.lpRequests;
  if (
    !isRecord(lr) ||
    !isNonEmptyString(lr.title) ||
    !isNonEmptyString(lr.stampMet) ||
    !isNonEmptyString(lr.stampBroken) ||
    !isNonEmptyString(lr.brokenToast) ||
    !isNonEmptyString(lr.rewardNote) ||
    !isRecord(lr.kinds) ||
    !LP_REQUEST_KINDS.every((k) => isStringArray((lr.kinds as Record<string, unknown>)[k]))
  ) {
    errors.push(
      `lines.json: "lpRequests" needs title / stampMet / stampBroken / brokenToast / rewardNote and non-empty kinds.{${LP_REQUEST_KINDS.join(',')}}`,
    );
  }

  if (isRecord(lr) && isRecord(lr.kinds)) {
    for (const k of LP_REQUEST_KINDS) {
      const pool = (lr.kinds as Record<string, unknown>)[k];
      if (!Array.isArray(pool)) continue;
      for (const t of pool) {
        const shown = String(t).replace(/\{[a-z]+\}/g, '00');
        if (shown.length > MAX_LP_REQUEST_CHARS) {
          errors.push(
            `lines.json: lpRequests.kinds.${k} "${String(t)}" is ${shown.length} chars (max ${MAX_LP_REQUEST_CHARS}, one line)`,
          );
        }
      }
    }
  }

  return { lines: errors.length > 0 ? null : (data as unknown as FlavorLines), errors };
}
