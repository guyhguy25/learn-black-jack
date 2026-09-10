import {
  Card,
  createShoe,
  evaluateHand,
  HandValue,
  isPair,
  rankValue,
} from "./cards";
import { getCorrectAction, Action } from "./strategy";
import { updateRunningCount } from "./counting";

export type HandResult =
  | "win"
  | "lose"
  | "push"
  | "blackjack"
  | "surrender"
  | "bust"
  | "pending";

export type PlayerHand = {
  id: string;
  cards: Card[];
  bet: number;
  doubled: boolean;
  surrendered: boolean;
  fromSplit: boolean;
  stood: boolean;
  result?: Exclude<HandResult, "pending">;
  payout?: number;
};

export type Seat = {
  id: string;
  name: string;
  isHuman: boolean;
  /** Fixed table position: 0 = player's far right (deals first) … 4 = far left. */
  spot: number;
  bankroll: number;
  hands: PlayerHand[];
  activeHandIndex: number;
  bet: number;
  insured: boolean;
  insuranceBet: number;
  /** Net profit/loss for the last settled round (stake already accounted). */
  roundNet: number;
};

export type Phase =
  | "betting"
  | "dealing"
  | "insurance"
  | "acting"
  | "dealer"
  | "payout"
  | "between";

export type StrategyFeedback = {
  correct: boolean;
  chosen: Action;
  expected: Action;
  message: string;
} | null;

export type GameSettings = {
  decks: number;
  penetration: number; // reshuffle when this fraction of shoe remains
  startingBankroll: number;
  infiniteMoney: boolean;
  minBet: number;
  maxBet: number;
  blackjackPays: "3:2" | "6:5";
  dealerHitsSoft17: boolean;
  surrenderAllowed: boolean;
  doubleAfterSplit: boolean;
  maxSplits: number;
  showCount: boolean;
  showChart: boolean;
  trainMode: boolean; // flash correct/incorrect
  autoPlayOthers: boolean;
  chipValues: number[];
  /** Seconds to leave cards on the table after payout before clearing */
  clearTableDelaySec: number;
};

export const DEFAULT_SETTINGS: GameSettings = {
  decks: 6,
  penetration: 0.25,
  startingBankroll: 10000,
  infiniteMoney: true,
  minBet: 10,
  maxBet: 5000,
  blackjackPays: "3:2",
  dealerHitsSoft17: true,
  surrenderAllowed: true,
  doubleAfterSplit: true,
  maxSplits: 3,
  showCount: true,
  showChart: true,
  trainMode: true,
  autoPlayOthers: false,
  chipValues: [5, 10, 25, 100, 500, 1000],
  clearTableDelaySec: 5,
};

export type GameState = {
  settings: GameSettings;
  shoe: Card[];
  discard: Card[];
  seats: Seat[];
  dealerCards: Card[];
  phase: Phase;
  activeSeatIndex: number;
  runningCount: number;
  handsPlayed: number;
  correctDecisions: number;
  wrongDecisions: number;
  lastFeedback: StrategyFeedback;
  message: string;
  needsShuffle: boolean;
};

let handIdCounter = 0;
function nextHandId() {
  return `hand-${++handIdCounter}`;
}

export function createInitialState(settings: GameSettings = DEFAULT_SETTINGS): GameState {
  return {
    settings,
    shoe: createShoe(settings.decks),
    discard: [],
    seats: [
      {
        id: "seat-0",
        name: "You",
        isHuman: true,
        spot: 2,
        bankroll: settings.startingBankroll,
        hands: [],
        activeHandIndex: 0,
        bet: settings.minBet,
        insured: false,
        insuranceBet: 0,
        roundNet: 0,
      },
    ],
    dealerCards: [],
    phase: "betting",
    activeSeatIndex: 0,
    runningCount: 0,
    handsPlayed: 0,
    correctDecisions: 0,
    wrongDecisions: 0,
    lastFeedback: null,
    message: "Place your bet and deal.",
    needsShuffle: false,
  };
}

/** Shared purse — all multi-seat bets/wins use the human bankroll. */
export function getSharedBankroll(state: GameState): number {
  return state.seats.find((s) => s.isHuman)?.bankroll ?? 0;
}

function purse(state: GameState): Seat {
  return state.seats.find((s) => s.isHuman)!;
}

