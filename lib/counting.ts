import { Card, Rank } from "./cards";

/** Hi-Lo card counting values. */
export function hiLoValue(rank: Rank): number {
  switch (rank) {
    case "2":
    case "3":
    case "4":
    case "5":
    case "6":
      return 1;
    case "7":
    case "8":
    case "9":
      return 0;
    case "10":
    case "J":
    case "Q":
    case "K":
    case "A":
      return -1;
  }
}

export function updateRunningCount(running: number, card: Card): number {
  if (card.faceDown) return running;
  return running + hiLoValue(card.rank);
}

export function trueCount(running: number, cardsRemaining: number, decks: number): number {
  const decksRemaining = Math.max(cardsRemaining / 52, 0.5);
  return Math.round((running / decksRemaining) * 10) / 10;
}

export function countLabel(value: number): string {
  if (value > 0) return `+${value}`;
  return String(value);
}
