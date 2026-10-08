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
  ChallengeCall,
  ChallengeGame,
  CoinSide,
  DiceCall,
  HighLowCall,
  StickCall,
  VetoChallenge,
  InterruptEvent,
  PlayingCard,
  PortfolioCompany,
} from './types.ts';
import { CHALLENGE_GAMES, FINAL_OFFER_GAMES, SUITS } from './types.ts';
import type { CraneFlight, FinalOfferChallenge, FinalOfferGame } from './types.ts';
import { buildDeck } from './deck.ts';
import { generateFirmName, findThesis, pickThesis } from './firm.ts';
import { clampMeter } from './meters.ts';
import {
  bigFundTerms,
  offerProfileFor,
  offerSwingFor,
  rollFundITerms,
  tierBelow,
} from './fundTerms.ts';
import { rollLpRequests, settleLpRequests, updateLiveLpRequests } from './lpRequests.ts';
import { flappyAt, makeFlappyCourse } from './flappy.ts';
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
  HIGH_LOW,
  STICKS,
  REPUTATION,
  TRUST,
  VETO,
  LP_REQUESTS,
  OFFER_PROFILES,
  SWORD_PULL,
  FINAL_OFFER,
  WHEEL,
  WHEEL_VISIBLE_MS,
  CRANE,
  CRANE_GO_MS,
} from './tuning.ts';
import { roundM } from './util.ts';
import { meetingsForCareer } from './career.ts';

// ---------------------------------------------------------------------------
// Run creation (START_RUN)
// ---------------------------------------------------------------------------

// Lives in career.ts (stayOption sizes the fund by it); re-exported here.
export { meetingsForCareer };

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
  // Fund II+: the career sets the base; the offer profile bends it.
  const offerProfile = offerProfileFor(career, seed);
  const bend = offerProfile ? OFFER_PROFILES[offerProfile] : null;
  // ...and the surprise-box swing on top (neutral without a profile).
  const swing = offerSwingFor(career, seed);
  // Mega fund: you join a rung down the ladder.
  const tier = offerProfile === 'megaFund' ? tierBelow(career.tier) : career.tier;
  const meetingsTotal = fundITerms
    ? fundITerms.meetings
    : Math.round(meetingsForCareer(career) * (bend?.meetingsMult ?? 1));

  const fundSizeM = fundITerms
    ? fundITerms.sizeM
    : roundM(
        (career.pendingFund?.sizeM ??
          career.nextFundSizeM ??
          FUND_SIZING[`${career.tier}BaseM`]) *
          (bend?.sizeMult ?? 1) *
          swing.sizeMult,
      );

  // Always draw the generated name so the rng stream is identical whether or
  // not a GP-chosen name overrides it.
  const generatedName = generateFirmName(rng, content.firmNames);
  const firmName = career.pendingFirmName ?? generatedName;
  const thesis =
    (career.pendingFund && findThesis(content.theses, career.pendingFund.thesisId)) ||
    pickThesis(rng, content.theses);

  // Big funds write bigger checks (same ownership, same multiples), so the
  // money is deployable; their LPs ask for more in return (BIG_FUNDS).
  const big = isFundI
    ? { checkScale: 1, pressure: 0 }
    : bigFundTerms(fundSizeM, meetingsTotal, tier);
  const deck = buildDeck(rng, content.pitches, thesis, {
    count: meetingsTotal,
    fundI: isFundI,
  }).map((c) =>
    big.checkScale > 1
      ? {
          ...c,
          askM: roundM(c.askM * big.checkScale),
          valuationM: roundM(c.valuationM * big.checkScale),
          arrK: Math.round(c.arrK * big.checkScale),
        }
      : c,
  );

  return {
    phase: 'meeting',
    seed,
    rngState: rng.getState(),
    tier,
    isFundI,
    fundIndex: career.fundIndex,
    firmName,
    thesis,
    fundSizeM,
    capitalM: fundSizeM,
    reputation: clampMeter(career.reputation),
    lpTrust: clampMeter(
      career.lpTrust +
        (fundITerms?.lpTrustOffset ?? 0) +
        (bend?.trustDelta ?? 0) +
        swing.trustDelta,
    ),
    ...(fundITerms ? { fundIDifficulty: fundITerms.difficulty } : {}),
    ...(offerProfile ? { offerProfile } : {}),
    ...(big.checkScale > 1 ? { checkScale: big.checkScale } : {}),
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
    lpRequests: rollLpRequests(seed, isFundI, tier, big.pressure),
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
    case 'RESOLVE_VETO_CHALLENGE':
      handleResolveVetoChallenge(s, rng, action.call);
      break;
    case 'RESOLVE_SWORD_PULL':
      handleResolveSwordPull(s, rng, action.taps);
      break;
    case 'RESOLVE_WHEEL':
      handleResolveWheel(s, rng, action.elapsedMs);
      break;
    case 'RESOLVE_CRANE':
      handleResolveCrane(s, rng, action.shotsMs);
      break;
    case 'RESOLVE_FLAPPY':
      handleResolveFlappy(s, rng, action.tapsMs);
      break;
    case 'HARVEST':
      handleHarvest(s, rng);
      break;
  }

  // LP requests: anything this action just violated breaks on the spot.
  if (s.phase !== 'harvested') {
    for (const request of updateLiveLpRequests(s)) log(s, 'lpRequestBroken', { request });
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
    if (rng.chance(VETO.challengeChance)) {
      // The partner would rather settle it on a minigame. Park the terms.
      s.phase = 'vetoChallenge';
      const game = pickChallengeGame(rng);
      s.vetoChallenge =
        game === 'highLow' ? { ...terms, game, shown: drawCard(rng) } : { ...terms, game };
      s.negotiation = null;
      log(s, 'vetoChallenge', { company: card.name });
      return;
    }
    applyVeto(s, card);
    return;
  }

  invest(s, card, terms);
}

