import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './App.css';
import { loadContentAsync } from '../content/loader';
import { pickCarryLine } from '../content/carry';
import type { Content, FlavorLines } from '../content/types';
import { reduce } from '../game/engine';
import {
  acceptLpOffer,
  closeCareerFund,
  initialCareer,
  scoreSubmissionFor,
  withFirmName,
} from '../game/career';
import { careerAtEnlightenmentGate, forceHarvestResult } from '../game/devtools';
import { generateFirmName } from '../game/firm';
import { logoSvg } from '../game/logogen';
import { createRng } from '../game/rng';
import { migrateSave, type SaveData } from '../game/save';
import { careerForTier, simulateRun } from '../game/sim';
import type {
  Action,
  CareerState,
  EngineContent,
  GameEvent,
  GameState,
  ScoreSubmission,
} from '../game/types';
import { verdictBucket } from '../game/verdict';
import { services } from '../services';
import { fillLine, fmtDpi, fmtM, pickLine } from './format';
import { renderCareerPng, renderScorecardPng } from './share/renderShareCard';
import { FirmReveal } from './screens/FirmReveal';
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
import { NameCarveSheet } from './components/NameCarveSheet';
import { SettingsSheet } from './components/SettingsSheet';
import { Toasts, type Toast } from './components/Toasts';
import { RegisterScreen } from './screens/RegisterScreen';

type Screen =
  | 'reveal'
  | 'run'
  | 'closing'
  | 'harvest'
  | 'scorecard'
  | 'rehire'
  | 'gpOffers'
  | 'gpNaming'
  | 'ledger'
  | 'register'
  | 'enlightenment';

const SAVE_KEY = 'save';

/** Seed selection is not game randomness — runs stay reproducible per seed. */
let seedCounter = 0;
function newSeed(): number {
  return (Date.now() + ++seedCounter * 7919) >>> 0;
}

function toastFor(e: GameEvent, lines: FlavorLines, key: number): Toast | null {
  const make = (text: string, tone: Toast['tone']): Toast => ({ id: 0, text, tone });
  switch (e.kind) {
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
    const allowed: Screen[] = ['scorecard', 'harvest', 'rehire', 'ledger', 'register', 'enlightenment'];
    if (save.pendingCareer) allowed.push('gpOffers', 'gpNaming');
    return allowed.includes(save.screen as Screen) ? (save.screen as Screen) : 'scorecard';
  }
  if (game.phase === 'fundClosed') return 'closing';
  return save.screen === 'reveal' ? 'reveal' : 'run';
}

