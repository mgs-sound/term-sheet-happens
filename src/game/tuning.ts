/**
 * tuning.ts — every gameplay constant lives here, and only here.
 *
 * Rules:
 *  - No magic numbers inside game systems; import from this file.
 *  - Values marked TUNE are guesses awaiting playtesting; the monte-carlo
 *    harness (`npm run simulate`) is the tool for adjusting them.
 *  - Units in names: money is millions USD (`M`) unless `K`; probabilities
 *    and ratios are 0..1; meters (reputation, LP trust) are 0..100.
 */

// ---------------------------------------------------------------------------
// Clock
// ---------------------------------------------------------------------------

export const CLOCK = {
  /** Meetings per quarter on the fund clock (cosmetic + capital-call cadence). */
  meetingsPerQuarter: 4,
} as const;

// ---------------------------------------------------------------------------
// Fund structure per career tier
// ---------------------------------------------------------------------------

/** Fund I: the 3-minute doomed tutorial. Simplified rules, stacked deck. */
export const FUND_I = {
  /** Fund size / meetings / starting LP trust come from FUND_I_TERMS below. */
  /** Hidden quality shifted down — the deck is quietly stacked. TUNE */
  qualityShift: -0.15,
  /** No card in Fund I exceeds this quality — no unicorn bait-outs. TUNE */
  qualityCap: 0.7,
  /**
   * Fund I unicorn weight multiplier. The quality cap alone still left ~10%
   * of Fund I runs with a unicorn (and a 2x+ DPI from that one check). TUNE
   */
  unicornWeightMult: 0.2,
  /** Aggressive partner veto base chance (bonuses in VETO still apply). TUNE */
  vetoBase: 0.3,
  /** Fund I sees earlier-stage, smaller-check deals. TUNE */
  stageWeights: { preSeed: 0.4, seed: 0.45, seriesA: 0.15, seriesB: 0 },
} as const;

/**
 * Fund I terms — the "pick your difficulty" reroll on the very first fund.
 * Each reroll draws ONE difficulty dial t in [0, 1) and lerps all three terms
 * from easy to hard together, so rerolling is choosing a difficulty, not
 * slot-machining for max-everything. DPI = returned / fund size and undeployed
 * capital returns nothing, so a bigger fund with fewer meetings is harder.
 * Fund II+ terms come from the career instead (unchanged).
 */
export const FUND_I_TERMS = {
  /** XORed into the run seed for a separate RNG, so rolling terms never
   *  shifts the main stream (firm name / thesis / deck stay seed-stable). */
  rngSalt: 0x7e57,
  sizeM: { easy: 8, hard: 10 },
  meetings: { easy: 20, hard: 10 }, // TUNE — Standard lands ~15, the sweet spot
  /** Added to the career's starting LP trust (METERS.startLpTrust). TUNE */
  lpTrustOffset: { easy: 10, hard: -10 },
  /** Dial cutoffs for the 3 labelled bands: soft < 1/3 <= standard < 2/3 <= brutal. */
  bandCutoffs: [1 / 3, 2 / 3],
} as const;

/**
 * Meetings per fund after Fund I. Growth should FEEL like growth: a repeat
 * Associate (missed 1x) gets a short fund; earning Partner opens the full
 * calendar. 50 felt like a punishment — 40 is the cap. TUNE
 */
/**
 * Higher/lower challenge deck: ONE suit, ranks 2..14 (J=11, Q=12, K=13, A=14).
 * Both cards come from that suit, so each rank exists once — no ties.
 */
export const HIGH_LOW = {
  minRank: 2,
  maxRank: 14,
} as const;

/** Longest-stick challenge: stick lengths as % of the ruler. */
export const STICKS = {
  /** Winner's length range. */
  longMin: 62,
  longMax: 96,
  /** The loser is at least this much shorter, so the verdict reads at a glance. */
  minGap: 14,
  /** Always past the cover's left edge (28% of the stage) so both handles look identical. */
  shortMin: 40,
} as const;

