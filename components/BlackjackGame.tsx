"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  accuracy,
  addSeat,
  beginDeal,
  cardsRemaining,
  createInitialState,
  dealNextCard,
  DEFAULT_SETTINGS,
  GameSettings,
  GameState,
  getAvailableActions,
  getSharedBankroll,
  newRound,
  playerAction,
  removeSeat,
  resetBankroll,
  seatsByTableSpot,
  setSeatBet,
  stepDealer,
  takeInsurance,
  updateSettings,
  Seat,
} from "@/lib/game";
import { loadPersisted, savePersisted } from "@/lib/persist";
import { evaluateHand } from "@/lib/cards";
import { countLabel, trueCount } from "@/lib/counting";
import { Action, actionLabel } from "@/lib/strategy";
import { PlayingCard } from "./PlayingCard";
import { CountPanel } from "./CountPanel";
import { ChartPanel } from "./ChartPanel";
import { SettingsPanel } from "./SettingsPanel";
import { DealerFigure } from "./DealerFigure";
import { DealShoe } from "./DealShoe";
import { DiscardTray } from "./DiscardTray";
import { FeltMarkings } from "./FeltMarkings";
import { AnimatedBalance } from "./AnimatedBalance";
import { ThemeToggle } from "./ThemeToggle";
import { dismissSeatTip, isSeatTipDismissed } from "@/lib/theme";

const MAX_SPOTS = 5;
/** Fixed artboard — everything inside scales uniformly */
const TABLE_W = 1100;
const TABLE_H = 700;
/** Approx horizontal span of the seat arc in artboard px (for mobile edge fit) */
const SEAT_SPAN_W = 640;

function seatAngle(index: number, total: number) {
  if (total <= 1) return 0;
  // Wide enough for spacing, tight enough to keep seats off the rim
  const spread = 108;
  return -spread / 2 + (index / (total - 1)) * spread;
}

function statusText(phase: GameState["phase"]) {
  switch (phase) {
    case "betting":
    case "between":
    case "payout":
      return "WAITING FOR BETS";
    case "dealing":
      return "DEALING";
    case "insurance":
      return "INSURANCE?";
    case "acting":
      return "YOUR PLAY";
    case "dealer":
      return "DEALER PLAYING";
    default:
      return "STRATEGY TABLE";
  }
}

function phaseBanner(state: GameState): string {
  if (state.phase === "acting" && state.message) return state.message.toUpperCase();
  return statusText(state.phase);
}

function buildSpots(seats: Seat[]): Array<Seat | null> {
  return seatsByTableSpot(seats);
}

function ChipStack({
  value,
  selected,
  onClick,
}: {
  value: number;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`chip-stack chip-${value} ${selected ? "selected" : ""}`}
      onClick={onClick}
      aria-label={`Chip ${value}`}
    >
      <span className="stack-layer l3" />
      <span className="stack-layer l2" />
      <span className="stack-layer l1" />
      <span className="stack-face">{value}</span>
    </button>
  );
}