function applyVeto(s: GameState, card: NonNullable<GameState['currentCard']>): void {
  s.vetoed.push({ card, atMeeting: s.meetingIndex });
  s.resolution = 'vetoed';
  s.negotiation = null;
  bumpRep(s, REPUTATION.vetoDelta);
  log(s, 'vetoed', { company: card.name });
}

export function drawCard(rng: RNG, rank?: number): PlayingCard {
  return {
    rank: rank ?? rng.int(HIGH_LOW.minRank, HIGH_LOW.maxRank),
    suit: rng.pick(SUITS),
  };
}

/** Ranks strictly above / below the shown card (ties are excluded). */
function ranksAround(shown: number): { higher: number[]; lower: number[] } {
  const higher: number[] = [];
  const lower: number[] = [];
  for (let r = HIGH_LOW.minRank; r <= HIGH_LOW.maxRank; r++) {
    if (r > shown) higher.push(r);
    if (r < shown) lower.push(r);
  }
  return { higher, lower };
}

/** Odds a higher/lower call wins against the shown card (no ties). */
export function highLowWinChance(shownRank: number, call: HighLowCall): number {
  const { higher, lower } = ranksAround(shownRank);
  const n = higher.length + lower.length;
  return (call === 'higher' ? higher.length : lower.length) / n;
}

