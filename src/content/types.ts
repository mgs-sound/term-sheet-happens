/**
 * Content schema types. All content ships as static JSON (validated by
 * src/content/validate.ts at load time and by `npm run validate-content`).
 *
 * Standing rule: ALL player-facing comedy copy lives in content JSON and is
 * typed here — none of it is hardcoded in game logic or UI.
 */

export const SECTORS = [
  'AI',
  'SaaS',
  'Fintech',
  'Consumer',
  'Climate',
  'Health',
  'Crypto',
  'Gaming',
  'Space',
  'Food',
] as const;
export type Sector = (typeof SECTORS)[number];

/**
 * One swipeable pitch card's editorial content. Numeric stats (team, traction,
 * heat, ask, valuation, hidden quality) are NOT content — they get rolled at
 * runtime by game logic from the seeded RNG.
 */
export interface Pitch {
  /** Globally unique, `<sector-slug>-<name-slug>`, e.g. "ai-synergly". */
  id: string;
  /** Company name as it appears on the card and in the ledger. */
  name: string;
  /** The one-liner joke. Deadpan, specific, one twist, under 20 words. */
  idea: string;
  sector: Sector;
}

/** Shape of every file in src/content/pitches/ — one batch per file. */
export interface PitchBatchFile {
  pitches: Pitch[];
}

/** A comedy thesis pinning exactly two distinct sectors. */
export interface Thesis {
  id: string;
  sectors: [Sector, Sector];
  /** The firm's mandate one-liner shown at fund open and on the scorecard. */
  line: string;
}

/** Prefix + suffix pools for the firm name generator. */
export interface FirmNameParts {
  prefixes: string[];
  suffixes: string[];
}

/**
 * Scorecard verdict bands. Game logic maps DPI -> bucket using thresholds in
 * tuning.ts; content only supplies the copy per bucket.
 */
export const VERDICT_BUCKETS = [
  'wipeout', // lost most of the fund
  'underwater', // below 1x
  'respectable', // around break-even to decent
  'heater', // strong fund
  'legend', // career-defining
] as const;
export type VerdictBucket = (typeof VERDICT_BUCKETS)[number];

/** Exit outcome buckets; keys match EXITS.outcomeMultiples in tuning.ts. */
export const EXIT_BUCKETS = ['zero', 'acquihire', 'base', 'win', 'unicorn'] as const;
export type ExitBucket = (typeof EXIT_BUCKETS)[number];

/** Per-fund LP request kinds (game logic in game/lpRequests.ts). */
export const LP_REQUEST_KINDS = [
  'onThesis',
  'dryPowder',
  'unicorn',
  'returnFund',
  'diversify',
  'coolDeals',
  'reliableTeams',
] as const;
export type LpRequestKind = (typeof LP_REQUEST_KINDS)[number];

/**
 * Every pool of flavor/toast copy the game draws from (via injected RNG).
 * Adding a pool here (plus lines.json content) is how new copy surfaces exist.
 */