export const MEETINGS_BY_TIER = {
  associate: 25,
  partner: 40,
  gp: 40,
} as const;

/**
 * Your FIRST fund at a new tier is shorter, so the calendar grows as you do:
 * Fund I ~15 → first Partner fund 30 → 40 thereafter. Tiers not listed use
 * MEETINGS_BY_TIER from their first fund. TUNE
 */
export const FIRST_FUND_AT_TIER_MEETINGS = {
  partner: 30,
} as const;

// ---------------------------------------------------------------------------
// Deck building
// ---------------------------------------------------------------------------

export const DECK = {
  /** ~60/40 on/off thesis composition. */
  onThesisRatio: 0.6,
  /** Stage mix for Fund II+ decks. TUNE */
  stageWeights: { preSeed: 0.3, seed: 0.4, seriesA: 0.2, seriesB: 0.1 },
  /** Relative weights for team/traction stats 1..5 (center-weighted). TUNE */
  statWeights: [1, 2, 3, 2.5, 1.5],
  /** Deal heat 1..5 skews warm — everything is "competitive". TUNE */
  heatWeights: [1.5, 2, 2.5, 2, 2],
} as const;

/** Per-stage deal shapes: check the founder asks, pre-money range, ARR base. */
export const STAGES = {
  preSeed: { askMinM: 0.6, askMaxM: 1.2, valMinM: 4, valMaxM: 8, arrBaseK: 0 },
  seed: { askMinM: 1, askMaxM: 2.5, valMinM: 8, valMaxM: 18, arrBaseK: 150 },
  seriesA: { askMinM: 3, askMaxM: 6, valMinM: 20, valMaxM: 45, arrBaseK: 1200 },
  seriesB: { askMinM: 7, askMaxM: 12, valMinM: 50, valMaxM: 120, arrBaseK: 6000 },
} as const;

export const DEAL_SHAPE = {
  /** Heat inflates the asked valuation per point away from neutral. TUNE */
  heatValFactorPerPoint: 0.12,
  heatNeutral: 3,
  /** ARR jitter around the stage/traction base. TUNE */
  arrJitterMin: 0.6,
  arrJitterMax: 1.6,
  /** ARR scales with traction: base * (factor ^ (traction - 3)). TUNE */
  arrTractionFactor: 1.7,
} as const;

/** Hidden quality = base + team + traction + noise, clamped 0..1. TUNE */
export const QUALITY = {
  base: 0.1,
  teamWeight: 0.3, // full weight at team 5
  tractionWeight: 0.35, // full weight at traction 5
  noiseAmp: 0.12, // uniform ±noise
} as const;

// ---------------------------------------------------------------------------
// Meters (0..100)
// ---------------------------------------------------------------------------

export const METERS = {
  min: 0,
  max: 100,
  startReputation: 30,
  startLpTrust: 70,
} as const;

export const REPUTATION = {
  /** Stage lower bounds: index 0..4 -> the 5 ladder stages (labels live in content). */
  stageThresholds: [0, 25, 50, 75, 90],
  signDelta: 1,
  hotDealHeatMin: 4,
  hotDealDelta: 4, // extra on top of signDelta. TUNE
  /** Passing more than this many in a row starts zombie-fund decay. */
  passStreakThreshold: 5,
  passDecayDelta: -2, // per pass beyond the streak threshold. TUNE
  markupDelta: 2,
  shutdownDelta: -2,
  vetoDelta: -1, // getting overruled stings. TUNE
  harvestWinDelta: 6,
  harvestUnicornDelta: 15,
  harvestBustDelta: -1,
  /** Off-thesis deal exits big -> "visionary". TUNE */
  visionaryDelta: 12,
} as const;

