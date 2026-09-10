"use client";

import { Card } from "@/lib/cards";

type Props = {
  cards: Card[];
};

/** Left-side acrylic discard tray with stacked spent cards. */
export function DiscardTray({ cards }: Props) {
  const visible = cards.slice(-14);
  return (
    <div className="discard-tray" aria-hidden="true">
      <div className="discard-well">
        {visible.map((card, i) => (
          <div
            key={`${card.id}-${i}`}
            className="discard-card"
            style={{
              ["--i" as string]: i,
              transform: `translate(${(i % 3) - 1}px, ${-i * 1.15}px) rotate(${(i % 5) - 2}deg)`,
            }}
          />
        ))}
      </div>
      {cards.length > 0 && (
        <span className="discard-count">{cards.length}</span>
      )}
    </div>
  );
}