export function BlackjackGame() {
  const [state, setState] = useState<GameState>(() =>
    createInitialState(DEFAULT_SETTINGS),
  );
  const [persistReady, setPersistReady] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [chartOpen, setChartOpen] = useState(false);
  const [countOpen, setCountOpen] = useState(false);
  const [countValuesHidden, setCountValuesHidden] = useState(false);
  const [selectedChip, setSelectedChip] = useState(25);
  const [lastBet, setLastBet] = useState(DEFAULT_SETTINGS.minBet);
  const [dealingAnim, setDealingAnim] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [tableScale, setTableScale] = useState(1);
  const [betSeatId, setBetSeatId] = useState("seat-0");
  const [seatTipVisible, setSeatTipVisible] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const tableWrapRef = useRef<HTMLDivElement>(null);

  const human = state.seats.find((s) => s.isHuman)!;
  const sharedBankroll = getSharedBankroll(state);
  const betSeat = state.seats.find((s) => s.id === betSeatId) ?? human;
  const actions = useMemo(() => getAvailableActions(state), [state]);
  const remaining = cardsRemaining(state);
  const tc = trueCount(state.runningCount, remaining, state.settings.decks);
  const acc = accuracy(state);
  const decisions = state.correctDecisions + state.wrongDecisions;
  const spots = useMemo(() => buildSpots(state.seats), [state.seats]);

  const tableCardCount =
    state.dealerCards.length +
    state.seats.reduce(
      (n, s) => n + s.hands.reduce((m, h) => m + h.cards.length, 0),
      0,
    );

  const totalBet = state.seats.reduce((sum, seat) => {
    const handBets = seat.hands.reduce((s, h) => s + h.bet, 0);
    if (handBets > 0) return sum + handBets;
    if (
      state.phase === "betting" ||
      state.phase === "between" ||
      state.phase === "payout"
    ) {
      return sum + seat.bet;
    }
    return sum;
  }, 0);

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  useEffect(() => () => clearTimers(), []);

  // Load localStorage only after mount so SSR HTML matches the first client paint
  useEffect(() => {
    const saved = loadPersisted();
    if (saved) {
      const initial = createInitialState(saved.settings);
      const h = initial.seats.find((s) => s.isHuman);
      if (h && !saved.settings.infiniteMoney) {
        h.bankroll = saved.bankroll;
      }
      setState(initial);
      setLastBet(saved.settings.minBet);
    }
    setSeatTipVisible(!isSeatTipDismissed());
    setPersistReady(true);
  }, []);

  useEffect(() => {
    if (!persistReady) return;
    savePersisted(state.settings, sharedBankroll);
  }, [state.settings, sharedBankroll, persistReady]);

  useEffect(() => {
    const el = tableWrapRef.current;
    if (!el) return;
    const stage = el.closest(".live-stage") as HTMLElement | null;
    const update = () => {
      const w = el.clientWidth;
      const mobile = window.matchMedia("(max-width: 700px)").matches;
      // Mobile: reserve compact header + bottom HUD; grow table so seats near edges.
      const chrome = mobile ? 200 : 220;
      const availableH = Math.max(200, window.innerHeight - chrome);
      const byW = w / TABLE_W;
      const byH = availableH / TABLE_H;
      const bySeats = (w - 28) / SEAT_SPAN_W;
      const next = mobile
        ? Math.max(0.3, Math.min(bySeats, byH, 1.15))
        : Math.max(0.38, Math.min(byW, byH, 1.55));
      setTableScale((prev) => (Math.abs(prev - next) < 0.001 ? prev : next));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    if (stage) ro.observe(stage);
    window.addEventListener("resize", update);
    const mq = window.matchMedia("(max-width: 700px)");
    mq.addEventListener("change", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
      mq.removeEventListener("change", update);
    };
  }, []);

  const apply = (fn: (s: GameState) => GameState) => setState((s) => fn(s));

  // Sequential initial deal
  useEffect(() => {
    if (state.phase !== "dealing") return;
    setDealingAnim(true);
    const t = setTimeout(() => {
      apply(dealNextCard);
    }, 420);
    timers.current.push(t);
    return () => clearTimeout(t);
  }, [state.phase, tableCardCount]);

  // Sequential dealer hits
  useEffect(() => {
    if (state.phase !== "dealer") return;
    setDealingAnim(true);
    const t = setTimeout(() => {
      apply(stepDealer);
      setDealingAnim(false);
    }, 520);
    timers.current.push(t);
    return () => clearTimeout(t);
  }, [state.phase, state.dealerCards.length]);

  // After payout → hold results, fly to discard, then waiting for bets
  useEffect(() => {
    if (state.phase !== "payout") {
      setClearing(false);
      return;
    }
    const CLEAR_FLY_MS = 520;
    const delaySec = Math.max(1, state.settings.clearTableDelaySec || 5);
    const totalMs = delaySec * 1000;
    const holdMs = Math.max(0, totalMs - CLEAR_FLY_MS);

    const tHold = setTimeout(() => setClearing(true), holdMs);
    const tClear = setTimeout(() => {
      apply(newRound);
      setClearing(false);
    }, totalMs);
    timers.current.push(tHold, tClear);
    return () => {
      clearTimeout(tHold);
      clearTimeout(tClear);
    };
  }, [state.phase, state.handsPlayed, state.settings.clearTableDelaySec]);

  useEffect(() => {
    if (state.phase !== "dealing") setDealingAnim(false);
  }, [state.phase]);

  const setBetTo = (value: number) => {
    apply((s) => setSeatBet(s, betSeat.id, value));
  };

  const changeBet = (delta: number) => {
    apply((s) => setSeatBet(s, betSeat.id, betSeat.bet + delta));
  };

  const onAction = (action: Action) => {
    setDealingAnim(true);
    apply((s) => playerAction(s, action));
    const t = setTimeout(() => setDealingAnim(false), 480);
    timers.current.push(t);
  };

  const runDeal = () => {
    setLastBet(betSeat.bet || lastBet);
    setDealingAnim(true);
    apply((s) => {
      let next = s;
      for (const seat of s.seats) {
        if (seat.bet < s.settings.minBet) {
          next = setSeatBet(next, seat.id, lastBet || s.settings.minBet);
        }
      }
      return beginDeal(next);
    });
  };

  const dealerValue = evaluateHand(state.dealerCards);
  const showDealerTotal =
    state.phase === "dealer" ||
    state.phase === "payout" ||
    !state.dealerCards.some((c) => c.faceDown);

  const bjLabel =
    state.settings.blackjackPays === "3:2" ? "3 TO 2" : "6 TO 5";
  const dealerRule = state.settings.dealerHitsSoft17
    ? "Dealer must draw to 16 & hit soft 17"
    : "Dealer must draw to 16 & stand on all 17s";

  const waitingBets =
    state.phase === "betting" ||
    state.phase === "between" ||
    state.phase === "payout";
  const busy =
    state.phase === "dealing" ||
    state.phase === "dealer" ||
    dealingAnim;
  const canAct = state.phase === "acting" && !busy;
  const showActionHud =
    waitingBets ||
    state.phase === "insurance" ||
    state.phase === "acting" ||
    Boolean(state.lastFeedback && state.settings.trainMode);

  const claimMultiSeat = (spotIndex: number) => {
    if (state.seats.length >= MAX_SPOTS) return;
    if (!waitingBets) return;
    if (state.seats.some((s) => s.spot === spotIndex)) return;
    apply((s) => addSeat(s, spotIndex));
    setBetSeatId(`seat-spot-${spotIndex}`);
  };

  const leaveSeat = (seatId: string) => {
    if (!waitingBets) return;
    apply((s) => removeSeat(s, seatId));
    if (betSeatId === seatId) setBetSeatId(human.id);
  };

  const tipSeatIndex = (() => {
    const empties = spots
      .map((seat, index) => (seat === null ? index : -1))
      .filter((index) => index >= 0);
    if (empties.length === 0) return -1;
    // Prefer an empty seat near the center so the tip stays on-screen on phones.
    return empties.reduce((best, index) =>
      Math.abs(index - 2) < Math.abs(best - 2) ? index : best,
    );
  })();
  const showSeatTip =
    waitingBets && seatTipVisible && tipSeatIndex >= 0 && !busy;

  const hideSeatTip = () => {
    dismissSeatTip();
    setSeatTipVisible(false);
  };

  return (
    <div className="live-casino">
      <header className="live-top">
        <div className="live-top-left">
          <div className="live-logo">Strategy Table</div>
          <div className="live-meta">
            <span>Basic Strategy Trainer</span>
            <span>
              $ {state.settings.minBet} – {state.settings.maxBet}
            </span>
          </div>
        </div>

        <div className="live-top-stats">
          <span>
            Accuracy {acc}% ({state.correctDecisions}/{decisions || 0})
          </span>
          <span>Hands {state.handsPlayed}</span>
          {countOpen && !countValuesHidden && (
            <span>
              RC {countLabel(state.runningCount)} · TC {countLabel(tc)}
            </span>
          )}
        </div>

        <div className="live-top-actions">
          <ThemeToggle />
          <button
            type="button"
            className={`live-icon-btn ${chartOpen ? "on" : ""}`}
            onClick={() => setChartOpen((o) => !o)}
          >
            Chart
          </button>
          <button
            type="button"
            className={`live-icon-btn ${countOpen ? "on" : ""}`}
            onClick={() => setCountOpen((o) => !o)}
          >
            Count
          </button>
          <button
            type="button"
            className="live-icon-btn"
            onClick={() => setSettingsOpen(true)}
          >
            Settings
          </button>
        </div>
      </header>

      <ChartPanel open={chartOpen} onClose={() => setChartOpen(false)} />
      <CountPanel
        state={state}
        open={countOpen}
        onClose={() => setCountOpen(false)}
        valuesHidden={countValuesHidden}
        onToggleValues={() => setCountValuesHidden((h) => !h)}
      />

        <div className={`live-stage ${dealingAnim ? "is-dealing" : ""}`}>
        <div className="studio-glow" aria-hidden="true" />

        <div className="dealer-backdrop">
          <DealerFigure dealing={dealingAnim} />
        </div>

        <div
          className="table-scale-wrap"
          ref={tableWrapRef}
          style={{ height: TABLE_H * tableScale }}
        >
            <div
              className={`live-table ${clearing ? "is-clearing" : ""}`}
              style={{
                width: TABLE_W,
                height: TABLE_H,
                transform: `translateX(-50%) scale(${tableScale})`,
              }}
            >
            <div className="table-rim">
              <div className="table-felt">
                <DiscardTray cards={state.discard} />
                <DealShoe
                  dealing={dealingAnim}
                  fill={remaining / Math.max(1, state.settings.decks * 52)}
                />

                <div className="chip-tray" aria-hidden="true">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <div key={i} className={`tray-slot slot-${i % 5}`}>
                      <span />
                      <span />
                      <span />
                    </div>
                  ))}
                </div>

                <div className="dealer-cards-zone">
                  <div className="card-row">
                    {state.dealerCards.map((card) => (
                      <PlayingCard key={card.id} card={card} />
                    ))}
                  </div>
                  {state.dealerCards.length > 0 && (
                    <div className="hand-total">
                      {showDealerTotal ? dealerValue.total : "?"}
                      {showDealerTotal && dealerValue.soft ? " soft" : ""}
                    </div>
                  )}
                </div>

                <FeltMarkings bjLabel={bjLabel} dealerRule={dealerRule} />

                {waitingBets && (
                  <div className="table-wait-block">
                    <p className="table-wait-banner">WAITING FOR BETS</p>
                    {state.seats.length > 1 && (
                      <p className="table-bet-hint">
                        Betting for{" "}
                        <strong>{betSeat.isHuman ? "You" : betSeat.name}</strong>
                        {" — "}tap a seat to switch
                      </p>
                    )}
                  </div>
                )}

                <div className="seat-orbit" aria-label="Player seats">
                  {spots.map((seat, idx) => {
                    const angle = seatAngle(idx, MAX_SPOTS);
                    const style = {
                      ["--seat-angle" as string]: `${angle}deg`,
                    };

                    if (!seat) {
                      const showTipHere = showSeatTip && idx === tipSeatIndex;
                      return (
                        <button
                          key={`empty-${idx}`}
                          type="button"
                          className={`spot multi-seat ${showTipHere ? "tip-highlight" : ""}`}
                          style={style}
                          disabled={
                            !waitingBets || state.seats.length >= MAX_SPOTS
                          }
                          onClick={() => claimMultiSeat(idx)}
                        >
                          {showTipHere && (
                            <div
                              className="seat-tip"
                              role="status"
                              onClick={(e) => e.stopPropagation()}
                              onKeyDown={(e) => e.stopPropagation()}
                            >
                              <p>
                                Tap MULTI SEAT to add players · tap a seat to
                                set its bet
                              </p>
                              <span
                                role="button"
                                tabIndex={0}
                                className="seat-tip-dismiss"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  hideSeatTip();
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    hideSeatTip();
                                  }
                                }}
                              >
                                Got it
                              </span>
                            </div>
                          )}
                          <span className="multi-bubble">
                            <span className="multi-icon" aria-hidden="true">
                              <svg viewBox="0 0 24 24" width="22" height="22">
                                <circle
                                  cx="12"
                                  cy="8"
                                  r="3.2"
                                  fill="currentColor"
                                />
                                <path
                                  d="M5 19c0-3.2 3-5 7-5s7 1.8 7 5"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2.2"
                                  strokeLinecap="round"
                                />
                                <circle
                                  cx="18.5"
                                  cy="7.5"
                                  r="4"
                                  fill="#1a8f55"
                                />
                                <path
                                  d="M18.5 5.6v3.8M16.6 7.5h3.8"
                                  stroke="#fff"
                                  strokeWidth="1.6"
                                  strokeLinecap="round"
                                />
                              </svg>
                            </span>
                            <span className="multi-label">MULTI SEAT</span>
                          </span>
                        </button>
                      );
                    }

                    const isActive =
                      state.phase === "acting" &&
                      state.seats[state.activeSeatIndex]?.id === seat.id;

                    return (
                      <div
                        key={seat.id}
                        role={waitingBets ? "button" : undefined}
                        tabIndex={waitingBets ? 0 : undefined}
                        className={`spot occupied ${seat.isHuman ? "you" : "ai"} ${isActive ? "active" : ""} ${waitingBets && betSeatId === seat.id ? "bet-target" : ""}`}
                        style={style}
                        onClick={() => {
                          if (waitingBets) setBetSeatId(seat.id);
                        }}
                        onKeyDown={(e) => {
                          if (!waitingBets) return;
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setBetSeatId(seat.id);
                          }
                        }}
                      >
                        <div className="spot-cards">
                          {seat.hands.map((hand, hi) => {
                            const val = evaluateHand(hand.cards);
                            const isBj =
                              hand.result === "blackjack" || val.blackjack;
                            return (
                              <div
                                key={hand.id}
                                className={`hand-block ${isActive && seat.activeHandIndex === hi ? "active-hand" : ""} ${isBj ? "is-bj" : ""}`}
                              >
                                <div className="card-row">
                                  {hand.cards.map((card) => (
                                    <PlayingCard
                                      key={card.id}
                                      card={card}
                                      small={seat.hands.length > 1}
                                    />
                                  ))}
                                </div>
                                <div className="hand-meta">
                                  <span className="hand-total">
                                    {val.bust
                                      ? "BUST"
                                      : val.blackjack
                                        ? "BJ"
                                        : `${val.total}${val.soft ? " soft" : ""}`}
                                  </span>
                                  {hand.result && (
                                    <span
                                      className={`hand-result ${hand.result}`}
                                    >
                                      {hand.result}
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        <div className="bet-circle">
                          {!seat.isHuman && waitingBets && (
                            <button
                              type="button"
                              className="leave-seat"
                              title="Leave"
                              aria-label="Leave"
                              onClick={(e) => {
                                e.stopPropagation();
                                leaveSeat(seat.id);
                              }}
                            >
                              ×
                            </button>
                          )}
                          <div className="bet-circle-ring">
                            {(seat.hands[0]?.bet ?? seat.bet) > 0 && (
                              <div
                                key={`chips-${seat.id}-${seat.hands[0]?.bet ?? seat.bet}`}
                                className="on-circle-chips chip-toss"
                              >
                                <span className="mini-stack">
                                  <i />
                                  <i />
                                  <i />
                                </span>
                              </div>
                            )}
                            <strong>
                              ${seat.hands[0]?.bet ?? seat.bet}
                            </strong>
                            <span className="spot-label">
                              {seat.isHuman ? "YOU" : seat.name}
                            </span>
                          </div>
                          {(state.phase === "payout" ||
                            state.phase === "betting" ||
                            state.phase === "between") &&
                            seat.roundNet !== 0 && (
                              <span
                                className={`seat-net ${seat.roundNet > 0 ? "won" : "lost"}`}
                              >
                                {seat.roundNet > 0
                                  ? `Won $${seat.roundNet}`
                                  : `Lost $${Math.abs(seat.roundNet)}`}
                              </span>
                            )}
                          {state.phase === "payout" &&
                            seat.roundNet === 0 &&
                            seat.hands.length > 0 && (
                              <span className="seat-net push">Push</span>
                            )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="table-money" aria-live="polite">
                  <div className="money-pill">
                    <span className="money-label">BALANCE</span>
                    <AnimatedBalance
                      value={sharedBankroll}
                      infinite={state.settings.infiniteMoney}
                    />
                  </div>
                  <div className="money-pill">
                    <span className="money-label">TOTAL BET</span>
                    <strong>${totalBet}</strong>
                  </div>
                  {waitingBets && state.seats.length > 1 && (
                    <div className="money-pill bet-seat-pill">
                      <span className="money-label">
                        {betSeat.isHuman ? "YOU" : betSeat.name}
                      </span>
                      <strong>${betSeat.bet}</strong>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div
          className={`live-hud ${showActionHud ? "is-open" : "is-hidden"}`}
          aria-hidden={!showActionHud}
        >
          {showActionHud && (
            <>
              {!waitingBets && (
                <p className="live-status">{phaseBanner(state)}</p>
              )}

              {state.lastFeedback && state.settings.trainMode && (
                <div
                  className={`live-feedback ${state.lastFeedback.correct ? "ok" : "bad"}`}
                >
                  {state.lastFeedback.message}
                  {!state.lastFeedback.correct && (
                    <span> → {actionLabel(state.lastFeedback.expected)}</span>
                  )}
                </div>
              )}

              {waitingBets && (
                <div className="bet-controls">
                  <button
                    type="button"
                    className="round-ctrl"
                    onClick={() => setBetTo(state.settings.minBet)}
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    className="round-ctrl repeat"
                    onClick={() => setBetTo(lastBet)}
                  >
                    Repeat
                  </button>
                  <div className="chip-row">
                    {state.settings.chipValues.map((v) => (
                      <ChipStack
                        key={v}
                        value={v}
                        selected={selectedChip === v}
                        onClick={() => {
                          setSelectedChip(v);
                          setBetTo(betSeat.bet + v);
                        }}
                      />
                    ))}
                  </div>
                  <button
                    type="button"
                    className="round-ctrl"
                    onClick={() => changeBet(-selectedChip)}
                  >
                    −{selectedChip}
                  </button>
                </div>
              )}

              <div className="action-controls">
                {state.phase === "insurance" && (
                  <>
                    <button
                      type="button"
                      className="play-btn"
                      disabled={busy}
                      onClick={() => apply((s) => takeInsurance(s, true))}
                    >
                      Insurance
                    </button>
                    <button
                      type="button"
                      className="play-btn ghost"
                      disabled={busy}
                      onClick={() => apply((s) => takeInsurance(s, false))}
                    >
                      No insurance
                    </button>
                  </>
                )}

                {waitingBets && (
                  <button
                    type="button"
                    className="play-btn deal deal-pulse"
                    disabled={busy || totalBet < state.settings.minBet}
                    onClick={runDeal}
                  >
                    Deal
                  </button>
                )}

                {state.phase === "acting" &&
                  (
                    ["hit", "stand", "double", "split", "surrender"] as Action[]
                  ).map((action) => (
                    <button
                      key={action}
                      type="button"
                      className={`play-btn ${action}`}
                      disabled={!canAct || !actions.includes(action)}
                      onClick={() => onAction(action)}
                    >
                      {actionLabel(action)}
                    </button>
                  ))}
              </div>
            </>
          )}
        </div>
      </div>

      <SettingsPanel
        settings={state.settings}
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onChange={(patch: Partial<GameSettings>) =>
          apply((s) => updateSettings(s, patch))
        }
        onResetBankroll={() => apply(resetBankroll)}
        onAddPlayer={() => apply(addSeat)}
        onRemovePlayer={(id) => apply((s) => removeSeat(s, id))}
        playerCount={state.seats.length}
        extraSeatIds={state.seats.filter((s) => !s.isHuman).map((s) => s.id)}
        bankroll={sharedBankroll}
      />
    </div>
  );
}