export const TRUST = {
  offThesisSignDelta: -8,
  onThesisSignDelta: 2,
  /** Next-fund size multiplier = clamp(base + trust/100 * slope). TUNE */
  sizeMultBase: 0.5,
  sizeMultSlope: 0.8,
  sizeMultMin: 0.5,
  sizeMultMax: 1.3,
} as const;

// ---------------------------------------------------------------------------
// Partner veto (Associate tiers; Fund I uses FUND_I.vetoBase as the base)
// ---------------------------------------------------------------------------

export const VETO = {
  /**
   * When a veto fires, chance the partner instead settles it on a coin flip
   * ("leadership challenge"): call it right and the deal goes through. TUNE
   */
  challengeChance: 2 / 3,
  /** The coin: chance your call is right. A fair one, despite everything. */
  coinWinChance: 0.5,
  /**
   * Which minigame settles a challenge: relative weights. Coin, dice and sticks
   * are pure 50/50; higher/lower rewards a sensible call (~77% played well). TUNE
   */
  challengeWeights: { coin: 1, highLow: 1, dice: 1, sticks: 1 },
  /** Even/odd and longest-stick: chance your call is right. */
  diceWinChance: 0.5,
  sticksWinChance: 0.5,
  associateBase: 0.15,
  offThesisBonus: 0.2,
  /** Traction at or below this counts as "low". */
  lowTractionMax: 2,
  lowTractionBonus: 0.15,
} as const;

// ---------------------------------------------------------------------------
// Negotiation (Fund II+)
// ---------------------------------------------------------------------------

/**
 * Founder acceptance p = clamp(base
 *   + valWeight  * (offeredVal / askedVal - 1)      // generosity on price
 *   + checkWeight * (offeredCheck / askedCheck - 1) // check fit vs ask
 *   - heatPenaltyPerPoint * (heat - heatNeutral)    // hot deals demand more
 *   - boardSeatPenalty (if a seat is demanded)
 *   + counterBonus (round 1 only), min..max).
 * Monotonic: raising valuation or check never lowers p (weights positive).
 */
export const ACCEPTANCE = {
  base: 0.92,
  valWeight: 1.3,
  checkWeight: 0.35,
  heatPenaltyPerPoint: 0.06,
  heatNeutral: 3,
  counterBonus: 0.15,
  min: 0.03,
  max: 0.98,
} as const;

export const NEGOTIATION = {
  /** Exactly one counter round. */
  counterRounds: 1,
  /** Counter lands this fraction of the way back toward the ask. TUNE */
  counterFirmness: 0.65,
  /** Heat pushes counters closer to the ask, per point from neutral. TUNE */
  counterHeatFirmnessPerPoint: 0.05,
  counterFirmnessMin: 0.4,
  counterFirmnessMax: 0.9,
  /** Offers below this valuation ratio risk an immediate walk. TUNE */
  lowballValRatio: 0.6,
  lowballWalkChance: 0.3,
  /** Entry-price exit bonus = (askedVal / dealVal)^0.5, capped to this band. */
  entryBonusExponent: 0.5,
  entryBonusMax: 1.5,
  entryBonusMin: 0.8,
  /** Slider bounds relative to the founder's ask. */
  offerBounds: {
    checkMinRatio: 0.5,
    checkMaxRatio: 1.25,
    valMinRatio: 0.55,
    valMaxRatio: 1.15,
  },
} as const;

// ---------------------------------------------------------------------------
// Board seats (Partner+)
// ---------------------------------------------------------------------------

/**
 * Sword in the stone (Partner+): a final offer that doesn't meet the founder's
 * counter is settled by skill instead of a dice roll. Tap to pull the sword
 * out within the time limit; the taps it takes come from how acceptable the
 * offer was (acceptanceProbability): a fair offer is easier, a lowball is
 * nearly hopeless.
 */
