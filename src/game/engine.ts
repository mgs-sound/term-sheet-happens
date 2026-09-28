/**
 * The run engine: a pure reducer over GameState. Deterministic given
 * (seed, career state, action sequence) — the RNG stream position lives in
 * state.rngState, so `reduce` has no hidden inputs.
 *
 * Flow: meeting -> (negotiation) -> resolved -> ADVANCE -> (interrupt) ->
 * next meeting ... -> CLOSE_FUND -> HARVEST.
 */

import { createRng, type RNG } from './rng.ts';
import type {
  Action,
  CareerState,
  EngineContent,
  GameEvent,
  GameEventKind,
  GameState,
  HarvestCompanyResult,
  InterruptEvent,
  PortfolioCompany,
} from './types.ts';
import { buildDeck } from './deck.ts';
import { generateFirmName, findThesis, pickThesis } from './firm.ts';
import { clampMeter } from './meters.ts';
import { rollFundITerms } from './fundTerms.ts';
import {
  acceptanceProbability,
  entryBonus,
  makeCounter,
  meetsCounter,
  offerBounds,
  rollLowballWalk,
  type Offer,
} from './negotiation.ts';
import { rollBucketMultiple, rollExitBucket } from './exits.ts';
import {
  dilutionFactor,
  makeBridgeEvent,
  makeCapitalCallEvent,
  makeFollowOnEvent,
  ownershipFromCheck,
} from './followons.ts';
import {
  BOARD_SEATS,
  BRIDGE,
  CAPITAL_CALLS,
  CLOCK,
  EXITS,
  FOLLOW_ONS,
  FUND_I,
  FUND_SIZING,
  MEETINGS_BY_TIER,
  REPUTATION,
  TRUST,
  VETO,
} from './tuning.ts';
import { roundM } from './util.ts';

// ---------------------------------------------------------------------------
// Run creation (START_RUN)
// ---------------------------------------------------------------------------

export function createRun(
  career: CareerState,
  seed: number,
  content: EngineContent,
): GameState {
  const rng = createRng(seed);
  const isFundI = career.fundIndex === 1;
  // Fund I: size / meetings / starting trust come from one difficulty dial
  // (own salted RNG — see fundTerms.ts). Fund II+: from the career.
  const fundITerms = isFundI ? rollFundITerms(seed) : null;
  const meetingsTotal = fundITerms ? fundITerms.meetings : MEETINGS_BY_TIER[career.tier];

  const fundSizeM = fundITerms
    ? fundITerms.sizeM
    : roundM(
        career.pendingFund?.sizeM ??
          career.nextFundSizeM ??
          FUND_SIZING[`${career.tier}BaseM`],
      );

  // Always draw the generated name so the rng stream is identical whether or
  // not a GP-chosen name overrides it.
  const generatedName = generateFirmName(rng, content.firmNames);
  const firmName = career.pendingFirmName ?? generatedName;
  const thesis =
    (career.pendingFund && findThesis(content.theses, career.pendingFund.thesisId)) ||
    pickThesis(rng, content.theses);

  const deck = buildDeck(rng, content.pitches, thesis, {
    count: meetingsTotal,
    fundI: isFundI,
  });

  return {
    phase: 'meeting',
    seed,
    rngState: rng.getState(),
    tier: career.tier,
    isFundI,
    fundIndex: career.fundIndex,
    firmName,
    thesis,
    fundSizeM,
    capitalM: fundSizeM,
    reputation: clampMeter(career.reputation),
    lpTrust: clampMeter(career.lpTrust + (fundITerms?.lpTrustOffset ?? 0)),
    ...(fundITerms ? { fundIDifficulty: fundITerms.difficulty } : {}),
    meetingsTotal,
    meetingIndex: 0,
    quarter: 1,
    deck,
    deckIndex: 1,
    currentCard: deck[0] ?? null,
    resolution: null,
    negotiation: null,
    interrupt: null,
    portfolio: [],
    vetoed: [],
    passStreak: 0,
    lastCapitalCallQuarter: 0,
    events: [],
    harvest: null,
  };
}

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