function chargeBet(state: GameState, amount: number) {
  if (state.settings.infiniteMoney || amount <= 0) return;
  purse(state).bankroll -= amount;
}

function credit(state: GameState, amount: number) {
  if (state.settings.infiniteMoney || amount <= 0) return;
  purse(state).bankroll += amount;
}

function draw(state: GameState, faceDown = false): Card {
  if (state.shoe.length === 0) {
    state.shoe = createShoe(state.settings.decks);
    state.discard = [];
    state.runningCount = 0;
    state.needsShuffle = false;
  }
  const card = { ...state.shoe.pop()!, faceDown };
  if (!faceDown) {
    state.runningCount = updateRunningCount(state.runningCount, card);
  }
  return card;
}

function revealHoleCard(state: GameState) {
  const hole = state.dealerCards.find((c) => c.faceDown);
  if (hole) {
    hole.faceDown = false;
    state.runningCount = updateRunningCount(state.runningCount, hole);
  }
}

export function cardsRemaining(state: GameState): number {
  return state.shoe.length;
}

function syncSharedBankrollDisplay(state: GameState) {
  // Keep seat.bankroll mirrors in sync for any legacy reads
  const shared = getSharedBankroll(state);
  for (const seat of state.seats) {
    if (!seat.isHuman) seat.bankroll = shared;
  }
}

export function setSeatBet(state: GameState, seatId: string, bet: number): GameState {
  if (
    state.phase !== "betting" &&
    state.phase !== "between" &&
    state.phase !== "payout"
  ) {
    return state;
  }
  const next = { ...state, seats: state.seats.map((s) => ({ ...s })) };
  const seat = next.seats.find((s) => s.id === seatId);
  if (!seat) return state;
  const clamped = Math.max(
    next.settings.minBet,
    Math.min(next.settings.maxBet, bet),
  );
  seat.bet = clamped;
  return next;
}

export function addSeat(state: GameState, preferredSpot?: number): GameState {
  if (state.seats.length >= 5) return state;
  if (
    state.phase !== "betting" &&
    state.phase !== "between" &&
    state.phase !== "payout"
  ) {
    return state;
  }
  const occupied = new Set(state.seats.map((s) => s.spot));
  const fallback = [1, 3, 0, 4];
  let spot = preferredSpot;
  if (
    spot === undefined ||
    !Number.isInteger(spot) ||
    spot < 0 ||
    spot > 4 ||
    occupied.has(spot)
  ) {
    spot = fallback.find((i) => !occupied.has(i));
  }
  if (spot === undefined) return state;

  const n = state.seats.length;
  const humanBet =
    state.seats.find((s) => s.isHuman)?.bet ?? state.settings.minBet;
  return {
    ...state,
    seats: [
      ...state.seats,
      {
        id: `seat-spot-${spot}`,
        name: `Player ${n + 1}`,
        isHuman: false,
        spot,
        bankroll: getSharedBankroll(state),
        hands: [],
        activeHandIndex: 0,
        bet: humanBet,
        insured: false,
        insuranceBet: 0,
        roundNet: 0,
      },
    ],
    message: `Added Player ${n + 1}.`,
  };
}

export function removeSeat(state: GameState, seatId: string): GameState {
  if (state.seats.length <= 1) return state;
  if (
    state.phase !== "betting" &&
    state.phase !== "between" &&
    state.phase !== "payout"
  ) {
    return state;
  }
  const seat = state.seats.find((s) => s.id === seatId);
  if (!seat || seat.isHuman) return state;
  return {
    ...state,
    seats: state.seats.filter((s) => s.id !== seatId),
    message: "Removed a player.",
  };
}