/** Partner's challenge (coin or higher/lower): win it and the parked deal signs. */
function handleResolveVetoChallenge(s: GameState, rng: RNG, call: ChallengeCall): void {
  if (s.phase !== 'vetoChallenge' || !s.vetoChallenge || !s.currentCard) {
    throw new Error('RESOLVE_VETO_CHALLENGE: no challenge pending');
  }
  if (s.vetoChallenge.checkM > s.capitalM) {
    throw new Error('RESOLVE_VETO_CHALLENGE: parked check exceeds capital');
  }
  const game = s.vetoChallenge.game ?? 'coin';
  if (game === 'dice') {
    if (call !== 'even' && call !== 'odd') {
      throw new Error('RESOLVE_VETO_CHALLENGE: the dice need "even" or "odd"');
    }
    resolveDice(s, rng, call);
    return;
  }
  if (game === 'sticks') {
    if (call !== 'red' && call !== 'green') {
      throw new Error('RESOLVE_VETO_CHALLENGE: the sticks need "red" or "green"');
    }
    resolveSticks(s, rng, call);
    return;
  }
  if (game === 'highLow') {
    if (call !== 'higher' && call !== 'lower') {
      throw new Error('RESOLVE_VETO_CHALLENGE: higher/lower needs "higher" or "lower"');
    }
    resolveHighLow(s, rng, call);
    return;
  }
  if (call !== 'heads' && call !== 'tails') {
    throw new Error('RESOLVE_VETO_CHALLENGE: the coin needs "heads" or "tails"');
  }
  // Decide the WIN first, then show the face that matches. Statistically the
  // same fair 50/50 as a free-landing coin, but reload-proof: replaying the
  // same moment gives the same verdict whichever side you call, so a reload
  // can't be used to learn the face and pick it.
  const won = rng.chance(VETO.coinWinChance);
  const landed: CoinSide = won ? call : call === 'heads' ? 'tails' : 'heads';
  const terms = s.vetoChallenge;
  s.phase = 'meeting';
  s.vetoChallenge = null;
  s.lastCoinFlip = { call, landed, won };
  if (won) {
    log(s, 'challengeWon', { company: s.currentCard.name });
    invest(s, s.currentCard, terms);
  } else {
    applyVeto(s, s.currentCard);
  }
}

/**
 * Higher/lower. Like the coin, the WIN is decided first (at the honest odds
 * for that call) and the hidden card is then drawn to match — so replaying
 * the same moment after a reload can't reveal the card to exploit.
 */
function resolveHighLow(s: GameState, rng: RNG, call: HighLowCall): void {
  const challenge = s.vetoChallenge;
  const card = s.currentCard;
  if (!challenge?.shown || !card) throw new Error('higher/lower without a shown card');
  const shown = challenge.shown;
  const won = rng.chance(highLowWinChance(shown.rank, call));
  const { higher, lower } = ranksAround(shown.rank);
  const pool = (call === 'higher') === won ? higher : lower;
  // Dealt from the same single suit as the shown card: every rank exists
  // once, which is exactly why a tie can't happen.
  const hidden: PlayingCard = { rank: rng.pick(pool), suit: shown.suit };
  s.phase = 'meeting';
  s.vetoChallenge = null;
  s.lastHighLow = { call, shown, hidden, won };
  if (won) {
    log(s, 'challengeWon', { company: card.name });
    invest(s, card, challenge);
  } else {
    applyVeto(s, card);
  }
}

/** Weighted pick of which minigame the partner proposes. */
export function pickChallengeGame(rng: RNG): ChallengeGame {
  const w = VETO.challengeWeights;
  const total = CHALLENGE_GAMES.reduce((sum, g) => sum + w[g], 0);
  let roll = rng.next() * total;
  for (const g of CHALLENGE_GAMES) {
    roll -= w[g];
    if (roll < 0) return g;
  }
  return 'coin';
}

/** Close out any challenge: sign the parked deal on a win, veto on a loss. */
function settleChallenge(s: GameState, won: boolean, terms: VetoChallenge): void {
  const card = s.currentCard;
  if (!card) throw new Error('settleChallenge without a card');
  s.phase = 'meeting';
  s.vetoChallenge = null;
  if (won) {
    log(s, 'challengeWon', { company: card.name });
    invest(s, card, terms);
  } else {
    applyVeto(s, card);
  }
}

/**
 * Even/odd. Win decided first (reload-proof, like the coin), then the die
 * shows a face of the matching parity.
 */
function resolveDice(s: GameState, rng: RNG, call: DiceCall): void {
  const terms = s.vetoChallenge as VetoChallenge;
  const won = rng.chance(VETO.diceWinChance);
  const evenLands = (call === 'even') === won;
  const roll = rng.pick(evenLands ? [2, 4, 6] : [1, 3, 5]);
  s.lastDice = { call, roll, won };
  settleChallenge(s, won, terms);
}

/**
 * Longest stick. Win decided first, then lengths drawn so the called stick is
 * (or isn't) the longer one by a clearly visible margin.
 */