export function reduce(state: GameState | null, action: Action): GameState {
  if (action.type === 'START_RUN') {
    return createRun(action.career, action.seed, action.content);
  }
  if (!state) throw new Error(`Cannot ${action.type} before START_RUN`);

  const s = structuredClone(state) as GameState;
  const rng = createRng(s.rngState);

  switch (action.type) {
    case 'PASS':
      handlePass(s);
      break;
    case 'SIGN_AT_ASK':
      handleSignAtAsk(s, rng, action.boardSeat === true);
      break;
    case 'OPEN_NEGOTIATION':
      handleOpenNegotiation(s);
      break;
    case 'SEND_OFFER':
      handleSendOffer(s, rng, {
        checkM: action.checkM,
        valuationM: action.valuationM,
        boardSeat: action.boardSeat === true,
      });
      break;
    case 'WALK_AWAY':
      handleWalkAway(s);
      break;
    case 'RESOLVE_INTERRUPT':
      handleResolveInterrupt(s, action.accept);
      break;
    case 'ADVANCE':
      handleAdvance(s, rng);
      break;
    case 'CLOSE_FUND':
      handleCloseFund(s);
      break;
    case 'HARVEST':
      handleHarvest(s, rng, action.push ?? []);
      break;
  }

  s.rngState = rng.getState();
  return s;
}

// ---------------------------------------------------------------------------
// Guards & helpers
// ---------------------------------------------------------------------------

function requireOpenCard(s: GameState, what: string): void {
  if (s.phase !== 'meeting' || !s.currentCard || s.resolution !== null) {
    throw new Error(`${what}: no unresolved card (phase=${s.phase})`);
  }
}

function log(s: GameState, kind: GameEventKind, extra?: Partial<GameEvent>): void {
  s.events.push({ meeting: s.meetingIndex, kind, ...extra });
}

function bumpRep(s: GameState, delta: number): void {
  s.reputation = clampMeter(s.reputation + delta);
}

function bumpTrust(s: GameState, delta: number): void {
  s.lpTrust = clampMeter(s.lpTrust + delta);
}

// ---------------------------------------------------------------------------
// Meeting resolutions
// ---------------------------------------------------------------------------

function handlePass(s: GameState): void {
  requireOpenCard(s, 'PASS');
  s.resolution = 'passed';
  applyPassStreak(s);
  log(s, 'passed', { company: s.currentCard?.name });
}

function applyPassStreak(s: GameState): void {
  s.passStreak += 1;
  if (s.passStreak > REPUTATION.passStreakThreshold) {
    bumpRep(s, REPUTATION.passDecayDelta);
    log(s, 'zombieJab');
  }
}

function vetoProbability(s: GameState, card: { onThesis: boolean; traction: number }): number {
  if (s.tier !== 'associate') return 0;
  let p = s.isFundI ? FUND_I.vetoBase : VETO.associateBase;
  if (!card.onThesis) p += VETO.offThesisBonus;
  if (card.traction <= VETO.lowTractionMax) p += VETO.lowTractionBonus;
  return p;
}

/** Common path once founder-side terms are agreed: veto check, then invest. */
function completeSigning(
  s: GameState,
  rng: RNG,
  terms: { checkM: number; dealValuationM: number; boardSeat: boolean },
): void {
  const card = s.currentCard;
  if (!card) throw new Error('completeSigning without a card');

  if (rng.chance(vetoProbability(s, card))) {
    s.vetoed.push({ card, atMeeting: s.meetingIndex });
    s.resolution = 'vetoed';
    s.negotiation = null;
    bumpRep(s, REPUTATION.vetoDelta);
    log(s, 'vetoed', { company: card.name });
    return;
  }

  const company: PortfolioCompany = {
    // Shallow content pools can repeat a pitch within one deck, so the
    // portfolio id must be per-signing, not per-pitch.
    companyId: `${card.pitchId}@m${s.meetingIndex}`,
    card,
    investedM: terms.checkM,
    initialCheckM: terms.checkM,
    dealValuationM: terms.dealValuationM,
    ownership: ownershipFromCheck(terms.checkM, terms.dealValuationM),
    entryBonus: entryBonus(card.valuationM, terms.dealValuationM),
    boardSeat: terms.boardSeat,
    signedAtMeeting: s.meetingIndex,
    followOnEvents: 0,
    bridged: false,
    status: 'active',
  };
  s.portfolio.push(company);
  s.capitalM = roundM(s.capitalM - terms.checkM);
  s.resolution = 'signed';
  s.negotiation = null;
  s.passStreak = 0;

  bumpRep(s, REPUTATION.signDelta);
  if (card.heat >= REPUTATION.hotDealHeatMin) {
    bumpRep(s, REPUTATION.hotDealDelta);
    log(s, 'hotDeal', { company: card.name });
  }
  bumpTrust(s, card.onThesis ? TRUST.onThesisSignDelta : TRUST.offThesisSignDelta);
  log(s, 'signed', { company: card.name, amountM: terms.checkM });
}

