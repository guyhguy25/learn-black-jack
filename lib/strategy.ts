import {
  Card,
  dealerUpcardValue,
  evaluateHand,
  isPair,
  isTenValue,
  Rank,
  rankValue,
} from "./cards";

export type Action = "hit" | "stand" | "double" | "split" | "surrender";

export type StrategyContext = {
  cards: Card[];
  dealerUpcard: Card;
  canDouble: boolean;
  canSplit: boolean;
  canSurrender: boolean;
};

/** Late surrender H17 basic strategy from Blackjack Apprenticeship phrases. */
export function getCorrectAction(ctx: StrategyContext): Action {
  const { cards, dealerUpcard, canDouble, canSplit, canSurrender } = ctx;
  const up = dealerUpcardValue(dealerUpcard);
  const hand = evaluateHand(cards);

  // 1. Surrender (first two cards only) — not when we should split 8s
  if (canSurrender && cards.length === 2 && !hand.soft) {
    const pairOfEights =
      isPair(cards) && cards[0].rank === "8";
    if (!pairOfEights) {
      if (hand.total === 16 && up >= 9) return "surrender";
      if (hand.total === 15 && up === 10) return "surrender";
    }
  }

  // 2. Splits
  if (canSplit && isPair(cards)) {
    const splitAction = pairStrategy(cards[0].rank, up, canDouble);
    if (splitAction) return splitAction;
  }

  // 3 & 4. Soft / hard totals
  if (hand.soft) {
    return softStrategy(hand.total, up, canDouble);
  }
  return hardStrategy(hand.total, up, canDouble);
}

function pairStrategy(rank: Rank, up: number, canDouble: boolean): Action | null {
  if (rank === "A") return "split";
  if (isTenValue(rank)) return null; // never split tens — fall through to hard 20

  const v = rankValue(rank);

  if (v === 9) {
    // Split 2–9 except 7, otherwise stand
    if (up >= 2 && up <= 9 && up !== 7) return "split";
    return "stand";
  }
  if (v === 8) return "split";
  if (v === 7) {
    if (up >= 2 && up <= 7) return "split";
    return "hit";
  }
  if (v === 6) {
    if (up >= 2 && up <= 6) return "split";
    return "hit";
  }
  if (v === 5) {
    // Treat as hard 10
    if (canDouble && up >= 2 && up <= 9) return "double";
    return "hit";
  }
  if (v === 4) {
    if (up === 5 || up === 6) return "split";
    return "hit";
  }
  if (v === 3 || v === 2) {
    if (up >= 2 && up <= 7) return "split";
    return "hit";
  }
  return null;
}

function softStrategy(total: number, up: number, canDouble: boolean): Action {
  // Soft totals are Ace + X where total = 11 + X (when soft)
  if (total >= 20) return "stand"; // A,9
  if (total === 19) {
    // A,8 doubles vs 6 else stand
    if (canDouble && up === 6) return "double";
    return "stand";
  }
  if (total === 18) {
    // A,7 double 2–6, hit 9–A, else stand
    if (canDouble && up >= 2 && up <= 6) return "double";
    if (up >= 9) return "hit";
    return "stand";
  }
  if (total === 17) {
    if (canDouble && up >= 3 && up <= 6) return "double";
    return "hit";
  }
  if (total === 16 || total === 15) {
    if (canDouble && up >= 4 && up <= 6) return "double";
    return "hit";
  }
  if (total === 14 || total === 13) {
    if (canDouble && up >= 5 && up <= 6) return "double";
    return "hit";
  }
  return "hit";
}

function hardStrategy(total: number, up: number, canDouble: boolean): Action {
  if (total >= 17) return "stand";
  if (total >= 13 && total <= 16) {
    if (up >= 2 && up <= 6) return "stand";
    return "hit";
  }
  if (total === 12) {
    if (up >= 4 && up <= 6) return "stand";
    return "hit";
  }
  if (total === 11) {
    if (canDouble) return "double";
    return "hit";
  }
  if (total === 10) {
    if (canDouble && up >= 2 && up <= 9) return "double";
    return "hit";
  }
  if (total === 9) {
    if (canDouble && up >= 3 && up <= 6) return "double";
    return "hit";
  }
  return "hit"; // 8 and below
}

export function actionLabel(action: Action): string {
  switch (action) {
    case "hit":
      return "Hit";
    case "stand":
      return "Stand";
    case "double":
      return "Double";
    case "split":
      return "Split";
    case "surrender":
      return "Surrender";
  }
}

export function explainAction(action: Action, cards: Card[], dealerUp: Card): string {
  const hand = evaluateHand(cards);
  const up = dealerUp.rank === "A" ? "A" : String(dealerUpcardValue(dealerUp));
  const kind = hand.soft ? "Soft" : "Hard";
  return `${actionLabel(action)} — ${kind} ${hand.total} vs dealer ${up}`;
}
