import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './App.css';
import './fonts/cardFonts.css';
import './fonts/firmFonts.css';
import { preloadSectorFonts } from './fonts/preloadSectorFonts';
import { loadContentAsync } from '../content/loader';
import type { Content, FlavorLines } from '../content/types';
import { createRun, reduce } from '../game/engine';
import {
  acceptLpOffer,
  closeCareerFund,
  initialCareer,
  withFirmName,
  withPlayerName,
  acceptStay,
  stayOption,
} from '../game/career';
import {
  careerAtEnlightenmentGate,
  forceHarvestResult,
  forceLpRequests,
  forceVetoChallenge,
} from '../game/devtools';
import { generateFirmName } from '../game/firm';
import { FIRM_OPTION_COUNT, pickFirmOptions } from '../game/firmOptions';
import { createRng } from '../game/rng';
import { migrateSave, type SaveData } from '../game/save';
import { careerForTier, simulateRun } from '../game/sim';
import type { Action, CareerState, EngineContent, GameEvent, GameState } from '../game/types';
import { verdictBucket } from '../game/verdict';
import { services, type SfxId } from '../services';
import { fillLine, fmtDpi, fmtM, pickLine } from './format';
import { renderCareerPng, renderScorecardPng } from './share/renderShareCard';
import { FirmReveal } from './screens/FirmReveal';
import { OnboardingScreen } from './screens/OnboardingScreen';
import { RunScreen } from './screens/RunScreen';
import { ClosingScreen } from './screens/ClosingScreen';
import { HarvestScreen } from './screens/HarvestScreen';
import { ScorecardScreen } from './screens/ScorecardScreen';
import { RehireScreen } from './screens/RehireScreen';
import { GpOffersScreen } from './screens/GpOffersScreen';
import { GpNamingScreen } from './screens/GpNamingScreen';
import { LedgerScreen } from './screens/LedgerScreen';
import { EnlightenmentScreen } from './screens/EnlightenmentScreen';
import { DevPanel, type DevJump } from './components/DevPanel';
import { lpRequestText } from './components/LpRequestList';
import { SettingsSheet } from './components/SettingsSheet';
import { Toasts, type Toast } from './components/Toasts';

type Screen =
  | 'onboarding'
  | 'reveal'
  | 'run'
  | 'closing'
  | 'harvest'
  | 'scorecard'
  | 'rehire'
  | 'gpOffers'
  | 'gpNaming'
  | 'ledger'
  | 'enlightenment';

const SAVE_KEY = 'save';

/** Seed selection is not game randomness — runs stay reproducible per seed. */
let seedCounter = 0;
function newSeed(): number {
  return (Date.now() + ++seedCounter * 7919) >>> 0;
}

function toastFor(e: GameEvent, lines: FlavorLines, key: number, game: GameState): Toast | null {
  const make = (text: string, tone: Toast['tone']): Toast => ({ id: 0, text, tone });
  switch (e.kind) {
    case 'lpRequestBroken': {
      const request = game.lpRequests?.find((r) => r.kind === e.request);
      if (!request) return null;
      return make(lines.lpRequests.brokenToast.replace('{request}', lpRequestText(lines, request)), 'red');
    }
    case 'vetoed':
      return make(pickLine(lines.vetoLines, key), 'red');
    case 'zombieJab':
      return make(pickLine(lines.zombieFundJabs, key), 'red');
    case 'founderWalked':
      return make(pickLine(lines.founderWalkLines, key), 'red');
    case 'markup':
      return make(`${e.company} marked up.`, 'green');
    case 'shutdown':
      return make(`${e.company} shut down.`, 'red');
    case 'followOnDeclined':
      return make(`${e.company}: diluted.`, 'red');
    default:
      return null;
  }
}

/** A save is only written at beats the UI can cleanly resume from. */
function isCleanBeat(game: GameState | null): boolean {
  if (!game) return true;
  return (
    game.phase === 'fundClosed' ||
    game.phase === 'harvested' ||
    game.phase === 'interrupt' ||
    (game.phase === 'meeting' && game.resolution === null)
  );
}