export const SWORD_PULL = {
  /** Time to pull, from the first tap. TUNE */
  durationMs: 5000,
  /** Taps needed at acceptance 1 (a near-certain offer) … TUNE */
  tapsAtCertain: 30,
  /** … and at acceptance 0 (hopeless). Middle offers land ~35–40. TUNE */
  tapsAtHopeless: 44,
} as const;

/** Which skill minigame settles a Partner+ final offer: relative weights. TUNE */
export const FINAL_OFFER = {
  gameWeights: { sword: 1, wheel: 1, crane: 1, flappy: 1 },
} as const;

/**
 * The blind wheel: you see where the yellow slice starts, hit SPIN, a cover
 * drops over the wheel, and you STOP it when you think the slice is under the
 * pointer. Constant speed, so it's timing you can learn. The slice is wider
 * the more acceptable the offer was. TUNE all.
 */
export const WHEEL = {
  /** Spin speed: one turn every 360/degPerSec seconds. */
  degPerSec: 240,
  /** Slice width at acceptance 0 (hopeless) … */
  sliceDegAtHopeless: 24,
  /** … and at acceptance 1 (near-certain). */
  sliceDegAtCertain: 90,
  /** Where the slice may start (never already under the pointer). */
  startMinDeg: 90,
  startMaxDeg: 270,
  /** Turns it spins in plain sight before the cover drops, so you can
   *  read its rhythm (STOP only works once it's covered). */
  visibleTurns: 2,
  /** Never stopped: it stops itself this long after the cover drops. */
  maxBlindMs: 8000,
} as const;

/** How long the wheel stays uncovered (ms): WHEEL.visibleTurns full turns. */
export const WHEEL_VISIBLE_MS = (WHEEL.visibleTurns * 360 * 1000) / WHEEL.degPerSec;

/**
 * Shoot the cranes: the deal is an origami crane hiding in a bush. Three fly,
 * one after another, each in a fast parabola to the other bush across the
 * red pole; one shot per crane, fire as it crosses. The first is a warm-up
 * (slow), the other two are devilishly fast. Hit `hitsToWin` of them. The hit
 * window is wider the more acceptable the offer was. TUNE all.
 */
export const CRANE = {
  /** Each crane's flight, bush to bush (ms); it crosses the pole halfway. */
  flightsMs: [900, 380, 380],
  /** Hits needed (of the three) to sign the deal. */
  hitsToWin: 2,
  /** "Ready, set, go" before anything moves: one word per step (ms each). */
  countdownStepMs: 650,
  countdownSteps: 3,
  /** First takeoff, ms after GO (seeded within this range). */
  firstTakeoffMinMs: 1300,
  firstTakeoffMaxMs: 2400,
  /** Each later takeoff: this long after the previous crane landed. */
  gapMinMs: 1700,
  gapMaxMs: 2800,
  /** Fake-out peeks before each takeoff: every crane teases from its bush. */
  peeksFirst: [1, 2],
  peeksLater: [1, 2],
  /** Peeks never come closer to the takeoff (or the last landing) than this. */
  peekLeadMs: 500,
  /** How long a peek lasts (head up, then back down); peeks never overlap. */
  peekMs: 520,
  /** Total hit window around each crossing (ms) at acceptance 0 … */
  windowMsAtHopeless: 80,
  /** … and at acceptance 1. */
  windowMsAtCertain: 220,
  /** After a crane lands, this long without a shot counts as a miss. */
  graceMs: 400,
} as const;

/** When the crane countdown ends (GO), ms after the panel opens. */
export const CRANE_GO_MS = CRANE.countdownStepMs * CRANE.countdownSteps;

/**
 * Flappy crane: tap to flap the origami crane through five green triangles
 * (from the ceiling, the floor or both); touch one, or the ceiling/floor,
 * and the deal is gone. Gaps are wider the more acceptable the offer was.
 * World units: a FLAPPY.width × FLAPPY.height stage, y down; time in ms.
 * TUNE all.
 */