export function updateSettings(
  state: GameState,
  patch: Partial<GameSettings>,
): GameState {
  const settings = { ...state.settings, ...patch };
  const shared = getSharedBankroll(state);
  let bankroll = shared;

  if (patch.infiniteMoney === true) {
    bankroll = settings.startingBankroll;
  } else if (patch.infiniteMoney === false && state.settings.infiniteMoney) {
    bankroll = settings.startingBankroll;
  } else if (patch.startingBankroll !== undefined) {
    // Changing starting bankroll always tops up / resets the purse
    bankroll = settings.startingBankroll;
  }

  const seats = state.seats.map((s) => ({
    ...s,
    bankroll: s.isHuman ? bankroll : bankroll,
    bet: Math.max(settings.minBet, Math.min(settings.maxBet, s.bet)),
  }));

  let shoe = state.shoe;
  let discard = state.discard;
  let runningCount = state.runningCount;
  if (patch.decks !== undefined && patch.decks !== state.settings.decks) {
    shoe = createShoe(settings.decks);
    discard = [];
    runningCount = 0;
  }

  return {
    ...state,
    settings,
    seats,
    shoe,
    discard,
    runningCount,
    phase: "betting",
    dealerCards: [],
    lastFeedback: null,
    message: "Settings updated. Place bets.",
  };
}

/** Restore shared bankroll to the configured starting amount. */
export function resetBankroll(state: GameState): GameState {
  const amount = Math.max(0, state.settings.startingBankroll);
  return {
    ...state,
    seats: state.seats.map((s) => ({
      ...s,
      bankroll: amount,
      bet: Math.min(
        state.settings.maxBet,
        Math.max(state.settings.minBet, s.bet),
      ),
    })),
    phase:
      state.phase === "betting" ||
      state.phase === "between" ||
      state.phase === "payout"
        ? "betting"
        : state.phase,
    message: `Bankroll reset to $${amount.toLocaleString("en-US")}.`,
  };
}

export function beginDeal(state: GameState): GameState {
  if (
    state.phase !== "betting" &&
    state.phase !== "between" &&
    state.phase !== "payout"
  ) {
    return state;
  }

  let next = state.phase === "payout" ? newRound(state) : cloneState(state);

  next = {
    ...next,
    seats: next.seats.map((s) => ({
      ...s,
      hands: [],
      activeHandIndex: 0,
      insured: false,
      insuranceBet: 0,
      roundNet: 0,
    })),
    dealerCards: [],
    lastFeedback: null,
    message: "Dealing…",
  };

  const totalCards = next.settings.decks * 52;
  if (next.shoe.length / totalCards <= next.settings.penetration) {
    next.shoe = createShoe(next.settings.decks);
    next.discard = [];
    next.runningCount = 0;
    next.needsShuffle = false;
    next.message = "Shoe shuffled. Dealing…";
  }

  let remaining = getSharedBankroll(next);
  for (const seat of next.seats) {
    let bet = Math.max(
      next.settings.minBet,
      Math.min(next.settings.maxBet, seat.bet || next.settings.minBet),
    );
    if (!next.settings.infiniteMoney) {
      if (remaining < next.settings.minBet) break;
      if (remaining < bet) bet = remaining;
    }

    seat.bet = bet;
    chargeBet(next, bet);
    if (!next.settings.infiniteMoney) remaining -= bet;
    seat.hands = [
      {
        id: nextHandId(),
        cards: [],
        bet,
        doubled: false,
        surrendered: false,
        fromSplit: false,
        stood: false,
      },
    ];
  }

  syncSharedBankrollDisplay(next);

  const activeSeats = next.seats.filter((s) => s.hands.length > 0);
  if (activeSeats.length === 0) {
    next.message = "Not enough bankroll to deal.";
    next.phase = "betting";
    return next;
  }

  next.phase = "dealing";
  return next;
}

/** Deal exactly one card in standard order. Call repeatedly during phase "dealing". */
export function dealNextCard(state: GameState): GameState {
  if (state.phase !== "dealing") return state;
  const next = cloneState(state);
  const activeSeats = seatsInActionOrder(
    next.seats.filter((s) => s.hands.length > 0),
  );

  for (let round = 0; round < 2; round++) {
    for (const seat of activeSeats) {
      if (seat.hands[0].cards.length === round) {
        seat.hands[0].cards.push(draw(next));
        return next;
      }
    }
    if (next.dealerCards.length === round) {
      next.dealerCards.push(draw(next, round === 1));
      return next;
    }
  }

  // All initial cards dealt
  const upcard = next.dealerCards.find((c) => !c.faceDown)!;
  if (upcard.rank === "A") {
    next.phase = "insurance";
    next.message = "Insurance?";
    return next;
  }
  if (rankValue(upcard.rank) === 10) {
    return resolveDealerBlackjackCheck(next);
  }
  return afterDealChecks(next);
}