function handleSignAtAsk(s: GameState, rng: RNG, boardSeat: boolean): void {
  requireOpenCard(s, 'SIGN_AT_ASK');
  const card = s.currentCard as NonNullable<typeof s.currentCard>;
  if (card.askM > s.capitalM) {
    throw new Error(`SIGN_AT_ASK: check ${card.askM}M exceeds capital ${s.capitalM}M`);
  }
  if (boardSeat && !allowsBoardSeats(s)) {
    throw new Error('SIGN_AT_ASK: board seats unlock at Partner+');
  }
  if (boardSeat && rng.chance(BOARD_SEATS.signAtAskWalkChance)) {
    s.resolution = 'founderWalked';
    log(s, 'founderWalked', { company: card.name });
    return;
  }
  completeSigning(s, rng, {
    checkM: card.askM,
    dealValuationM: card.valuationM,
    boardSeat,
  });
}

function allowsBoardSeats(s: GameState): boolean {
  return !s.isFundI && (s.tier === 'partner' || s.tier === 'gp');
}

// ---------------------------------------------------------------------------
// Negotiation
// ---------------------------------------------------------------------------

function handleOpenNegotiation(s: GameState): void {
  requireOpenCard(s, 'OPEN_NEGOTIATION');
  if (s.isFundI) throw new Error('OPEN_NEGOTIATION: Fund I is sign-at-ask only');
  s.phase = 'negotiation';
  s.negotiation = { round: 0, counter: null };
}

function handleSendOffer(s: GameState, rng: RNG, offer: Offer): void {
  if (s.phase !== 'negotiation' || !s.negotiation || !s.currentCard) {
    throw new Error('SEND_OFFER: not negotiating');
  }
  const card = s.currentCard;
  const bounds = offerBounds(card);
  if (
    offer.checkM < bounds.checkMinM ||
    offer.checkM > bounds.checkMaxM ||
    offer.valuationM < bounds.valMinM ||
    offer.valuationM > bounds.valMaxM
  ) {
    throw new Error(`SEND_OFFER: offer outside slider bounds for ${card.name}`);
  }
  if (offer.checkM > s.capitalM) {
    throw new Error(`SEND_OFFER: check ${offer.checkM}M exceeds capital ${s.capitalM}M`);
  }
  if (offer.boardSeat && !allowsBoardSeats(s)) {
    throw new Error('SEND_OFFER: board seats unlock at Partner+');
  }

  const negotiation = s.negotiation;
  const accepted =
    meetsCounter(offer, negotiation) ||
    rng.chance(acceptanceProbability(card, offer, negotiation.round));

  if (accepted) {
    s.phase = 'meeting';
    completeSigning(s, rng, {
      checkM: offer.checkM,
      dealValuationM: offer.valuationM,
      boardSeat: offer.boardSeat,
    });
    return;
  }

  if (negotiation.round === 0) {
    if (rollLowballWalk(rng, card, offer)) {
      finishNegotiation(s, 'founderWalked');
      return;
    }
    negotiation.round = 1;
    negotiation.counter = makeCounter(card, offer);
    return;
  }

  // Round 1 rejection: the founder is done with you.
  finishNegotiation(s, 'founderWalked');
}

function finishNegotiation(s: GameState, resolution: 'founderWalked' | 'walkedAway'): void {
  s.phase = 'meeting';
  s.negotiation = null;
  s.resolution = resolution;
  applyPassStreak(s);
  log(s, resolution, { company: s.currentCard?.name });
}

function handleWalkAway(s: GameState): void {
  if (s.phase !== 'negotiation') throw new Error('WALK_AWAY: not negotiating');
  finishNegotiation(s, 'walkedAway');
}

// ---------------------------------------------------------------------------
// Advancing the clock, interrupts, mid-run toasts
// ---------------------------------------------------------------------------

function handleAdvance(s: GameState, rng: RNG): void {
  if (s.phase !== 'meeting' || s.resolution === null) {
    throw new Error(`ADVANCE: nothing resolved to advance past (phase=${s.phase})`);
  }
  s.resolution = null;
  s.currentCard = null;
  s.meetingIndex += 1;
  const newQuarter = 1 + Math.floor(s.meetingIndex / CLOCK.meetingsPerQuarter);
  const quarterTurned = newQuarter !== s.quarter;
  s.quarter = newQuarter;

  if (s.meetingIndex >= s.meetingsTotal) {
    return; // out of meetings; only CLOSE_FUND is legal now
  }

  rollMidRunEvents(s, rng);
  const interrupt = rollInterrupt(s, rng, quarterTurned);
  if (interrupt) {
    s.phase = 'interrupt';
    s.interrupt = interrupt;
    return;
  }
  drawNextCard(s);
}