function screenForResume(save: SaveData): Screen {
  const game = save.game;
  if (!game) return 'reveal';
  if (game.phase === 'harvested') {
    const allowed: Screen[] = ['scorecard', 'harvest', 'rehire', 'ledger', 'enlightenment'];
    if (save.pendingCareer) allowed.push('gpOffers', 'gpNaming');
    return allowed.includes(save.screen as Screen) ? (save.screen as Screen) : 'scorecard';
  }
  if (game.phase === 'fundClosed') return 'closing';
  // New career, nothing played yet: back to the blank profile.
  if (
    save.screen === 'onboarding' &&
    game.phase === 'meeting' &&
    game.meetingIndex === 0
  ) {
    return 'onboarding';
  }
  return save.screen === 'reveal' ? 'reveal' : 'run';
}

/** Boot shell: content and the last save load before the game mounts. */
export function App(): JSX.Element {
  const [boot, setBoot] = useState<{ content: Content; save: SaveData | null } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [content] = await Promise.all([loadContentAsync(), preloadSectorFonts()]);
      const envelope = await services.storage.read<unknown>(SAVE_KEY);
      const save = envelope ? migrateSave(envelope.schemaVersion, envelope.data) : null;
      if (!cancelled) setBoot({ content, save });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!boot) return <main className="game-surface app-shell" />;
  return <GameApp content={boot.content} save={boot.save} />;
}

/**
 * The one sound rule: every button (and checkbox) interaction makes a sound.
 * Default is a generic blip; a button can pick its own cue with
 * data-sfx="<SfxId>", or data-sfx="none" when its sound is played from logic
 * (e.g. deal results that depend on what the engine decided).
 */
function playButtonSfx(e: React.MouseEvent): void {
  const el = (e.target as Element).closest('button, input[type="checkbox"]');
  if (!el || (el as HTMLButtonElement).disabled) return;
  const cue = el.getAttribute('data-sfx');
  if (cue === 'none') return;
  services.audio.play((cue as SfxId | null) ?? (el.tagName === 'INPUT' ? 'tick' : 'tap'));
}