export const FLAPPY = {
  width: 1720,
  height: 1000,
  obstacles: 5,
  /** First obstacle's x, and the spacing between the next ones. */
  firstObstacleX: 1500,
  spacingMin: 640,
  spacingMax: 860,
  /** Triangle base width. */
  triangleWidth: 380,
  /** The clear gap a "both" obstacle leaves (and singles can't close more). */
  gapAtHopeless: 380,
  gapAtCertain: 560,
  /** A "both" gap never hugs the ceiling/floor closer than this. */
  edgeMargin: 90,
  /** A single triangle is at least this share of the height. */
  singleMinShare: 0.35,
  /** The crane: fixed x, hit radius. */
  craneX: 420,
  craneRadius: 62,
  /** Physics (units/ms, units/ms²): a flap sets the climb speed. */
  gravity: 0.0042,
  flapSpeed: 1.2,
  maxFall: 1.6,
  scrollSpeed: 0.55,
  /** Fixed physics step (ms) and a safety cap on a run's length. */
  stepMs: 8,
  maxMs: 20000,
  /** Fly this far past the last triangle to finish. */
  finishMargin: 60,
} as const;

export const BOARD_SEATS = {
  /** Demanding a seat lowers negotiation acceptance by this much. TUNE */
  acceptancePenalty: 0.15,
  /**
   * At harvest a seat is a buff with risk: any exit pays this much more, but
   * a company that goes to zero costs this share of what you put in (legal
   * fees, D&O, the TechCrunch piece) — negative proceeds. So seats pay on
   * companies you read well, and hurt on the ones you didn't. TUNE
   */
  // Sim (Partner deck, per $1 in): weak team+traction ≤5 −0.04, mid 6–7
  // +0.09, strong 8+ +0.25. Seat the good ones, not everything.
  exitMult: 1.2,
  zeroPenalty: 0.5,
} as const;

// ---------------------------------------------------------------------------
// Follow-on interrupts (Fund II+)
// ---------------------------------------------------------------------------

export const FOLLOW_ONS = {
  /** A company can raise again this many meetings after signing. */
  minMeetingsHeld: 6,
  /** Per active company per ADVANCE. TUNE */
  perMeetingChance: 0.02,
  /** Max raise events (taken or declined) per company per run. */
  maxPerCompany: 2,
  /** New round size = original check * factor. TUNE */
  raiseFactorMin: 2,
  raiseFactorMax: 3.5,
  /** Round direction odds from quality: pUp = upBase + upQualitySlope*q. TUNE */
  upBase: 0.25,
  upQualitySlope: 0.5,
  downBase: 0.35,
  downQualitySlope: -0.25,
  /** New pre-money = old post-money * direction factor. TUNE */
  upFactorMin: 1.5,
  upFactorMax: 2.4,
  flatFactor: 1,
  downFactor: 0.6,
} as const;

// ---------------------------------------------------------------------------
// Bridge rounds (Partner+)
// ---------------------------------------------------------------------------

export const BRIDGE = {
  /** Only struggling companies come asking. */
  qualityThreshold: 0.35,
  minMeetingsHeld: 8,
  perMeetingChance: 0.015,
  /** Bridge cost as a fraction of the original check. TUNE */
  costFactorOfCheck: 0.5,
  /** A bridge buys a little life. TUNE */
  qualityBoost: 0.05,
} as const;

// ---------------------------------------------------------------------------
// Capital calls (GP)
// ---------------------------------------------------------------------------

export const CAPITAL_CALLS = {
  /** Rolled once per quarter boundary. TUNE */
  perQuarterChance: 0.12,
  /** Fraction of remaining capital an LP tries to slow-walk. TUNE */
  amountRatio: 0.1,
  /** Pressing the LP keeps the capital but costs trust. TUNE */
  pressTrustDelta: -6,
} as const;

// ---------------------------------------------------------------------------
// Exits & harvest
// ---------------------------------------------------------------------------

