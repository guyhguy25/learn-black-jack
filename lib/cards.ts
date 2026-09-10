export type Suit = "spades" | "hearts" | "diamonds" | "clubs";
export type Rank =
  | "A"
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9"
  | "10"
  | "J"
  | "Q"
  | "K";

export type Card = {
  id: string;
  suit: Suit;
  rank: Rank;
  faceDown?: boolean;
};

export const SUITS: Suit[] = ["spades", "hearts", "diamonds", "clubs"];
export const RANKS: Rank[] = [
  "A",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "J",
  "Q",
  "K",
];

export function rankValue(rank: Rank): number {
  if (rank === "A") return 11;
  if (rank === "J" || rank === "Q" || rank === "K") return 10;
  return Number(rank);
}

export function isTenValue(rank: Rank): boolean {
  return rankValue(rank) === 10;
}

export function createShoe(decks: number): Card[] {
  const shoe: Card[] = [];
  let n = 0;
  for (let d = 0; d < decks; d++) {
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        shoe.push({ id: `${d}-${suit}-${rank}-${n++}`, suit, rank });
      }
    }
  }
  return shuffle(shoe);
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export type HandValue = {
  total: number;
  soft: boolean;
  blackjack: boolean;
  bust: boolean;
};

export function evaluateHand(cards: Card[]): HandValue {
  const faceUp = cards.filter((c) => !c.faceDown);
  let total = 0;
  let aces = 0;

  for (const card of faceUp) {
    if (card.rank === "A") {
      aces += 1;
      total += 11;
    } else {
      total += rankValue(card.rank);
    }
  }

  while (total > 21 && aces > 0) {
    total -= 10;
    aces -= 1;
  }

  const soft = aces > 0 && total <= 21;
  const blackjack =
    faceUp.length === 2 && total === 21 && cards.length === 2 && !cards.some((c) => c.faceDown);

  return {
    total,
    soft,
    blackjack,
    bust: total > 21,
  };
}

export function isPair(cards: Card[]): boolean {
  if (cards.length !== 2) return false;
  return rankValue(cards[0].rank) === rankValue(cards[1].rank);
}

export function pairRank(cards: Card[]): Rank | null {
  if (!isPair(cards)) return null;
  return cards[0].rank;
}

export function dealerUpcardValue(card: Card): number {
  return rankValue(card.rank);
}

export function suitSymbol(suit: Suit): string {
  switch (suit) {
    case "spades":
      return "♠";
    case "hearts":
      return "♥";
    case "diamonds":
      return "♦";
    case "clubs":
      return "♣";
  }
}

export function isRed(suit: Suit): boolean {
  return suit === "hearts" || suit === "diamonds";
}