function GameApp({ content, save }: { content: Content; save: SaveData | null }): JSX.Element {
  const engineContent: EngineContent = useMemo(
    () => ({ pitches: content.pitches, theses: content.theses, firmNames: content.firmNames }),
    [content],
  );
  const devMode = useMemo(() => new URLSearchParams(window.location.search).has('dev'), []);

  const [career, setCareer] = useState<CareerState>(() => save?.career ?? initialCareer());
  const [game, setGame] = useState<GameState>(
    () =>
      save?.game ??
      reduce(null, {
        type: 'START_RUN',
        career: save?.career ?? initialCareer(),
        seed: newSeed(),
        content: engineContent,
      }),
  );
  const [screen, setScreen] = useState<Screen>(() =>
    save ? screenForResume(save) : 'onboarding',
  );
  // The fixed set of run seeds "Reroll the firm" cycles through (see firmOptions.ts).
  const [firmOptions, setFirmOptions] = useState<number[] | null>(null);
  const [pendingCareer, setPendingCareer] = useState<CareerState | null>(
    () => save?.pendingCareer ?? null,
  );
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [devPreviewUrl, setDevPreviewUrl] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const gameRef = useRef(game);
  gameRef.current = game;
  const toastId = useRef(1);

  /** Toasts only make sense next to what caused them: keep at most the two
   *  on screen (no backlog trickling out seconds later). */
  const pushToast = useCallback((toast: Omit<Toast, 'id'>): void => {
    setToasts((ts) => [...ts.slice(-1), { ...toast, id: toastId.current++ }]);
  }, []);
  const clearToasts = useCallback((): void => setToasts([]), []);

  const setGameDirect = useCallback((next: GameState): void => {
    gameRef.current = next;
    setGame(next);
  }, []);

  // Autosave: career + run at every clean beat (each meeting, close, harvest).
  useEffect(() => {
    if (!isCleanBeat(game)) return;
    const snapshot: SaveData = { career, game, screen, pendingCareer };
    void services.storage.write(SAVE_KEY, snapshot);
  }, [career, game, screen, pendingCareer]);

  const dispatch = useCallback(
    (action: Action): GameState => {
      try {
        const prev = gameRef.current;
        const next = reduce(action.type === 'START_RUN' ? null : prev, action);
        const freshEvents = action.type === 'START_RUN' ? [] : next.events.slice(prev.events.length);
        freshEvents.forEach((e, i) => {
          const toast = toastFor(e, content.lines, next.seed + next.events.length + i, next);
          if (toast) pushToast(toast);
        });
        gameRef.current = next;
        setGame(next);
        return next;
      } catch (err) {
        console.error('Engine rejected action', action, err);
        return gameRef.current;
      }
    },
    [content.lines, pushToast],
  );

  const expireToast = useCallback((id: number): void => {
    setToasts((ts) => ts.filter((t) => t.id !== id));
  }, []);

  // Leaving the meetings (fund closes) or opening Settings drops the run's
  // pending toasts. Only on LEAVING 'run', so toasts that announce a new
  // screen (e.g. a fresh career) survive.
  const prevScreen = useRef(screen);
  useEffect(() => {
    if (prevScreen.current === 'run' && screen !== 'run') clearToasts();
    prevScreen.current = screen;
  }, [screen, clearToasts]);
  useEffect(() => {
    if (settingsOpen) clearToasts();
  }, [settingsOpen, clearToasts]);

  // End-of-meetings watcher: no card left + all meetings held -> close the fund.
  useEffect(() => {
    if (
      screen === 'run' &&
      game.phase === 'meeting' &&
      game.currentCard === null &&
      game.resolution === null &&
      game.meetingIndex >= game.meetingsTotal
    ) {
      dispatch({ type: 'CLOSE_FUND' });
      setScreen('closing');
    }
  }, [screen, game, dispatch]);

  const nextCareer = useMemo(() => {
    if (game.phase !== 'harvested') return null;
    const rng = createRng((game.seed ^ (game.fundIndex * 2654435761)) >>> 0);
    return closeCareerFund(career, game, rng, content.theses);
  }, [game, career, content.theses]);

  // The new-firm offers shown in the rehire inbox, one row each: the same
  // fixed set the engagement letters then flip through (seeded from the run,
  // so they don't reshuffle on re-render). GP promotion has LP packages instead.
  const rehireOffers = useMemo(() => {
    if (!nextCareer || nextCareer.pendingOffers) return null;
    const seeds = pickFirmOptions(nextCareer, engineContent, (game.seed ^ 0x9e3779b9) >>> 0);
    return seeds.map((seed) => createRun(nextCareer, seed, engineContent));
  }, [nextCareer, engineContent, game.seed]);

  /** Start a fund at one of a fixed set of offers (the rehire inbox rows). */
  const startOffer = (fresh: CareerState, seeds: number[], seed: number): void => {
    setCareer(fresh);
    setPendingCareer(null);
    setFirmOptions(seeds);
    dispatch({ type: 'START_RUN', career: fresh, seed, content: engineContent });
    setScreen('reveal');
  };

  const startRun = useCallback(
    (nextCareerState: CareerState): void => {
      const resolved = nextCareerState.pendingOffers
        ? acceptLpOffer(nextCareerState, 1)
        : nextCareerState;
      setCareer(resolved);
      setPendingCareer(null);
      const options = pickFirmOptions(resolved, engineContent, newSeed());
      setFirmOptions(options);
      dispatch({ type: 'START_RUN', career: resolved, seed: options[0] ?? newSeed(), content: engineContent });
      setScreen('reveal');
    },
    [dispatch, engineContent],
  );

  const suggestFirmName = useCallback(
    (): string => generateFirmName(createRng(newSeed()), content.firmNames),
    [content.firmNames],
  );

  const toastForShareOutcome = useCallback(
    (outcome: Awaited<ReturnType<typeof services.share.share>>): void => {
      const messages = {
        shared: { text: 'Shared.', tone: 'green' as const },
        copied: { text: 'Copied to clipboard.', tone: 'green' as const },
        downloaded: { text: 'PNG downloaded, text copied.', tone: 'green' as const },
        unavailable: { text: 'Sharing is unavailable here.', tone: 'red' as const },
        cancelled: null,
      };
      const msg = messages[outcome];
      if (msg) pushToast(msg);
    },
    [pushToast],
  );

  const buildScorecardPng = useCallback(async (): Promise<Blob | null> => {
    const g = gameRef.current;
    if (!g.harvest) return null;
    const bucket = verdictBucket(g.harvest.dpi);
    return renderScorecardPng({
      firmName: g.firmName,
      fundIndex: g.fundIndex,
      thesisLine: g.thesis.line,
      dpiLabel: fmtDpi(g.harvest.dpi),
      dpiGood: g.harvest.dpi >= 1,
      verdictStamp: content.lines.verdictStamps[bucket],
      verdictLine: pickLine(content.lines.verdicts[bucket], g.seed),
      fundLabel: fmtM(g.fundSizeM),
      returnedLabel: fmtM(g.harvest.returnedM),
      checksLabel: String(g.portfolio.length),
      unicornsLabel: String(g.harvest.unicorns),
    });
  }, [content.lines]);

  const shareScorecard = useCallback(async (): Promise<void> => {
    const g = gameRef.current;
    if (!g.harvest) return;
    const bucket = verdictBucket(g.harvest.dpi);
    const text = fillLine(pickLine(content.lines.shareLines[bucket], g.seed), {
      dpi: fmtDpi(g.harvest.dpi),
      firm: g.firmName,
      fund: fmtM(g.fundSizeM),
      returned: fmtM(g.harvest.returnedM),
    });
    try {
      const blob = await buildScorecardPng();
      const outcome = await services.share.share({
        title: 'Term Sheet Happens',
        text,
        ...(blob ? { image: { blob, filename: 'term-sheet-happens-scorecard.png' } } : {}),
      });
      toastForShareOutcome(outcome);
    } catch (err) {
      console.error(err);
      pushToast({ text: 'Sharing is unavailable here.', tone: 'red' });
    }
  }, [buildScorecardPng, content.lines, pushToast, toastForShareOutcome]);

  const shareCareer = useCallback(
    async (careerToShare: CareerState): Promise<void> => {
      const text = fillLine(pickLine(content.lines.shareCareerLines, careerToShare.fundIndex), {
        returned: fmtM(careerToShare.totalReturnedM),
        funds: String(careerToShare.ledger.length),
      });
      try {
        const blob = await renderCareerPng({
          returnedLabel: fmtM(careerToShare.totalReturnedM),
          aumLabel: fmtM(careerToShare.aumM),
          fundsLabel: String(careerToShare.ledger.length),
          bestDpiLabel: fmtDpi(careerToShare.bestDpi),
          unicornsLabel: String(careerToShare.unicornsFound),
          enlightened: careerToShare.enlightened,
        });
        const outcome = await services.share.share({
          title: 'Term Sheet Happens',
          text,
          image: { blob, filename: 'term-sheet-happens-career.png' },
        });
        toastForShareOutcome(outcome);
      } catch (err) {
        console.error(err);
        pushToast({ text: 'Sharing is unavailable here.', tone: 'red' });
      }
    },
    [content.lines, pushToast, toastForShareOutcome],
  );

  /** A new career starts on the blank profile, not straight in a fund. */
  const beginCareer = useCallback((fresh: CareerState): void => {
    setCareer(fresh);
    setPendingCareer(null);
    setScreen('onboarding');
  }, []);

  const resetCareer = useCallback((): void => {
    void services.storage.remove(SAVE_KEY);
    setSettingsOpen(false);
    beginCareer(initialCareer());
    pushToast({ text: 'The industry has already forgotten you.', tone: 'green' });
  }, [pushToast, beginCareer]);

  const devJump = (jump: DevJump): void => {
    const presets = {
      fundI: initialCareer,
      associate: () => careerForTier('associate'),
      partner: () => careerForTier('partner'),
      gp: () => careerForTier('gp'),
      gate: careerAtEnlightenmentGate,
    } as const;
    if (jump === 'fundI') beginCareer(initialCareer());
    else startRun(presets[jump]());
  };

  const devAutoplay = (): void => {
    try {
      setGameDirect(simulateRun(career, game.seed, engineContent));
      setScreen('harvest');
    } catch (err) {
      console.error(err);
    }
  };

  const devForceDpi = (dpi: number, enlightenGrade: boolean): void => {
    try {
      setGameDirect(
        forceHarvestResult(
          gameRef.current,
          enlightenGrade ? { dpi, fundSizeM: 260, reputation: 92 } : { dpi },
        ),
      );
    } catch (err) {
      console.error(err);
    }
  };

  const devPreviewShare = async (): Promise<void> => {
    const blob = await buildScorecardPng();
    if (blob) setDevPreviewUrl(URL.createObjectURL(blob));
  };

  return (
    <main className="game-surface app-shell" onClickCapture={playButtonSfx}>
      {screen === 'onboarding' && (
        <OnboardingScreen
          key={career.playerName ?? ''}
          career={career}
          lines={content.lines}
          onSearch={(name) => {
            // The three firm options ARE the job offers: the engagement letter
            // shows the first, "Next offer" steps through them.
            startRun(withPlayerName(career, name));
          }}
          onSettings={() => setSettingsOpen(true)}
        />
      )}
      {screen === 'reveal' && (
        <FirmReveal
          game={game}
          lines={content.lines}
          firmParts={content.firmNames}
          optionIndex={firmOptions ? Math.max(0, firmOptions.indexOf(game.seed)) : 0}
          optionCount={firmOptions?.length ?? FIRM_OPTION_COUNT}
          // GP with a chosen name AND an LP-pinned thesis: rerolling would only
          // reshuffle the hidden deck (nothing visible changes), so no button.
          // GP with a chosen name AND an LP-pinned thesis: rerolling would only
          // reshuffle the hidden deck (nothing visible changes), so no button.
          canReroll={career.pendingFirmName === null || !career.pendingFund}
          onReroll={() => {
            // Rebuild the set around the current firm if we don't have it
            // (e.g. after a reload), then step to the next of the three.
            const options =
              firmOptions && firmOptions.includes(game.seed)
                ? firmOptions
                : pickFirmOptions(career, engineContent, newSeed(), game.seed);
            const next = options[(options.indexOf(game.seed) + 1) % options.length] ?? newSeed();
            setFirmOptions(options);
            dispatch({ type: 'START_RUN', career, seed: next, content: engineContent });
          }}
          onOpen={() => setScreen('run')}
          onSettings={() => setSettingsOpen(true)}
        />
      )}
      {screen === 'run' && (
        <RunScreen
          game={game}
          dispatch={dispatch}
          lines={content.lines}
          onBlockedSwipe={() => {
            services.audio.play('denied');
            pushToast({ text: 'Check exceeds dry powder.', tone: 'red' });
          }}
          onSettings={() => setSettingsOpen(true)}
          onPortfolioOpen={clearToasts}
        />
      )}
      {screen === 'closing' && (
        <ClosingScreen
          game={game}
          lines={content.lines}
          firmParts={content.firmNames}
          onTogglePush={(companyId) => dispatch({ type: 'TOGGLE_PUSH_EXIT', companyId })}
          onSettings={() => setSettingsOpen(true)}
          onHarvest={() => {
            dispatch({ type: 'HARVEST' });
            setScreen('harvest');
          }}
        />
      )}
      {screen === 'harvest' && (
        <HarvestScreen game={game} lines={content.lines} onContinue={() => setScreen('scorecard')} />
      )}
      {screen === 'scorecard' && (
        <ScorecardScreen
          game={game}
          lines={content.lines}
          onShare={() => void shareScorecard()}
          onContinue={() =>
            setScreen(nextCareer?.enlightened && !career.enlightened ? 'enlightenment' : 'rehire')
          }
        />
      )}
      {screen === 'rehire' && nextCareer && (
        <RehireScreen
          game={game}
          nextCareer={nextCareer}
          stay={stayOption(nextCareer, game)}
          lines={content.lines}
          onStay={() => startRun(acceptStay(nextCareer, stayOption(nextCareer, game)))}
          offers={rehireOffers}
          onNextFund={() => {
            if (nextCareer.pendingOffers) {
              setPendingCareer(nextCareer);
              setScreen('gpOffers');
            } else if (rehireOffers && rehireOffers[0]) {
              // The same offers the inbox table showed, first one up.
              const seeds = rehireOffers.map((r) => r.seed);
              startOffer(nextCareer, seeds, rehireOffers[0].seed);
            } else {
              startRun(nextCareer);
            }
          }}
          // Walking away keeps your name; everything else starts over.
          onNewCareer={() => beginCareer(withPlayerName(initialCareer(), career.playerName ?? ''))}
          onLedger={() => setScreen('ledger')}
        />
      )}
      {screen === 'gpOffers' && pendingCareer && (
        <GpOffersScreen
          career={pendingCareer}
          content={content}
          onAccept={(i) => {
            setPendingCareer(acceptLpOffer(pendingCareer, i));
            setScreen('gpNaming');
          }}
        />
      )}
      {screen === 'gpNaming' && pendingCareer && (
        <GpNamingScreen
          career={pendingCareer}
          suggest={suggestFirmName}
          onDone={(name) => startRun(withFirmName(pendingCareer, name))}
        />
      )}
      {screen === 'ledger' && nextCareer && (
        <LedgerScreen
          career={nextCareer}
          content={content}
          onShare={() => void shareCareer(nextCareer)}
          onBack={() => setScreen('rehire')}
        />
      )}
      {screen === 'enlightenment' && nextCareer && (
        <EnlightenmentScreen
          game={game}
          nextCareer={nextCareer}
          lines={content.lines}
          onEndless={() => startRun(nextCareer)}
        />
      )}
      {settingsOpen && (
        <SettingsSheet onClose={() => setSettingsOpen(false)} onResetCareer={resetCareer} />
      )}
      {devPreviewUrl && (
        <div
          className="settings-backdrop"
          onClick={() => {
            URL.revokeObjectURL(devPreviewUrl);
            setDevPreviewUrl(null);
          }}
        >
          <img className="dev-share-preview" src={devPreviewUrl} alt="Share card preview" />
        </div>
      )}
      <Toasts toasts={toasts} onExpire={expireToast} />
      {devMode && (
        <DevPanel
          game={game}
          onJump={devJump}
          onAutoplay={devAutoplay}
          onForceDpi={devForceDpi}
          onPreviewShare={() => void devPreviewShare()}
          onForceLpRequests={(mode) => {
            try {
              setGameDirect(forceLpRequests(gameRef.current, mode));
            } catch (err) {
              console.error(err);
            }
          }}
          onCoinFlip={() => {
            try {
              setGameDirect(forceVetoChallenge(gameRef.current, 'coin'));
            } catch (err) {
              console.error(err);
            }
          }}
          onHighLow={() => {
            try {
              setGameDirect(forceVetoChallenge(gameRef.current, 'highLow'));
            } catch (err) {
              console.error(err);
            }
          }}
          onDice={() => {
            try {
              setGameDirect(forceVetoChallenge(gameRef.current, 'dice'));
            } catch (err) {
              console.error(err);
            }
          }}
          onSticks={() => {
            try {
              setGameDirect(forceVetoChallenge(gameRef.current, 'sticks'));
            } catch (err) {
              console.error(err);
            }
          }}
        />
      )}
    </main>
  );
}
