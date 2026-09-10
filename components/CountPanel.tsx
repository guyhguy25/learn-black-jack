"use client";

import { countLabel, trueCount } from "@/lib/counting";
import { cardsRemaining, GameState } from "@/lib/game";

type Props = {
  state: GameState;
  open: boolean;
  onClose: () => void;
  valuesHidden: boolean;
  onToggleValues: () => void;
};

export function CountPanel({
  state,
  open,
  onClose,
  valuesHidden,
  onToggleValues,
}: Props) {
  if (!open) return null;

  const remaining = cardsRemaining(state);
  const decksLeft = Math.max(remaining / 52, 0.5);
  const tc = trueCount(state.runningCount, remaining, state.settings.decks);
  const total = state.settings.decks * 52;
  const dealt = total - remaining;

  return (
    <aside className="float-overlay count-overlay" aria-label="Card count">
      <div className="float-overlay-header">
        <h2>Card Count</h2>
        <div className="float-header-actions">
          <button type="button" className="ghost-btn" onClick={onToggleValues}>
            {valuesHidden ? "Show numbers" : "Hide numbers"}
          </button>
          <button type="button" className="ghost-btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>

      {valuesHidden ? (
        <p className="count-hidden-msg">
          Numbers hidden — keep the count in your head.
        </p>
      ) : (
        <div className="count-stats">
          <div className="count-stat primary">
            <span className="label">Running</span>
            <span className="value">{countLabel(state.runningCount)}</span>
          </div>
          <div className="count-stat">
            <span className="label">True</span>
            <span className="value">{countLabel(tc)}</span>
          </div>
          <div className="count-stat">
            <span className="label">Decks left</span>
            <span className="value">{decksLeft.toFixed(1)}</span>
          </div>
          <div className="count-stat">
            <span className="label">Cards seen</span>
            <span className="value">
              {dealt}/{total}
            </span>
          </div>
        </div>
      )}

      <div className="hi-lo-key">
        <p className="key-title">Hi-Lo</p>
        <p>
          <span className="plus">+1</span> 2–6
        </p>
        <p>
          <span className="zero">0</span> 7–9
        </p>
        <p>
          <span className="minus">−1</span> 10–A
        </p>
      </div>
    </aside>
  );
}