function resolveSticks(s: GameState, rng: RNG, call: StickCall): void {
  const terms = s.vetoChallenge as VetoChallenge;
  const won = rng.chance(VETO.sticksWinChance);
  const long = rng.int(STICKS.longMin, STICKS.longMax);
  const short = rng.int(STICKS.shortMin, long - STICKS.minGap);
  const redWins = (call === 'red') === won;
  const red = redWins ? long : short;
  const green = redWins ? short : long;
  s.lastSticks = { call, red, green, won };
  settleChallenge(s, won, terms);
}

/** The deal closes: money out, company in. */
function invest(
  s: GameState,
  card: NonNullable<GameState['currentCard']>,
  terms: { checkM: number; dealValuationM: number; boardSeat: boolean },
): void {
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
  // Partner+ final offer under the counter: skill, not dice (FINAL_OFFER).
  if (negotiation.round === 1 && s.tier !== 'associate' && !meetsCounter(offer, negotiation)) {
    s.phase = 'finalOffer';
    s.finalOffer = makeFinalOffer(rng, offer, acceptanceProbability(card, offer, 1));
    return;
  }
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

const lerp = (a: number, b: number, t: number): number => a + (b - a) * Math.max(0, Math.min(1, t));

/** Taps the sword takes: fewer the more acceptable the offer was. */
export function swordTargetTaps(acceptance: number): number {
  return Math.round(lerp(SWORD_PULL.tapsAtHopeless, SWORD_PULL.tapsAtCertain, acceptance));
}

/** The wheel's yellow slice (degrees): wider the more acceptable the offer. */
export function wheelSliceDeg(acceptance: number): number {
  return Math.round(lerp(WHEEL.sliceDegAtHopeless, WHEEL.sliceDegAtCertain, acceptance));
}

/** Weighted pick of the final-offer minigame. */
function pickFinalOfferGame(rng: RNG): FinalOfferGame {
  const w = FINAL_OFFER.gameWeights;
  const total = FINAL_OFFER_GAMES.reduce((sum, g) => sum + w[g], 0);
  let roll = rng.next() * total;
  for (const g of FINAL_OFFER_GAMES) {
    roll -= w[g];
    if (roll < 0) return g;
  }
  return 'sword';
}

export function makeFinalOffer(
  rng: RNG,
  offer: { checkM: number; valuationM: number; boardSeat: boolean },
  acceptance: number,
  game: FinalOfferGame = pickFinalOfferGame(rng),
): FinalOfferChallenge {
  return {
    game,
    checkM: offer.checkM,
    valuationM: offer.valuationM,
    boardSeat: offer.boardSeat,
    targetTaps: swordTargetTaps(acceptance),
    sliceDeg: wheelSliceDeg(acceptance),
    // Where the slice starts; the pointer sits at 0° (top).
    startDeg: rng.int(WHEEL.startMinDeg, WHEEL.startMaxDeg),
    ...craneTiming(rng, acceptance),
    flappy: makeFlappyCourse(rng, acceptance),
  };
}

/** The cranes' schedule: each flight with its peeks, and the hit window. */
function craneTiming(rng: RNG, acceptance: number): { cranes: CraneFlight[]; windowMs: number } {
  const cranes: CraneFlight[] = [];
  let free = CRANE_GO_MS; // when the stage is clear (after GO / last landing)
  CRANE.flightsMs.forEach((flightMs, i) => {
    const takeoffMs =
      i === 0
        ? free + rng.int(CRANE.firstTakeoffMinMs, CRANE.firstTakeoffMaxMs)
        : free + rng.int(CRANE.gapMinMs, CRANE.gapMaxMs);
    const [lo, hi] = i === 0 ? CRANE.peeksFirst : CRANE.peeksLater;
    const peeks = rng.int(lo, hi);
    const earliest = free + CRANE.peekLeadMs;
    const latest = takeoffMs - CRANE.peekLeadMs;
    const drawn =
      latest > earliest
        ? Array.from({ length: peeks }, () => rng.int(earliest, latest)).sort((a, b) => a - b)
        : [];
    // Distinct peeks only: one that would overlap the previous is dropped.
    const peeksMs = drawn.filter((p, j) => j === 0 || p - drawn[j - 1]! > CRANE.peekMs + 150);
    // Alternate bushes so the next one comes from the other side.
    cranes.push({ takeoffMs, flightMs, peeksMs, fromRight: i % 2 === 0 });
    free = takeoffMs + flightMs;
  });
  const windowMs = Math.round(lerp(CRANE.windowMsAtHopeless, CRANE.windowMsAtCertain, acceptance));
  return { cranes, windowMs };
}

/** When a crane crosses the pole (halfway through its flight). */
export function craneCrossMs(crane: CraneFlight): number {
  return crane.takeoffMs + crane.flightMs / 2;
}

/** Which cranes a set of shots hit (one shot per crane, null = none). */
export function craneHits(
  cranes: readonly CraneFlight[],
  windowMs: number,
  shotsMs: readonly (number | null)[],
): boolean[] {
  return cranes.map((c, i) => {
    const shot = shotsMs[i];
    return shot !== null && shot !== undefined && Math.abs(shot - craneCrossMs(c)) <= windowMs / 2;
  });
}

/** The wheel's turn (degrees, clockwise) after spinning for `elapsedMs`. */
export function wheelAngleAt(startDeg: number, elapsedMs: number): number {
  const ms = Math.max(0, Math.min(elapsedMs, WHEEL_VISIBLE_MS + WHEEL.maxBlindMs));
  return (startDeg + (WHEEL.degPerSec * ms) / 1000) % 360;
}

/** Does the pointer (top, 0°) sit inside the slice centred on `angleDeg`? */
export function wheelHits(angleDeg: number, sliceDeg: number): boolean {
  const off = Math.abs((((angleDeg % 360) + 540) % 360) - 180);
  return off <= sliceDeg / 2;
}

function settleFinalOffer(s: GameState, rng: RNG, challenge: FinalOfferChallenge, won: boolean): void {
  const card = s.currentCard;
  if (!card) throw new Error('final offer without a card');
  s.finalOffer = null;
  if (!won) {
    finishNegotiation(s, 'founderWalked');
    return;
  }
  s.phase = 'meeting';
  s.negotiation = null;
  log(s, 'challengeWon', { company: card.name });
  completeSigning(s, rng, {
    checkM: challenge.checkM,
    dealValuationM: challenge.valuationM,
    boardSeat: challenge.boardSeat,
  });
}

function requireFinalOffer(s: GameState, game: FinalOfferGame, action: string): FinalOfferChallenge {
  const c = s.finalOffer;
  if (s.phase !== 'finalOffer' || !c || c.game !== game || !s.currentCard) {
    throw new Error(`${action}: no ${game} final offer pending`);
  }
  return c;
}

function handleResolveSwordPull(s: GameState, rng: RNG, taps: number): void {
  const c = requireFinalOffer(s, 'sword', 'RESOLVE_SWORD_PULL');
  const won = taps >= c.targetTaps;
  s.lastFinalOffer = { game: 'sword', won, taps, targetTaps: c.targetTaps };
  settleFinalOffer(s, rng, c, won);
}

function handleResolveCrane(s: GameState, rng: RNG, shotsMs: (number | null)[]): void {
  const c = requireFinalOffer(s, 'crane', 'RESOLVE_CRANE');
  const hits = craneHits(c.cranes, c.windowMs, shotsMs);
  const won = hits.filter(Boolean).length >= CRANE.hitsToWin;
  s.lastFinalOffer = { game: 'crane', won, shotsMs, hits };
  settleFinalOffer(s, rng, c, won);
}

function handleResolveFlappy(s: GameState, rng: RNG, tapsMs: number[]): void {
  const c = requireFinalOffer(s, 'flappy', 'RESOLVE_FLAPPY');
  const taps = [...tapsMs].filter((t) => t >= 0).sort((a, b) => a - b);
  const run = flappyAt(c.flappy, taps, Number.POSITIVE_INFINITY);
  s.lastFinalOffer = { game: 'flappy', won: run.finished, tapsMs: taps, passed: run.passed };
  settleFinalOffer(s, rng, c, run.finished);
}

function handleResolveWheel(s: GameState, rng: RNG, elapsedMs: number): void {
  const c = requireFinalOffer(s, 'wheel', 'RESOLVE_WHEEL');
  // STOP only counts once the cover is down (no stopping it in plain sight).
  const stopDeg = wheelAngleAt(c.startDeg, Math.max(elapsedMs, WHEEL_VISIBLE_MS));
  const won = wheelHits(stopDeg, c.sliceDeg);
  s.lastFinalOffer = { game: 'wheel', won, stopDeg, sliceDeg: c.sliceDeg };
  settleFinalOffer(s, rng, c, won);
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

function handleHarvest(s: GameState, rng: RNG): void {
  if (s.phase !== 'fundClosed') throw new Error('HARVEST: fund is not closed');

  const companies: HarvestCompanyResult[] = [];
  let returnedM = 0;
  let unicorns = 0;
  let visionaries = 0;

  for (const company of s.portfolio) {
    const result = resolveCompany(rng, company, unicornScaleFor(s));
    companies.push(result);
    returnedM += result.proceedsM;
    const outcome = result.bucket;
    if (outcome === 'unicorn') unicorns += 1;
    if (!result.onThesis && (outcome === 'win' || outcome === 'unicorn')) {
      visionaries += 1;
      bumpRep(s, REPUTATION.visionaryDelta);
      log(s, 'visionary', { company: result.name });
    }
    if (outcome === 'win') bumpRep(s, REPUTATION.harvestWinDelta);
    if (outcome === 'unicorn') bumpRep(s, REPUTATION.harvestUnicornDelta);
    if (outcome === 'zero') bumpRep(s, REPUTATION.harvestBustDelta);
  }

  // The heartbreak check: would any vetoed company have gone unicorn?
  let vetoedUnicorns = 0;
  for (const record of s.vetoed) {
    if (rollExitBucket(rng, record.card.quality, unicornScaleFor(s)) === 'unicorn') {
      vetoedUnicorns += 1;
      log(s, 'vetoHeartbreak', { company: record.card.name });
    }
  }

  // Board-seat liabilities can eat past the winners: a fund in the red ends
  // the career (see careerEnded).
  returnedM = roundM(returnedM);
  s.harvest = {
    companies,
    returnedM,
    dpi: returnedM / s.fundSizeM,
    unicorns,
    vetoedUnicorns,
    visionaries,
  };
  // LP requests settle with the harvest; each one met buys LP trust.
  bumpTrust(s, settleLpRequests(s) * LP_REQUESTS.metTrustDelta);
  s.phase = 'harvested';
}

/** Fund I keeps unicorns rare: the tutorial is meant to be lost. */
function unicornScaleFor(s: GameState): number {
  return s.isFundI ? FUND_I.unicornWeightMult : 1;
}

function resolveCompany(
  rng: RNG,
  company: PortfolioCompany,
  unicornScale: number,
): HarvestCompanyResult {
  const base: Omit<HarvestCompanyResult, 'bucket' | 'proceedsM'> = {
    companyId: company.companyId,
    name: company.card.name,
    sector: company.card.sector,
    onThesis: company.card.onThesis,
    investedM: company.investedM,
  };
  // Board seat: a bonus on any exit, a liability on a zero (BOARD_SEATS).
  const liability = (): HarvestCompanyResult => ({
    ...base,
    bucket: 'zero',
    proceedsM: company.boardSeat ? -roundM(company.investedM * BOARD_SEATS.zeroPenalty) : 0,
    ...(company.boardSeat ? { boardSeat: 'liability' as const } : {}),
  });

  if (company.status === 'writtenOff') return liability();

  const bucket = rollExitBucket(rng, company.card.quality, unicornScale);
  if (bucket === 'zero') {
    // Keep the stream identical to a non-zero roll's draw count.
    rollBucketMultiple(rng, bucket);
    return liability();
  }
  const multiple =
    rollBucketMultiple(rng, bucket) *
    company.entryBonus *
    (company.boardSeat ? BOARD_SEATS.exitMult : 1);
  return {
    ...base,
    bucket,
    proceedsM: roundM(company.investedM * multiple),
    ...(company.boardSeat ? { boardSeat: 'bonus' as const } : {}),
  };
}