/** Boot shell: content and the last save load before the game mounts. */
export function App(): JSX.Element {
  const [boot, setBoot] = useState<{ content: Content; save: SaveData | null } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const content = await loadContentAsync();
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
  const [screen, setScreen] = useState<Screen>(() => (save ? screenForResume(save) : 'reveal'));
  const [pendingCareer, setPendingCareer] = useState<CareerState | null>(
    () => save?.pendingCareer ?? null,
  );
  const [pendingScore, setPendingScore] = useState<ScoreSubmission | null>(
    () => save?.pendingScore ?? null,
  );
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [devPreviewUrl, setDevPreviewUrl] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const gameRef = useRef(game);
  gameRef.current = game;
  const toastId = useRef(1);

  const pushToast = useCallback((toast: Omit<Toast, 'id'>): void => {
    setToasts((ts) => [...ts.slice(-3), { ...toast, id: toastId.current++ }]);
  }, []);

  const setGameDirect = useCallback((next: GameState): void => {
    gameRef.current = next;
    setGame(next);
  }, []);

  // Autosave: career + run at every clean beat (each meeting, close, harvest).
  useEffect(() => {
    if (!isCleanBeat(game)) return;
    const snapshot: SaveData = { career, game, screen, pendingCareer, pendingScore };
    void services.storage.write(SAVE_KEY, snapshot);
  }, [career, game, screen, pendingCareer, pendingScore]);

  // Queued register submission from an offline session: retry once per boot.
  const retriedRef = useRef(false);
  useEffect(() => {
    if (retriedRef.current || !pendingScore) return;
    retriedRef.current = true;
    void services.leaderboard.submit(pendingScore).then((outcome) => {
      if (outcome !== 'unreachable') setPendingScore(null);
    });
  }, [pendingScore]);


  const dispatch = useCallback(
    (action: Action): GameState => {
      try {
        const prev = gameRef.current;
        const next = reduce(action.type === 'START_RUN' ? null : prev, action);
        const freshEvents = action.type === 'START_RUN' ? [] : next.events.slice(prev.events.length);
        freshEvents.forEach((e, i) => {
          const toast = toastFor(e, content.lines, next.seed + next.events.length + i);
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

  // Auto-submit on fund close for named, opted-in careers. The register can
  // never block play: unreachable submissions queue into the save.
  const lastSubmitRef = useRef('');
  useEffect(() => {
    if (game.phase !== 'harvested' || !nextCareer || !career.boardOptIn) return;
    const submission = scoreSubmissionFor(nextCareer);
    if (!submission) return;
    const key = `${submission.careerId}:${game.fundIndex}`;
    if (lastSubmitRef.current === key) return;
    lastSubmitRef.current = key;
    void services.leaderboard.submit(submission).then((outcome) => {
      setPendingScore(outcome === 'unreachable' ? submission : null);
    });
  }, [game, nextCareer, career.boardOptIn]);

  const startRun = useCallback(
    (nextCareerState: CareerState): void => {
      const resolved = nextCareerState.pendingOffers
        ? acceptLpOffer(nextCareerState, 1)
        : nextCareerState;
      setCareer(resolved);
      setPendingCareer(null);
      dispatch({ type: 'START_RUN', career: resolved, seed: newSeed(), content: engineContent });
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

  const carryEquivalenceFor = useCallback(
    (g: GameState): string => {
      const carryM = g.harvest?.carryM ?? 0;
      return fillLine(pickCarryLine(content.carryEquivalences, carryM, g.seed), {
        carry: fmtM(carryM),
      });
    },
    [content.carryEquivalences],
  );

  const buildScorecardPng = useCallback(async (): Promise<Blob | null> => {
    const g = gameRef.current;
    if (!g.harvest) return null;
    const bucket = verdictBucket(g.harvest.dpi);
    return renderScorecardPng({
      firmName: g.firmName,
      logoSvg: logoSvg(g.firmName, null, 96),
      fundIndex: g.fundIndex,
      thesisLine: g.thesis.line,
      dpiLabel: fmtDpi(g.harvest.dpi),
      dpiGood: g.harvest.dpi >= 1,
      verdictStamp: content.lines.verdictStamps[bucket],
      verdictLine: pickLine(content.lines.verdicts[bucket], g.seed),
      carryLabel: `Your carry: ${fmtM(g.harvest.carryM)}`,
      carryEquivalence: carryEquivalenceFor(g),
      fundLabel: fmtM(g.fundSizeM),
      returnedLabel: fmtM(g.harvest.returnedM),
      checksLabel: String(g.portfolio.length),
      unicornsLabel: String(g.harvest.unicorns),
    });
  }, [content.lines, carryEquivalenceFor]);

  const shareScorecard = useCallback(async (): Promise<void> => {
    const g = gameRef.current;
    if (!g.harvest) return;
    const bucket = verdictBucket(g.harvest.dpi);
    const text =
      fillLine(pickLine(content.lines.shareLines[bucket], g.seed), {
        dpi: fmtDpi(g.harvest.dpi),
        firm: g.firmName,
        fund: fmtM(g.fundSizeM),
        returned: fmtM(g.harvest.returnedM),
      }) +
      '\n' +
      carryEquivalenceFor(g);
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
  }, [buildScorecardPng, carryEquivalenceFor, content.lines, pushToast, toastForShareOutcome]);

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

  const resetCareer = useCallback((): void => {
    void services.storage.remove(SAVE_KEY);
    setSettingsOpen(false);
    startRun(initialCareer());
    pushToast({ text: 'The industry has already forgotten you.', tone: 'green' });
  }, [pushToast, startRun]);

  const devJump = (jump: DevJump): void => {
    const presets = {
      fundI: initialCareer,
      associate: () => careerForTier('associate'),
      partner: () => careerForTier('partner'),
      gp: () => careerForTier('gp'),
      gate: careerAtEnlightenmentGate,
    } as const;
    startRun(presets[jump]());
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
    <main className="game-surface app-shell">
      {screen === 'reveal' && (
        <FirmReveal
          game={game}
          onReroll={() =>
            dispatch({ type: 'START_RUN', career, seed: newSeed(), content: engineContent })
          }
          onOpen={() => setScreen('run')}
          onSettings={() => setSettingsOpen(true)}
        />
      )}
      {screen === 'run' && (
        <RunScreen
          game={game}
          dispatch={dispatch}
          lines={content.lines}
          onBlockedSwipe={() => pushToast({ text: 'Check exceeds dry powder.', tone: 'red' })}
        />
      )}
      {screen === 'closing' && (
        <ClosingScreen
          game={game}
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
          carryEq={content.carryEquivalences}
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
          lines={content.lines}
          onNextFund={() => {
            if (nextCareer.pendingOffers) {
              setPendingCareer(nextCareer);
              setScreen('gpOffers');
            } else {
              startRun(nextCareer);
            }
          }}
          onNewCareer={() => startRun(initialCareer())}
          onLedger={() => setScreen('ledger')}
          onRegister={() => setScreen('register')}
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
      {screen === 'register' && (
        <RegisterScreen
          careerId={career.careerId}
          lines={content.lines}
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
      {screen === 'scorecard' && career.boardOptIn === null && (
        <NameCarveSheet
          onCarve={(name) => {
            setCareer({
              ...career,
              playerName: name,
              careerId: career.careerId ?? crypto.randomUUID(),
              boardOptIn: true,
            });
            // The auto-submit effect fires once the updated career closes out.
          }}
          onDecline={() => setCareer({ ...career, boardOptIn: false })}
        />
      )}
      {settingsOpen && (
        <SettingsSheet
          career={career}
          onUpdateCareer={(updated) => setCareer(updated)}
          onClose={() => setSettingsOpen(false)}
          onResetCareer={resetCareer}
        />
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
        />
      )}
    </main>
  );
}
