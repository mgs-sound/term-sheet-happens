/**
 * Engine types. Everything here is plain serializable data — GameState and
 * CareerState round-trip through JSON (saves) and structuredClone (reducer).
 * .ts import extensions throughout src/game so scripts can run under plain
 * Node with type stripping.
 */

import type {
  ExitBucket,
  FirmNameParts,
  LpRequestKind,
  Pitch,
  Sector,
  Thesis,
} from '../content/types.ts';

export type Tier = 'associate' | 'partner' | 'gp';

export type Stage = 'preSeed' | 'seed' | 'seriesA' | 'seriesB';

/** What the engine needs from the content layer, injected at START_RUN. */
export interface EngineContent {
  pitches: Pitch[];
  theses: Thesis[];
  firmNames: FirmNameParts;
}

/** A runtime pitch card: editorial content + rolled stats + hidden quality. */
export interface PitchCard {
  pitchId: string;
  name: string;
  idea: string;
  sector: Sector;
  stage: Stage;
  team: number; // 1..5
  traction: number; // 1..5
  arrK: number; // annual recurring revenue, thousands USD
  heat: number; // 1..5
  askM: number; // check the founder wants
  valuationM: number; // asked pre-money
  onThesis: boolean;
  /** Hidden 0..1 — never shown to the player; drives outcomes. */
  quality: number;
}

export interface PortfolioCompany {
  /** Unique within the run (pitchId; decks never repeat a pitch twice). */
  companyId: string;
  card: PitchCard;
  /** Total capital in: initial check + follow-ons + bridges. */
  investedM: number;
  initialCheckM: number;
  /** Agreed pre-money at entry. */
  dealValuationM: number;
  ownership: number; // 0..1
  /** Exit-payout scale from negotiated entry price. */
  entryBonus: number;
  boardSeat: boolean;
  signedAtMeeting: number;
  followOnEvents: number; // taken + declined, for FOLLOW_ONS.maxPerCompany
  bridged: boolean;
  status: 'active' | 'writtenOff';
  /**
   * Board-seat exit timing (Partner+): when true, the exit is pushed at
   * harvest — BOARD_SEATS.pushImproveChance to multiply it, else it zeroes.
   * Toggled any time before harvest via TOGGLE_PUSH_EXIT. Optional so older
   * saves stay valid.
   */
  pushExit?: boolean;
}

export interface VetoedRecord {
  card: PitchCard;
  atMeeting: number;
}

export type InterruptEvent =
  | {
      kind: 'followOn';
      companyId: string;
      companyName: string;
      raiseM: number;
      newPreM: number;
      proRataCostM: number;
    }
  | { kind: 'bridge'; companyId: string; companyName: string; costM: number }
  | { kind: 'capitalCall'; amountM: number };

export interface NegotiationState {
  round: 0 | 1;
  counter: { checkM: number; valuationM: number } | null;
}

/** How the current card left the table (set before ADVANCE clears it). */
export type Resolution =
  | 'passed'
  | 'signed'
  | 'vetoed'
  | 'founderWalked'
  | 'walkedAway';

export type GameEventKind =
  | 'signed'
  | 'passed'
  | 'vetoed'
  | 'founderWalked'
  | 'walkedAway'
  | 'hotDeal'
  | 'zombieJab'
  | 'markup'
  | 'shutdown'
  | 'followOnTaken'
  | 'followOnDeclined'
  | 'bridgeTaken'
  | 'bridgeDeclined'
  | 'capitalCallPressed'
  | 'capitalCallEaten'
  | 'visionary'
  | 'vetoHeartbreak'
  | 'vetoChallenge'
  | 'challengeWon'
  | 'lpRequestBroken';

/** Structured log entry — the UI maps kinds to flavor lines from content. */
export interface GameEvent {
  meeting: number;
  kind: GameEventKind;
  company?: string;
  amountM?: number;
  /** lpRequestBroken: which request. */
  request?: LpRequestKind;
}