function drawNextCard(s: GameState): void {
  s.currentCard = s.deck[s.deckIndex] ?? null;
  s.deckIndex += 1;
  s.phase = 'meeting';
  if (!s.currentCard) {
    // Deck exhausted early (shouldn't happen: deck size == meetings).
    s.meetingIndex = s.meetingsTotal;
  }
}

function rollMidRunEvents(s: GameState, rng: RNG): void {
  for (const company of s.portfolio) {
    if (company.status !== 'active') continue;
    if (!rng.chance(EXITS.midRun.perMeetingChance)) continue;
    if (company.card.quality >= EXITS.midRun.markupQualityMin) {
      bumpRep(s, REPUTATION.markupDelta);
      log(s, 'markup', { company: company.card.name });
    } else if (company.card.quality <= EXITS.midRun.shutdownQualityMax) {
      company.status = 'writtenOff';
      bumpRep(s, REPUTATION.shutdownDelta);
      log(s, 'shutdown', { company: company.card.name });
    }
  }
}

function rollInterrupt(
  s: GameState,
  rng: RNG,
  quarterTurned: boolean,
): InterruptEvent | null {
  if (s.isFundI) return null;

  // Capital calls (GP) roll once per quarter boundary, before company events.
  if (
    s.tier === 'gp' &&
    quarterTurned &&
    s.quarter > s.lastCapitalCallQuarter &&
    s.capitalM > 0
  ) {
    s.lastCapitalCallQuarter = s.quarter;
    if (rng.chance(CAPITAL_CALLS.perQuarterChance)) {
      return makeCapitalCallEvent(s.capitalM);
    }
  }

  for (const company of s.portfolio) {
    if (company.status !== 'active') continue;
    const held = s.meetingIndex - company.signedAtMeeting;

    if (
      held >= FOLLOW_ONS.minMeetingsHeld &&
      company.followOnEvents < FOLLOW_ONS.maxPerCompany &&
      rng.chance(FOLLOW_ONS.perMeetingChance)
    ) {
      return makeFollowOnEvent(rng, company);
    }

    if (
      (s.tier === 'partner' || s.tier === 'gp') &&
      !company.bridged &&
      held >= BRIDGE.minMeetingsHeld &&
      company.card.quality < BRIDGE.qualityThreshold &&
      rng.chance(BRIDGE.perMeetingChance)
    ) {
      return makeBridgeEvent(company);
    }
  }
  return null;
}

function handleResolveInterrupt(s: GameState, accept: boolean): void {
  if (s.phase !== 'interrupt' || !s.interrupt) {
    throw new Error('RESOLVE_INTERRUPT: no interrupt pending');
  }
  const event = s.interrupt;

  if (event.kind === 'followOn') {
    const company = mustFindCompany(s, event.companyId);
    company.followOnEvents += 1;
    if (accept) {
      if (event.proRataCostM > s.capitalM) {
        throw new Error('RESOLVE_INTERRUPT: cannot afford pro rata');
      }
      s.capitalM = roundM(s.capitalM - event.proRataCostM);
      company.investedM = roundM(company.investedM + event.proRataCostM);
      log(s, 'followOnTaken', { company: company.card.name, amountM: event.proRataCostM });
    } else {
      company.ownership *= dilutionFactor(event.newPreM, event.raiseM);
      log(s, 'followOnDeclined', { company: company.card.name });
    }
  } else if (event.kind === 'bridge') {
    const company = mustFindCompany(s, event.companyId);
    if (accept) {
      if (event.costM > s.capitalM) {
        throw new Error('RESOLVE_INTERRUPT: cannot afford bridge');
      }
      s.capitalM = roundM(s.capitalM - event.costM);
      company.investedM = roundM(company.investedM + event.costM);
      company.bridged = true;
      company.card.quality = Math.min(1, company.card.quality + BRIDGE.qualityBoost);
      log(s, 'bridgeTaken', { company: company.card.name, amountM: event.costM });
    } else {
      company.status = 'writtenOff';
      log(s, 'bridgeDeclined', { company: company.card.name });
    }
  } else {
    // capitalCall: press the LP (keep capital, lose trust) or eat the loss.
    if (accept) {
      bumpTrust(s, CAPITAL_CALLS.pressTrustDelta);
      log(s, 'capitalCallPressed', { amountM: event.amountM });
    } else {
      s.capitalM = roundM(s.capitalM - event.amountM);
      log(s, 'capitalCallEaten', { amountM: event.amountM });
    }
  }

  s.interrupt = null;
  drawNextCard(s);
}

