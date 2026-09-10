"use client";

import { useEffect, useRef, useState } from "react";
import { Card, isRed, suitSymbol } from "@/lib/cards";

type Props = {
  card: Card;
  small?: boolean;
  /** Animate from the shoe on the right */
  fromShoe?: boolean;
};

export function PlayingCard({ card, small, fromShoe = true }: Props) {
  const [flipping, setFlipping] = useState(false);
  const wasDown = useRef(!!card.faceDown);

  useEffect(() => {
    if (wasDown.current && !card.faceDown) {
      setFlipping(true);
      const t = setTimeout(() => setFlipping(false), 560);
      wasDown.current = false;
      return () => clearTimeout(t);
    }
    wasDown.current = !!card.faceDown;
  }, [card.faceDown]);

  const red = !card.faceDown && isRed(card.suit);
  const symbol = suitSymbol(card.suit);

  const cls = [
    "playing-card",
    small ? "card-sm" : "",
    fromShoe ? "from-shoe" : "",
    flipping ? "is-flipping" : "",
    card.faceDown && !flipping ? "is-down" : "is-up",
    red ? "is-red" : "is-black",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={cls}
      aria-label={
        card.faceDown ? "Face-down card" : `${card.rank} of ${card.suit}`
      }
    >
      <div className="card-flipper">
        <div className="card-face-side">
          <div className="card-corner top">
            <span className="card-rank">{card.rank}</span>
            <span className="card-suit">{symbol}</span>
          </div>
          <div className="card-center">{symbol}</div>
          <div className="card-corner bottom">
            <span className="card-rank">{card.rank}</span>
            <span className="card-suit">{symbol}</span>
          </div>
        </div>
        <div className="card-back-side">
          <div className="card-back-pattern" />
        </div>
      </div>
    </div>
  );
}