export interface FlavorLines {
  /** End-of-Fund-I rehire card. */
  rehireCard: string[];
  /** Reputation-decay jabs when the player passes too much. */
  zombieFundJabs: string[];
  /** Partner kills an agreed deal (Associate tier). */
  vetoLines: string[];
  /** Founder walks after a too-aggressive negotiation. */
  founderWalkLines: string[];
  /** Harvest heartbreak when a vetoed company went unicorn; {company} interpolated. */
  vetoHeartbreak: string[];
  /** Promotion card copy (the flip side of rehireCard). */
  poachLines: string[];
  /** Quirk line attached to each GP-tier LP offer package. */
  lpOfferQuirks: string[];
  /**
   * The 5 reputation ladder stage labels, index-aligned with the engine's
   * REPUTATION.stageThresholds (canonical: DOG WATER -> ENLIGHTENED).
   */
  reputationStages: string[];
  /** Negotiation mood hints, ordered coldest -> warmest. */
  founderMoods: string[];
  /** Shown on the disabled board-seat control at Associate. */
  boardSeatLocked: string[];
  /** The endgame card: a young associate pitching their fund to you. */
  finalCardPitches: string[];
  /** Enlightenment notice copy. */
  enlightenmentLines: string[];
  /** Credits screen copy. */
  creditsLines: string[];
  /** Ledger stamp per scorecard verdict band. */
  verdictStamps: Record<VerdictBucket, string>;
  /**
   * Share copy per verdict band ({dpi}/{fund}/{returned}/{firm} tokens);
   * failure buckets carry the extra-funny variants.
   */
  shareLines: Record<VerdictBucket, string[]>;
  /** Career-level share flex ({returned}/{funds} tokens). */
  shareCareerLines: string[];
  /** Scorecard verdict copy per DPI band. */
  verdicts: Record<VerdictBucket, string[]>;
  /** Stamped label per exit outcome on the harvest screen. */
  /** A fund in the red ends the career: the resignation letter, the
   *  ledger tag and the obituary share card. shareLines: {funds}. */
  careerOver: {
    /** {red} = ruleRed, scrawled in red over the usual letterhead. */
    rule: string;
    ruleRed: string;
    inbox: string;
    lines: string[];
    cta: string;
    ledgerTag: string;
    obituaryRule: string;
    obituaryStamp: string;
    obituaryLine: string;
    shareCta: string;
    shareLines: string[];
  };
  /** Partner+ final-offer minigame (sword in the stone). */
  swordPull: { title: string; intros: string[]; won: string[]; lost: string[]; cta: string };
  harvestOutcomeLabels: Record<ExitBucket, string>;
  /** Harvest label when a board-seat exit push blew up the company (out $0). */
  /** Board seat copy. Sign sheet: note ({bonus} %) then risk ({penalty} %,
   *  set bold red). Harvest row: bonus / liability ({pct}). */
  boardSeat: { label: string; note: string; risk: string; bonus: string; liability: string };
  /**
   * Fund I difficulty bands shown on the engagement letter, index-aligned
   * with the engine's difficultyBand(): [soft, standard, brutal].
   */
  fundIDifficulty: { label: string; blurb: string }[];
  /** Partner's coin-flip veto challenge panel. */
  vetoChallenge: {
    title: string;
    /** Tag under the side the player called. */
    youChose: string;
    /** Big rubber stamp slammed on the panel once the result is in. */
    stampWon: string;
    stampLost: string;
    intros: string[];
    won: string[];
    lost: string[];
    /** Higher/lower variant of the challenge. */
    highLowIntros: string[];
    highLowWon: string[];
    highLowLost: string[];
    /** Even/odd dice variant. */
    diceIntros: string[];
    diceWon: string[];
    diceLost: string[];
    /** Longest-stick variant. */
    sticksIntros: string[];
    sticksWon: string[];
    sticksLost: string[];
  };
  /** Mid-run portfolio screen: status stamp per company state. */
  portfolioStatusLabels: { active: string; writtenOff: string };
  /** Mid-run portfolio screen when nothing is signed yet. */
  portfolioEmpty: string[];
  /** Career profile page (the Career Ledger dressed as a networking profile). */
  profile: {
    title: string;
    name: string;
    /** "About" line, index-aligned with reputationStages. */
    aboutByStage: string[];
    /** Badge shown while the last fund returned under 1x. */
    openToWork: string;
    experienceTitle: string;
    skillsTitle: string;
    /** {n} = funds that returned 1x or better. */
    endorsed: string;
    skills: {
      base: string[];
      unicorns: string;
      vetoedRight: string;
      returned: string;
      neverReturned: string;
      enlightened: string;
    };
    empty: string;
    /** The blank profile a new career starts on. {name} = player's name. */
    onboarding: {
      /** Everyone starts as this until they tap the name to change it. */
      defaultName: string;
      about: string;
      skills: string[];
      /** The one button: starts the career (on to the job offers). */
      startCta: string;
      endorsedNamed: string;
      endorsedAnon: string;
    };
  };
  /** Fund II+ offer flavors on the engagement letter (keys = OfferProfile). */
  offerProfiles: Record<
    'bigChecks' | 'dealFlow' | 'lpDarling' | 'megaFund',
    { label: string; blurb: string }
  >;
  /** Rehire "inbox": stay at your firm vs. new firm opportunities. */
  rehire: {
    inbox: string;
    /** The choice, spelled out under the inbox heading. */
    intro: string;
    /** {firm} = the firm you just ran. */
    stayTitle: string;
    /** {n} = number of offers (falls back to the plain title when unknown). */
    outsideTitle: string;
    role: string;
    /** {n} = the next fund's number. */
    fund: string;
    trust: string;
    /** GP promotion: {n} = how many LP packages wait outside. */
    lpOffers: string;
    /** The outside market as a sealed envelope (a sentence, not a table).
     *  {n} = offers; {lo}/{hi} = fund range; {tlo}/{thi} = trust range;
     *  {role} = the role (or "X or Y"). */
    sealedIntro: string;
    sealedRange: string;
    sealedRoleSame: string;
    sealedRole: string;
    /** GP promotion: {n} LP packages, {lo}/{hi} fund range. */
    sealedLp: string;
    sealedNote: string;
    /** Stay block's role when staying isn't allowed (locked / firm folded). */
    lockedRole: string;
    stayCta: string;
    leaveCta: string;
    /** Why "stay" is greyed out (an LP request was broken). */
    stayLocked: string;
    /** Stay allowed despite missed requests, thanks to a strong DPI. */
    stayForgiven: string;
    /** The firm folded (terrible DPI): {firm} = its name. */
    stayFolded: string;
  };
  /** Fund I: the firm options read as job offers on the engagement letter. */
  jobs: {
    /** Button that steps to the next offer; {i}/{n} = position. */
    nextOffer: string;
  };
  /** Per-fund LP requests (side objectives). */
  lpRequests: {
    title: string;
    stampMet: string;
    stampBroken: string;
    /** Stamp when a request failed only because the fund made no investments. */
    stampNoDeals: string;
    /** Scorecard line explaining the NO DEALS stamp. */
    noDealsNote: string;
    /** Toast when one breaks mid-run; {request} = the request's text. */
    brokenToast: string;
    /** Note under the list; {trust} = LP trust per request met. */
    rewardNote: string;
    /** Scorecard line under the list: all met = you may stay at the firm. */
    verdictAllMet: string;
    /** Scorecard line under the list: any missed = you'll have to leave. */
    verdictMissed: string;
    /** Scorecard line: missed, but the DPI was high enough to be forgiven. */
    verdictForgiven: string;
    /** Scorecard line: the DPI was so bad the firm folds, requests or not. */
    verdictFolded: string;
    /** Copy variants per request kind. Tokens (filled from tuning):
     *  {pct} reserve share, {deployed} max deployed share, {n} off-thesis
     *  deals to diversify, {heat} max deal heat, {team} min team rating,
     *  {x} the DPI target (returnFund). */
    kinds: Record<LpRequestKind, string[]>;
  };
}

/** Everything the content layer provides, fully validated. */
export interface Content {
  pitches: Pitch[];
  theses: Thesis[];
  firmNames: FirmNameParts;
  lines: FlavorLines;
}