export function dealRound(state: GameState): GameState {
  let next = beginDeal(state);
  if (next.phase !== "dealing") return next;
  let guard = 0;
  while (next.phase === "dealing" && guard++ < 40) {
    next = dealNextCard(next);
  }
  return next;
}

export function takeInsurance(state: GameState, take: boolean): GameState {
  if (state.phase !== "insurance") return state;
  const next = cloneState(state);
  const human = next.seats.find((s) => s.isHuman);
  if (human && take) {
    const amount = Math.floor(human.bet / 2);
    human.insured = true;
    human.insuranceBet = amount;
    chargeBet(next, amount);
  }

  return resolveDealerBlackjackCheck(next);
}

function resolveDealerBlackjackCheck(state: GameState): GameState {
  const dealerVal = evaluateHand(
    state.dealerCards.map((c) => ({ ...c, faceDown: false })),
  );
  // Peek for blackjack when upcard is A or 10
  const up = state.dealerCards.find((c) => !c.faceDown)!;
  const hole = state.dealerCards.find((c) => c.faceDown)!;
  const isTenOrAce = up.rank === "A" || rankValue(up.rank) === 10;

  if (isTenOrAce && evaluateHand([up, { ...hole, faceDown: false }]).blackjack) {
    revealHoleCard(state);
    settleAll(state);
    state.phase = "payout";
    state.message = "Dealer has blackjack.";
    state.handsPlayed += 1;
    return state;
  }

  // Insurance lost if taken
  for (const seat of state.seats) {
    if (seat.insured) {
      seat.insuranceBet = 0;
      // already charged; nothing to refund
    }
  }

  return afterDealChecks(state);
}

function afterDealChecks(state: GameState): GameState {
  // Natural blackjacks: lock hand (paid 3:2 at settle)
  let anyActing = false;
  for (const seat of state.seats) {
    for (const hand of seat.hands) {
      const val = evaluateHand(hand.cards);
      if (val.blackjack) {
        hand.stood = true;
        hand.result = "blackjack";
      } else if (val.total >= 21) {
        hand.stood = true;
      } else {
        anyActing = true;
      }
    }
  }

  if (!anyActing) {
    revealHoleCard(state);
    settleAll(state);
    state.phase = "payout";
    state.message = "Round complete.";
    state.handsPlayed += 1;
    return state;
  }

  state.phase = "acting";
  return advanceToNextActor(state);
}

function cloneState(state: GameState): GameState {
  return {
    ...state,
    settings: { ...state.settings },
    shoe: [...state.shoe],
    discard: [...state.discard],
    seats: state.seats.map((s) => ({
      ...s,
      hands: s.hands.map((h) => ({
        ...h,
        cards: h.cards.map((c) => ({ ...c })),
      })),
    })),
    dealerCards: state.dealerCards.map((c) => ({ ...c })),
    lastFeedback: state.lastFeedback ? { ...state.lastFeedback } : null,
  };
}

function findActiveHand(
  state: GameState,
): { seat: Seat; hand: PlayerHand; seatIndex: number; handIndex: number } | null {
  for (const seat of seatsInActionOrder(state.seats)) {
    for (let j = 0; j < seat.hands.length; j++) {
      const hand = seat.hands[j];
      if (handIsDone(hand)) continue;
      const seatIndex = state.seats.findIndex((s) => s.id === seat.id);
      return { seat, hand, seatIndex, handIndex: j };
    }
  }
  return null;
}

function getActiveHand(state: GameState): { seat: Seat; hand: PlayerHand } | null {
  const found = findActiveHand(state);
  if (!found) return null;
  state.activeSeatIndex = found.seatIndex;
  found.seat.activeHandIndex = found.handIndex;
  return { seat: found.seat, hand: found.hand };
}

function handCapabilities(state: GameState, seat: Seat, hand: PlayerHand) {
  const val = evaluateHand(hand.cards);
  const canHit =
    !hand.stood &&
    !hand.surrendered &&
    !val.bust &&
    !val.blackjack &&
    val.total < 21;
  const canStand = canHit;
  const canDouble =
    canHit &&
    hand.cards.length === 2 &&
    (!hand.fromSplit || state.settings.doubleAfterSplit) &&
    (state.settings.infiniteMoney || getSharedBankroll(state) >= hand.bet);
  const splitsUsed = seat.hands.filter((h) => h.fromSplit).length;
  const canSplit =
    canHit &&
    hand.cards.length === 2 &&
    isPair(hand.cards) &&
    splitsUsed < state.settings.maxSplits &&
    (state.settings.infiniteMoney || getSharedBankroll(state) >= hand.bet);
  const canSurrender =
    state.settings.surrenderAllowed &&
    canHit &&
    hand.cards.length === 2 &&
    !hand.fromSplit;

  return { canHit, canStand, canDouble, canSplit, canSurrender };
}