function mustFindCompany(s: GameState, companyId: string): PortfolioCompany {
  const company = s.portfolio.find((c) => c.companyId === companyId);
  if (!company) throw new Error(`No portfolio company ${companyId}`);
  return company;
}

// ---------------------------------------------------------------------------
// Fund close & harvest
// ---------------------------------------------------------------------------

function handleCloseFund(s: GameState): void {
  if (s.phase !== 'meeting' || s.currentCard !== null || s.resolution !== null) {
    throw new Error('CLOSE_FUND: resolve the current card first');
  }
  if (s.meetingIndex < s.meetingsTotal) {
    throw new Error('CLOSE_FUND: meetings remain');
  }
  s.phase = 'fundClosed';
}

function handleHarvest(s: GameState, rng: RNG, push: string[]): void {
  if (s.phase !== 'fundClosed') throw new Error('HARVEST: fund is not closed');
  const pushSet = new Set(push);
  for (const id of pushSet) {
    const company = mustFindCompany(s, id);
    if (!company.boardSeat) {
      throw new Error(`HARVEST: cannot push ${id} without a board seat`);
    }
  }

  const companies: HarvestCompanyResult[] = [];
  let returnedM = 0;
  let unicorns = 0;
  let visionaries = 0;

  for (const company of s.portfolio) {
    const result = resolveCompany(rng, company, pushSet.has(company.companyId));
    companies.push(result);
    returnedM += result.proceedsM;
    if (result.bucket === 'unicorn') unicorns += 1;
    if (!result.onThesis && (result.bucket === 'win' || result.bucket === 'unicorn')) {
      visionaries += 1;
      bumpRep(s, REPUTATION.visionaryDelta);
      log(s, 'visionary', { company: result.name });
    }
    if (result.bucket === 'win') bumpRep(s, REPUTATION.harvestWinDelta);
    if (result.bucket === 'unicorn') bumpRep(s, REPUTATION.harvestUnicornDelta);
    if (result.bucket === 'zero') bumpRep(s, REPUTATION.harvestBustDelta);
  }

  // The heartbreak check: would any vetoed company have gone unicorn?
  let vetoedUnicorns = 0;
  for (const record of s.vetoed) {
    if (rollExitBucket(rng, record.card.quality) === 'unicorn') {
      vetoedUnicorns += 1;
      log(s, 'vetoHeartbreak', { company: record.card.name });
    }
  }

  returnedM = roundM(returnedM);
  s.harvest = {
    companies,
    returnedM,
    dpi: returnedM / s.fundSizeM,
    unicorns,
    vetoedUnicorns,
    visionaries,
  };
  s.phase = 'harvested';
}

function resolveCompany(
  rng: RNG,
  company: PortfolioCompany,
  pushed: boolean,
): HarvestCompanyResult {
  const base: Omit<HarvestCompanyResult, 'bucket' | 'proceedsM'> = {
    companyId: company.companyId,
    name: company.card.name,
    sector: company.card.sector,
    onThesis: company.card.onThesis,
    investedM: company.investedM,
  };

  if (company.status === 'writtenOff') {
    return { ...base, bucket: 'zero', proceedsM: 0 };
  }

  const bucket = rollExitBucket(rng, company.card.quality);
  let multiple = rollBucketMultiple(rng, bucket) * company.entryBonus;
  let boardPush: HarvestCompanyResult['boardPush'];

  // Board-seat exit timing: push the exit — it improves, or it zeroes.
  if (pushed && bucket !== 'zero') {
    if (rng.chance(BOARD_SEATS.pushImproveChance)) {
      multiple *= BOARD_SEATS.pushMultiplier;
      boardPush = 'improved';
    } else {
      multiple = 0;
      boardPush = 'zeroed';
    }
  }

  return {
    ...base,
    bucket,
    proceedsM: roundM(company.investedM * multiple),
    ...(boardPush ? { boardPush } : {}),
  };
}
