/**
 * Deck building: pick pitches ~60/40 on/off thesis, roll visible stats, and
 * derive hidden quality. All draws come from the injected RNG in a fixed
 * order, so decks are fully determined by (seed, career, content).
 */

import type { Pitch, Thesis } from '../content/types.ts';
import type { RNG } from './rng.ts';
import type { PitchCard, Stage } from './types.ts';
import { DEAL_SHAPE, DECK, FUND_I, QUALITY, STAGES } from './tuning.ts';
import { clamp01, roundM, weightedIndex } from './util.ts';

const STAGE_ORDER: Stage[] = ['preSeed', 'seed', 'seriesA', 'seriesB'];

function rollStage(rng: RNG, fundI: boolean): Stage {
  const w = fundI ? FUND_I.stageWeights : DECK.stageWeights;
  const weights = STAGE_ORDER.map((s) => w[s]);
  return STAGE_ORDER[weightedIndex(rng, weights)] as Stage;
}

function rollStat(rng: RNG): number {
  return 1 + weightedIndex(rng, DECK.statWeights);
}

function rollHeat(rng: RNG): number {
  return 1 + weightedIndex(rng, DECK.heatWeights);
}

/** Hidden quality = f(team, traction, noise), with Fund I stacking applied. */
export function rollQuality(
  rng: RNG,
  team: number,
  traction: number,
  fundI: boolean,
): number {
  const noise = rng.float(-QUALITY.noiseAmp, QUALITY.noiseAmp);
  let q =
    QUALITY.base +
    QUALITY.teamWeight * ((team - 1) / 4) +
    QUALITY.tractionWeight * ((traction - 1) / 4) +
    noise;
  if (fundI) q = Math.min(q + FUND_I.qualityShift, FUND_I.qualityCap);
  return clamp01(q);
}

/** Roll stats onto one editorial pitch. Draw order is part of determinism. */
export function rollCard(
  rng: RNG,
  pitch: Pitch,
  onThesis: boolean,
  fundI: boolean,
): PitchCard {
  const stage = rollStage(rng, fundI);
  const shape = STAGES[stage];
  const team = rollStat(rng);
  const traction = rollStat(rng);
  const heat = rollHeat(rng);

  const arrJitter = rng.float(DEAL_SHAPE.arrJitterMin, DEAL_SHAPE.arrJitterMax);
  const arrK = Math.round(
    shape.arrBaseK * Math.pow(DEAL_SHAPE.arrTractionFactor, traction - 3) * arrJitter,
  );

  const askM = roundM(rng.float(shape.askMinM, shape.askMaxM));
  const heatFactor =
    1 + (heat - DEAL_SHAPE.heatNeutral) * DEAL_SHAPE.heatValFactorPerPoint;
  const valuationM = roundM(rng.float(shape.valMinM, shape.valMaxM) * heatFactor);

  const quality = rollQuality(rng, team, traction, fundI);

  return {
    pitchId: pitch.id,
    name: pitch.name,
    idea: pitch.idea,
    sector: pitch.sector,
    stage,
    team,
    traction,
    arrK,
    heat,
    askM,
    valuationM,
    onThesis,
    quality,
  };
}

/**
 * Build a deck of `count` cards. On-thesis pool is pitches in the thesis's
 * two sectors. If a pool runs dry (content is still growing toward 400),
 * it reshuffles and repeats — acceptable until the pool is deep enough.
 */
export function buildDeck(
  rng: RNG,
  pitches: readonly Pitch[],
  thesis: Thesis,
  opts: { count: number; fundI: boolean },
): PitchCard[] {
  const onPool = rng.shuffle(pitches.filter((p) => thesis.sectors.includes(p.sector)));
  const offPool = rng.shuffle(pitches.filter((p) => !thesis.sectors.includes(p.sector)));
  if (onPool.length === 0 || offPool.length === 0) {
    throw new Error(`Deck build failed: empty pitch pool for thesis ${thesis.id}`);
  }

  const onCount = Math.round(opts.count * DECK.onThesisRatio);
  const slots: boolean[] = [];
  for (let i = 0; i < opts.count; i++) slots.push(i < onCount);
  const shuffledSlots = rng.shuffle(slots);

  let onIdx = 0;
  let offIdx = 0;
  const deck: PitchCard[] = [];
  for (const onThesis of shuffledSlots) {
    const pool = onThesis ? onPool : offPool;
    let idx = onThesis ? onIdx++ : offIdx++;
    idx %= pool.length; // wrap when content pool is shallow
    deck.push(rollCard(rng, pool[idx] as Pitch, onThesis, opts.fundI));
  }
  return deck;
}