/**
 * Outcome weights as functions of hidden quality q (normalized before use):
 * zero/acquihire/base/win are base + slope*q; unicorn is base + quad*q^2.
 * Multiples apply to TOTAL invested capital and are scaled by the negotiated
 * entry bonus. Rough shape target: Fund I median DPI 0.3–0.8 under a naive
 * strategy (asserted by the monte-carlo suite). TUNE
 */
export const EXITS = {
  harvestYears: 5,
  weights: {
    zero: { base: 0.62, slope: -0.42 },
    acquihire: { base: 0.22, slope: -0.06 },
    base: { base: 0.12, slope: 0.1 },
    win: { base: 0.035, slope: 0.19 },
    unicorn: { base: 0.005, quad: 0.1 },
  },
  /** Payout multiple ranges (uniform within band) per bucket. TUNE */
  multiples: {
    zero: { min: 0, max: 0 },
    acquihire: { min: 0.25, max: 0.55 },
    base: { min: 1.2, max: 2.0 },
    win: { min: 3, max: 5.5 },
    unicorn: { min: 15, max: 30 },
  },
  /** Mid-run toast events, rolled per active company per ADVANCE. TUNE */
  midRun: {
    perMeetingChance: 0.008,
    markupQualityMin: 0.55,
    shutdownQualityMax: 0.3,
  },
} as const;

// ---------------------------------------------------------------------------
// Career ladder & fund sizing
// ---------------------------------------------------------------------------

export const CAREER = {
  /** DPI thresholds (returned / fund size). */
  associatePromotionDpi: 1.0,
  partnerPromotionDpi: 2.0,
  /** Enlightenment: 3x+ on a $200M+ fund at max reputation stage. */
  enlightenmentDpi: 3.0,
  enlightenmentMinFundM: 200, // scaled with gpBaseM (was 250 at 50 meetings)
  /** "Maxed reputation" = top stage lower bound (REPUTATION.stageThresholds[4]). */
  enlightenmentMinRep: 90,
  gpOfferCount: 3,
} as const;

/** Scorecard verdict bands: DPI upper bounds per bucket (content owns copy). */
export const VERDICT_DPI = {
  wipeoutMax: 0.3,
  underwaterMax: 1,
  respectableMax: 2,
  heaterMax: 3, // legend at 3x+
} as const;

export const FUND_SIZING = {
  /** Base next-fund size per tier, before DPI and trust multipliers. TUNE */
  associateBaseM: 30,
  partnerBaseM: 70, // scaled down with the 30-meeting first Partner fund so it's deployable
  gpBaseM: 145, // scaled ×40/50 with GP meetings so a GP fund is still deployable
  /** DPI factor = clamp(dpiFactorBase + dpi * dpiFactorSlope). TUNE */
  dpiFactorBase: 0.6,
  dpiFactorSlope: 0.4,
  dpiFactorMin: 0.7,
  dpiFactorMax: 1.6,
  /** GP offer packages spread around the computed next size. TUNE */
  gpOfferSizeFactors: [0.8, 1.0, 1.3],
  gpOfferSizeJitter: 0.15,
} as const;

// ---------------------------------------------------------------------------
// Simulation harness (naive-strategy policy used by tests + npm run simulate)
// ---------------------------------------------------------------------------

export const SIM = {
  /** Naive policy: sign at ask when team+traction >= this... */
  signStatSumMin: 6,
  /** ...or when heat is at least this (FOMO is the point). */
  signHeatMin: 4,
  /** Sword pull: taps a typical thumb lands in SWORD_PULL.durationMs. TUNE */
  swordTaps: 36,
  /** Wheel: a blind guess at when to stop (ms). TUNE */
  wheelStopMs: 1500,
  /** Crane: how far off each crossing a typical shot lands (ms). TUNE */
  craneShotOffsetMs: 60,
  /** Flappy: a naive steady flap rhythm (ms). TUNE */
  flappyEveryMs: 450,
  /** Safety cap on reducer steps per simulated run. */
  maxSteps: 5000,
} as const;