// ---------------------------------------------------------------------------
// LP requests (per-fund side objectives)
// ---------------------------------------------------------------------------

export { LP_REQUEST_KINDS, type LpRequestKind } from '../content/types.ts';
/** open = still in play; broken can happen mid-run; met only at harvest. */
export type LpRequestStatus = 'open' | 'met' | 'broken';

export interface LpRequest {
  kind: LpRequestKind;
  status: LpRequestStatus;
  /** Which copy variant to show (UI mods by pool length). */
  lineIndex: number;
  /** returnFund: the DPI the LPs asked for (absent on older saves = 1x). */
  target?: number;
  /** Why it broke, when it isn't the obvious rule: the fund ended with no
   *  investments at all (e.g. the only deal was vetoed). */
  reason?: 'noDeals';
}

export interface HarvestCompanyResult {
  companyId: string;
  name: string;
  sector: Sector;
  onThesis: boolean;
  bucket: ExitBucket;
  investedM: number;
  proceedsM: number;
  /** Present when a board-seat push was attempted. */
  boardPush?: 'improved' | 'zeroed';
}

export interface HarvestResult {
  companies: HarvestCompanyResult[];
  returnedM: number;
  dpi: number;
  unicorns: number;
  /** Vetoed companies that would have been unicorns — the heartbreak. */
  vetoedUnicorns: number;
  /** Off-thesis big exits that flipped to reputation spikes. */
  visionaries: number;
}

export type Phase =
  | 'meeting'
  | 'negotiation'
  | 'vetoChallenge'
  | 'interrupt'
  | 'fundClosed'
  | 'harvested';

export type CoinSide = 'heads' | 'tails';
export type HighLowCall = 'higher' | 'lower';
export type DiceCall = 'even' | 'odd';
export type StickCall = 'red' | 'green';
export type ChallengeCall = CoinSide | HighLowCall | DiceCall | StickCall;
/** Which partner minigame settles a veto. */
export type ChallengeGame = 'coin' | 'highLow' | 'dice' | 'sticks';
export const CHALLENGE_GAMES: readonly ChallengeGame[] = ['coin', 'highLow', 'dice', 'sticks'];

export const SUITS = ['spades', 'hearts', 'diamonds', 'clubs'] as const;
export type Suit = (typeof SUITS)[number];
export interface PlayingCard {
  /** 2..14 (J=11, Q=12, K=13, A=14). */
  rank: number;
  suit: Suit;
}

/** Agreed terms parked while the partner's challenge is pending. */
export interface VetoChallenge {
  checkM: number;
  dealValuationM: number;
  boardSeat: boolean;
  /** Absent on older saves = coin. */
  game?: ChallengeGame;
  /** Higher/lower: the face-up card. */
  shown?: PlayingCard;
}

/** Fund II+ offer flavor (see OFFER_PROFILES); display order. */
export const OFFER_PROFILES_ORDER = ['bigChecks', 'dealFlow', 'lpDarling', 'megaFund'] as const;
export type OfferProfile = (typeof OFFER_PROFILES_ORDER)[number];