export function getAvailableActions(state: GameState): Action[] {
  if (state.phase !== "acting") return [];
  const found = findActiveHand(state);
  if (!found) return [];
  const caps = handCapabilities(state, found.seat, found.hand);
  const actions: Action[] = [];
  if (caps.canHit) actions.push("hit");
  if (caps.canStand) actions.push("stand");
  if (caps.canDouble) actions.push("double");
  if (caps.canSplit) actions.push("split");
  if (caps.canSurrender) actions.push("surrender");
  return actions;
}

function recordDecision(
  state: GameState,
  chosen: Action,
  seat: Seat,
  hand: PlayerHand,
): void {
  if (!seat.isHuman || !state.settings.trainMode) return;
  const dealerUp = state.dealerCards.find((c) => !c.faceDown)!;
  const caps = handCapabilities(state, seat, hand);
  const expected = getCorrectAction({
    cards: hand.cards,
    dealerUpcard: dealerUp,
    canDouble: caps.canDouble,
    canSplit: caps.canSplit,
    canSurrender: caps.canSurrender,
  });

  // If expected is double but can't double, fall back appropriately
  let expectedAdj = expected;
  if (expected === "double" && !caps.canDouble) {
    expectedAdj = getCorrectAction({
      cards: hand.cards,
      dealerUpcard: dealerUp,
      canDouble: false,
      canSplit: caps.canSplit,
      canSurrender: caps.canSurrender,
    });
  }
  if (expected === "surrender" && !caps.canSurrender) {
    expectedAdj = getCorrectAction({
      cards: hand.cards,
      dealerUpcard: dealerUp,
      canDouble: caps.canDouble,
      canSplit: caps.canSplit,
      canSurrender: false,
    });
  }
  if (expected === "split" && !caps.canSplit) {
    expectedAdj = getCorrectAction({
      cards: hand.cards,
      dealerUpcard: dealerUp,
      canDouble: caps.canDouble,
      canSplit: false,
      canSurrender: caps.canSurrender,
    });
  }

  const correct = chosen === expectedAdj;
  if (correct) state.correctDecisions += 1;
  else state.wrongDecisions += 1;

  state.lastFeedback = {
    correct,
    chosen,
    expected: expectedAdj,
    message: correct
      ? `Correct — ${expectedAdj.toUpperCase()}`
      : `Wrong — you chose ${chosen.toUpperCase()}, basic strategy says ${expectedAdj.toUpperCase()}`,
  };
}

export function playerAction(state: GameState, action: Action): GameState {
  if (state.phase !== "acting") return state;
  const next = cloneState(state);
  const active = getActiveHand(next);
  if (!active) return finishPlayerActions(next);

  const { seat, hand } = active;
  const caps = handCapabilities(next, seat, hand);

  if (action === "hit" && !caps.canHit) return state;
  if (action === "stand" && !caps.canStand) return state;
  if (action === "double" && !caps.canDouble) return state;
  if (action === "split" && !caps.canSplit) return state;
  if (action === "surrender" && !caps.canSurrender) return state;

  if (seat.isHuman) {
    recordDecision(next, action, seat, hand);
  }

  applyActionToHand(next, seat, hand, action);
  return advanceToNextActor(next);
}