// ---------------------------------------------------------------------------
// Swipe feel (mechanical thresholds only — visuals live in CSS)
// ---------------------------------------------------------------------------

export const SWIPE = {
  /** Movement below this is a tap, not a swipe (buttons still fire). */
  slopPx: 12,
  /** Distance commit: |dx| >= this fraction of the game column width. TUNE */
  commitDistanceRatio: 0.3,
  /** Flick commit: |velocity| >= px/ms with at least the min travel. TUNE */
  flickVelocity: 0.5,
  flickMinDistancePx: 40,
  /** Sub-threshold release springs the card back over this many ms. */
  springBackMs: 180,
  /**
   * Right swipe that opens the terms sheet: the card knocks back toward the
   * centre but stays a little shoved and tilted, OFFER stamp showing, while
   * you decide. TUNE
   */
  parkOffsetPx: 10,
  parkTiltDeg: 3,
  parkMs: 280,
} as const;

// ---------------------------------------------------------------------------
// LP requests (per-fund side objectives)
// ---------------------------------------------------------------------------

export const LP_REQUESTS = {
  /** Fund I (the tutorial) always gets exactly this many, and only from the
   *  requests the player fully controls (see requestPool). */
  fundICount: 1,
  /** Salt for the requests' own RNG, so rolling them never shifts the deck. */
  rngSalt: 0x4c50_5251,
  /** dryPowder: broken once deployed capital exceeds this share of the fund. TUNE */
  dryPowderMaxDeployed: 0.7,
  /** diversify: met at harvest with at least this many off-thesis checks. TUNE */
  diversifyMinOffThesis: 2,
  /** coolDeals: broken by signing anything hotter than this (heat 1..5). TUNE */
  coolDealsMaxHeat: 3,
  /** reliableTeams: broken by signing a team rated below this (1..5). TUNE */
  reliableTeamsMinTeam: 3,
  /** Pairs that can't be asked together: they contradict each other, or
   *  stack into a near-impossible combo (sitting on 30% of the fund while
   *  hunting a unicorn / a DPI target: undeployed capital returns nothing). */
  exclusive: [
    ['onThesis', 'diversify'],
    ['dryPowder', 'unicorn'],
    ['dryPowder', 'returnFund'],
  ] as readonly (readonly [string, string])[],
  /** Results requests (decided by luck at harvest, not by your swipes). */
  resultKinds: ['unicorn', 'returnFund'] as readonly string[],
  /**
   * Fund II+: how many requests a fund gets (rolled uniformly in
   * minCount..maxCount) and how many may be results requests. Index =
   * pressure level: 0 a normal fund; 1..2 big funds (BIG_FUNDS.pressureAt)
   * get more, and strict ones. TUNE
   */
  byPressure: [
    { minCount: 1, maxCount: 3, maxResultKinds: 1 },
    { minCount: 3, maxCount: 4, maxResultKinds: 1 },
    { minCount: 4, maxCount: 5, maxResultKinds: 2 },
  ],
  /** Strict thresholds a big fund's LPs ask for instead. TUNE */
  strict: {
    dryPowderMaxDeployed: 0.6,
    diversifyMinOffThesis: 3,
    coolDealsMaxHeat: 2,
    reliableTeamsMinTeam: 4,
  },
  /** returnFund: met at harvest when DPI reaches this (legacy default). */
  returnFundDpi: 1,
  /**
   * returnFund ("hit Xx DPI after 5 years"): the target is rolled per fund
   * from this tier band, in steps. Starts gentle, ends demanding. TUNE
   */
  dpiTargetByTier: {
    associate: { min: 0.5, max: 1 },
    partner: { min: 0.75, max: 1.5 },
    gp: { min: 1, max: 2 },
  },
  dpiTargetStep: 0.25,
  /** LP trust granted per request met, at harvest (feeds next fund size). TUNE */
  metTrustDelta: 6,
} as const;