export interface GameState {
  phase: Phase;
  seed: number;
  /** Serialized RNG stream position — see rng.ts getState(). */
  rngState: number;
  tier: Tier;
  isFundI: boolean;
  fundIndex: number;
  firmName: string;
  thesis: Thesis;
  fundSizeM: number;
  capitalM: number;
  reputation: number; // 0..100
  lpTrust: number; // 0..100
  meetingsTotal: number;
  /** 0-based; equals meetings fully resolved. */
  meetingIndex: number;
  quarter: number; // 1-based, derived from meetingIndex via CLOCK
  deck: PitchCard[];
  deckIndex: number;
  currentCard: PitchCard | null;
  resolution: Resolution | null;
  negotiation: NegotiationState | null;
  interrupt: InterruptEvent | null;
  portfolio: PortfolioCompany[];
  vetoed: VetoedRecord[];
  passStreak: number;
  /** Quarters whose capital-call roll already happened (GP). */
  lastCapitalCallQuarter: number;
  events: GameEvent[];
  harvest: HarvestResult | null;
  /** Fund I only: the difficulty dial this run's terms were rolled from
   *  (0 softest .. 1 most brutal; see FUND_I_TERMS). Optional so older saves
   *  stay valid. */
  fundIDifficulty?: number;
  /** Pending partner coin-flip challenge (phase 'vetoChallenge'). */
  vetoChallenge?: VetoChallenge | null;
  /** The last coin flip, so the UI can show how it landed. */
  lastCoinFlip?: { call: CoinSide; landed: CoinSide; won: boolean } | null;
  /** The last higher/lower round, so the UI can reveal the hidden card. */
  lastHighLow?: { call: HighLowCall; shown: PlayingCard; hidden: PlayingCard; won: boolean } | null;
  /** The last even/odd roll (1..6). */
  lastDice?: { call: DiceCall; roll: number; won: boolean } | null;
  /** The last longest-stick draw (lengths as % of the ruler). */
  lastSticks?: { call: StickCall; red: number; green: number; won: boolean } | null;
  /** Fund II+ offer flavor that bent this fund's terms (absent = none). */
  offerProfile?: OfferProfile;
  /** This fund's LP requests (absent on older saves = none). */
  lpRequests?: LpRequest[];
}

// ---------------------------------------------------------------------------
// Career layer
// ---------------------------------------------------------------------------

export interface LpOffer {
  fundSizeM: number;
  thesisId: string;
  /** Index into the LP-quirk flavor pool (UI mods by pool length). */
  quirkIndex: number;
}

export interface PendingFund {
  sizeM: number;
  thesisId: string;
  quirkIndex: number;
}

/** One ruled line in the Career Ledger — a fund that ran to harvest. */
export interface LedgerEntry {
  fundIndex: number;
  firmName: string;
  thesisId: string;
  tier: Tier;
  fundSizeM: number;
  returnedM: number;
  dpi: number;
}

/** Plain serializable career object — the whole save is this plus settings. */
export interface CareerState {
  tier: Tier;
  /** 1-based count of funds started; fundIndex 1 is always Fund I. */
  fundIndex: number;
  reputation: number;
  lpTrust: number;
  /** Career score: cumulative capital managed. */
  aumM: number;
  totalReturnedM: number;
  bestDpi: number;
  lastFundDpi: number | null;
  unicornsFound: number;
  vetoedUnicorns: number;
  enlightened: boolean;
  endlessUnlocked: boolean;
  /** Sized at fund close for the next run (null before first close). */
  nextFundSizeM: number | null;
  /** GP promotion: three packages to choose from via acceptLpOffer. */
  pendingOffers: LpOffer[] | null;
  /** Set when a GP offer is accepted; consumed by the next START_RUN. */
  pendingFund: PendingFund | null;
  /** GP-chosen firm name for the next run; null = engine-generated. */
  pendingFirmName: string | null;
  /** One entry per harvested fund, oldest first. */
  ledger: LedgerEntry[];
  /** Name on the professional profile; absent = the "Your Name Here" default. */
  playerName?: string;
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export type Action =
  | { type: 'START_RUN'; career: CareerState; seed: number; content: EngineContent }
  | { type: 'PASS' }
  | { type: 'SIGN_AT_ASK'; boardSeat?: boolean }
  | { type: 'OPEN_NEGOTIATION' }
  | { type: 'SEND_OFFER'; checkM: number; valuationM: number; boardSeat?: boolean }
  | { type: 'WALK_AWAY' }
  | { type: 'RESOLVE_INTERRUPT'; accept: boolean }
  | { type: 'ADVANCE' }
  | { type: 'CLOSE_FUND' }
  | { type: 'TOGGLE_PUSH_EXIT'; companyId: string }
  | { type: 'RESOLVE_VETO_CHALLENGE'; call: ChallengeCall }
  | { type: 'HARVEST'; push?: string[] };