function applyActionToHand(
  state: GameState,
  seat: Seat,
  hand: PlayerHand,
  action: Action,
): void {
  switch (action) {
    case "hit": {
      hand.cards.push(draw(state));
      const val = evaluateHand(hand.cards);
      if (val.bust) {
        hand.stood = true;
        hand.result = "bust";
      } else if (val.total >= 21) {
        // 21 — no further action
        hand.stood = true;
      }
      break;
    }
    case "stand": {
      hand.stood = true;
      break;
    }
    case "double": {
      chargeBet(state, hand.bet);
      hand.bet *= 2;
      hand.doubled = true;
      hand.cards.push(draw(state));
      hand.stood = true;
      if (evaluateHand(hand.cards).bust) hand.result = "bust";
      break;
    }
    case "split": {
      chargeBet(state, hand.bet);
      const [c1, c2] = hand.cards;
      hand.cards = [c1];
      hand.fromSplit = true;
      const newHand: PlayerHand = {
        id: nextHandId(),
        cards: [c2],
        bet: hand.bet,
        doubled: false,
        surrendered: false,
        fromSplit: true,
        stood: false,
      };
      const idx = seat.hands.indexOf(hand);
      seat.hands.splice(idx + 1, 0, newHand);
      hand.cards.push(draw(state));
      newHand.cards.push(draw(state));

      if (c1.rank === "A") {
        hand.stood = true;
        newHand.stood = true;
      }
      break;
    }
    case "surrender": {
      hand.surrendered = true;
      hand.stood = true;
      hand.result = "surrender";
      break;
    }
  }
}

function basicStrategyPlay(state: GameState, seat: Seat, hand: PlayerHand): Action {
  const caps = handCapabilities(state, seat, hand);
  const dealerUp = state.dealerCards.find((c) => !c.faceDown)!;
  let action = getCorrectAction({
    cards: hand.cards,
    dealerUpcard: dealerUp,
    canDouble: caps.canDouble,
    canSplit: caps.canSplit,
    canSurrender: caps.canSurrender,
  });
  if (action === "double" && !caps.canDouble) action = "hit";
  if (action === "split" && !caps.canSplit) {
    action = getCorrectAction({
      cards: hand.cards,
      dealerUpcard: dealerUp,
      canDouble: caps.canDouble,
      canSplit: false,
      canSurrender: caps.canSurrender,
    });
  }
  if (action === "surrender" && !caps.canSurrender) {
    action = getCorrectAction({
      cards: hand.cards,
      dealerUpcard: dealerUp,
      canDouble: caps.canDouble,
      canSplit: caps.canSplit,
      canSurrender: false,
    });
  }
  const available: Action[] = [];
  if (caps.canHit) available.push("hit");
  if (caps.canStand) available.push("stand");
  if (caps.canDouble) available.push("double");
  if (caps.canSplit) available.push("split");
  if (caps.canSurrender) available.push("surrender");
  if (!available.includes(action)) {
    if (available.includes("stand")) return "stand";
    if (available.includes("hit")) return "hit";
    return available[0] ?? "stand";
  }
  return action;
}

function advanceToNextActor(state: GameState): GameState {
  const current = state;
  for (let guard = 0; guard < 100; guard++) {
    const active = getActiveHand(current);
    if (!active) return finishPlayerActions(current);

    const { seat, hand } = active;
    const auto =
      current.settings.autoPlayOthers && !seat.isHuman;

    if (!auto) {
      current.message = seat.isHuman
        ? `Your turn${seat.hands.length > 1 ? ` — hand ${seat.activeHandIndex + 1}` : ""}`
        : `${seat.name}'s turn`;
      return current;
    }

    const action = basicStrategyPlay(current, seat, hand);
    applyActionToHand(current, seat, hand, action);
  }
  return finishPlayerActions(current);
}

function finishPlayerActions(state: GameState): GameState {
  const anyLive = state.seats.some((s) =>
    s.hands.some(
      (h) =>
        !h.surrendered &&
        h.result !== "bust" &&
        h.result !== "blackjack" &&
        !evaluateHand(h.cards).bust,
    ),
  );

  revealHoleCard(state);

  if (anyLive) {
    state.phase = "dealer";
    state.message = "Dealer playing…";
    return state;
  }

  settleAll(state);
  state.phase = "payout";
  state.handsPlayed += 1;
  state.message = "Round complete.";
  return state;
}

function dealerNeedsHit(state: GameState): boolean {
  const val = evaluateHand(state.dealerCards);
  if (val.bust || val.total > 17) return false;
  if (val.total === 17) {
    return val.soft && state.settings.dealerHitsSoft17;
  }
  return true;
}

/** Draw at most one dealer card, or settle when done. */
export function stepDealer(state: GameState): GameState {
  if (state.phase !== "dealer") return state;
  const next = cloneState(state);

  if (dealerNeedsHit(next)) {
    next.dealerCards.push(draw(next));
    return next;
  }

  settleAll(next);
  next.phase = "payout";
  next.handsPlayed += 1;
  next.message = "Round complete.";
  return next;
}