// ---------------------------------------------------------------------------
// Offer profiles (Fund II+ engagement letters)
// ---------------------------------------------------------------------------

/**
 * The three firm offers after Fund I are the same career-earned base fund,
 * each bent a different way so picking one is a real choice. Not applied
 * when an LP package already fixed the fund (GP promotion).
 */
export const OFFER_PROFILES = {
  /** Salt for the profile's own RNG, so it never shifts the run stream. */
  rngSalt: 0x4f_46_46_52,
  /** More money, same calendar: more AUM, harder to deploy well (DPI). TUNE
   *  (Fewer meetings on top made it a trap in sims: GP 1x+ fell to 17%.) */
  bigChecks: { sizeMult: 1.2, meetingsMult: 1, trustDelta: 0 },
  /** More at-bats, smaller fund: easiest DPI, least AUM. TUNE */
  dealFlow: { sizeMult: 0.9, meetingsMult: 1.15, trustDelta: 0 },
  /** Same fund, LPs already like you: room to go off-thesis. TUNE */
  lpDarling: { sizeMult: 1, meetingsMult: 1, trustDelta: 15 },
  /**
   * Colossal fund where you're a nobody: one rung down the ladder (partner
   * vetoes again, no board seats), huge AUM. Only offered after a 1x+ fund,
   * to someone with a rung to lose. TUNE
   */
  megaFund: { sizeMult: 2.5, meetingsMult: 1, trustDelta: -10 },
  /** Mega fund needs the last fund to have returned at least this. */
  megaMinLastDpi: 1,
  /**
   * The new-firm market is a surprise box: each offer's fund and LP trust
   * swing around its profile, and the inbox only shows the possible range.
   * The low end sits under what staying pays, so leaving is a gamble, not a
   * free upgrade. Own salt (the profile pick stays seed-stable). TUNE
   */
  swingSalt: 0x5357_4e47,
  sizeSwing: { min: 0.4, max: 1.0 },
  /** ± LP trust points around the profile's trust. TUNE */
  trustSwing: 10,
} as const;

// ---------------------------------------------------------------------------
// Big funds: checks scale with the money (rehire screen offers, mega funds)
// ---------------------------------------------------------------------------

/**
 * A fund bigger than its rung's usual money per meeting writes bigger checks:
 * every card's ask and valuation are scaled up by checkScale (ownership and
 * exit multiples unchanged), so the fund is actually deployable. In exchange,
 * its LPs pile on requests (LP_REQUESTS.byPressure). Never scales down.
 */
export const BIG_FUNDS = {
  /** A rung's usual fund per meeting ($M): base fund / its calendar. TUNE */
  refPerMeetingM: { associate: 1.2, partner: 2.4, gp: 3.6 },
  /** checkScale at/above these → LP pressure level 1, 2. TUNE */
  pressureAt: [1.5, 2.5],
} as const;

// ---------------------------------------------------------------------------
// Staying at your firm (rehire screen)
// ---------------------------------------------------------------------------

/**
 * Meeting every LP request earns the option to stay. Staying keeps the firm
 * and thesis; it never shrinks the fund for a bad DPI, and after a 1x+ fund
 * it promotes in-house and beats the outside base.
 */
export const STAY = {
  /** 1x+: stay fund = outside base fund × this. TUNE */
  winSizeMult: 1.2,
  /** 1x+: LP trust bonus for staying. TUNE */
  winTrustDelta: 5,
  /** Returns this good buy forgiveness: you may stay even with LP requests
   *  missed ("nobody argues with the returns"). TUNE */
  forgiveDpi: 1.25,
  /** At or below this DPI the firm folds: nobody stays, met requests or
   *  not (you can't comply your way out of losing 80% of the money). TUNE */
  firmFoldDpi: 0.2,
} as const;