function bjPayout(bet: number, pays: "3:2" | "6:5"): number {
  if (pays === "3:2") return bet + bet * 1.5;
  return bet + (bet * 6) / 5;
}

/**
 * Spot 0 is the player's far right (CSS angle −spread/2), spot 4 far left.
 * Deal and action always run right → left (dealer's left first).
 */
export function seatsByTableSpot(seats: Seat[]): Array<Seat | null> {
  const spots: Array<Seat | null> = Array(5).fill(null);
  for (const seat of seats) {
    const i = Math.max(0, Math.min(4, seat.spot ?? 2));
    spots[i] = seat;
  }
  return spots;
}

export function seatsInActionOrder(seats: Seat[]): Seat[] {
  // Ascending spot index = far right → far left
  return seatsByTableSpot(seats).filter((s): s is Seat => s !== null);
}

function handIsDone(hand: PlayerHand): boolean {
  if (hand.stood || hand.surrendered) return true;
  if (hand.result === "bust" || hand.result === "blackjack") return true;
  const val = evaluateHand(hand.cards);
  if (val.bust || val.blackjack) return true;
  if (val.total >= 21) return true;
  return false;
}

function settleAll(state: GameState) {
  const dealerVal = evaluateHand(state.dealerCards);
  const dealerBJ = dealerVal.blackjack;

  for (const seat of state.seats) {
    let net = 0;

    // Insurance
    if (seat.insured && dealerBJ) {
      credit(state, seat.insuranceBet * 3); // 2:1 + stake back
      net += seat.insuranceBet * 2; // profit on insurance
    } else if (seat.insured) {
      net -= seat.insuranceBet;
    }

    for (const hand of seat.hands) {
      if (hand.result === "surrender") {
        credit(state, hand.bet / 2);
        hand.payout = hand.bet / 2;
        net += hand.payout - hand.bet;
        continue;
      }

      const val = evaluateHand(hand.cards);

      if (hand.result === "blackjack" || val.blackjack) {
        if (dealerBJ) {
          hand.result = "push";
          credit(state, hand.bet);
          hand.payout = hand.bet;
          net += 0;
        } else {
          hand.result = "blackjack";
          const pay = bjPayout(hand.bet, state.settings.blackjackPays);
          credit(state, pay);
          hand.payout = pay;
          net += pay - hand.bet;
        }
        continue;
      }

      if (val.bust || hand.result === "bust") {
        hand.result = "bust";
        hand.payout = 0;
        net -= hand.bet;
        continue;
      }

      if (dealerBJ) {
        hand.result = "lose";
        hand.payout = 0;
        net -= hand.bet;
        continue;
      }

      if (dealerVal.bust) {
        hand.result = "win";
        credit(state, hand.bet * 2);
        hand.payout = hand.bet * 2;
        net += hand.bet;
        continue;
      }

      if (val.total > dealerVal.total) {
        hand.result = "win";
        credit(state, hand.bet * 2);
        hand.payout = hand.bet * 2;
        net += hand.bet;
      } else if (val.total < dealerVal.total) {
        hand.result = "lose";
        hand.payout = 0;
        net -= hand.bet;
      } else {
        hand.result = "push";
        credit(state, hand.bet);
        hand.payout = hand.bet;
        net += 0;
      }
    }

    seat.roundNet = net;
  }

  syncSharedBankrollDisplay(state);
}

export function newRound(state: GameState): GameState {
  const next = cloneState(state);
  for (const seat of next.seats) {
    for (const hand of seat.hands) {
      next.discard.push(...hand.cards);
    }
    seat.hands = [];
  }
  next.discard.push(...next.dealerCards);
  next.dealerCards = [];
  next.phase = "betting";
  next.lastFeedback = null;
  next.message = "Place your bet.";
  return next;
}

export function dealerHandValue(state: GameState): HandValue {
  return evaluateHand(state.dealerCards);
}

export function accuracy(state: GameState): number {
  const total = state.correctDecisions + state.wrongDecisions;
  if (total === 0) return 100;
  return Math.round((state.correctDecisions / total) * 1000) / 10;
}
