"use client";

import { Action, actionLabel } from "@/lib/strategy";

type Props = {
  actions: Action[];
  phase: string;
  onAction: (action: Action) => void;
  onDeal: () => void;
  onNewRound: () => void;
  onInsurance: (take: boolean) => void;
  disabled?: boolean;
};

export function ActionBar({
  actions,
  phase,
  onAction,
  onDeal,
  onNewRound,
  onInsurance,
  disabled,
}: Props) {
  if (phase === "insurance") {
    return (
      <div className="action-bar">
        <p className="action-prompt">Dealer shows Ace — take insurance?</p>
        <div className="action-row">
          <button
            type="button"
            className="action-btn"
            disabled={disabled}
            onClick={() => onInsurance(true)}
          >
            Insurance
          </button>
          <button
            type="button"
            className="action-btn secondary"
            disabled={disabled}
            onClick={() => onInsurance(false)}
          >
            No insurance
          </button>
        </div>
      </div>
    );
  }

  if (phase === "betting" || phase === "between" || phase === "payout") {
    return (
      <div className="action-bar">
        <div className="action-row">
          {phase === "payout" && (
            <button
              type="button"
              className="action-btn secondary"
              disabled={disabled}
              onClick={onNewRound}
            >
              Change bet
            </button>
          )}
          <button
            type="button"
            className="action-btn deal"
            disabled={disabled}
            onClick={onDeal}
          >
            {phase === "payout" ? "Next hand" : "Deal"}
          </button>
        </div>
      </div>
    );
  }

  if (phase === "acting") {
    return (
      <div className="action-bar">
        <p className="action-prompt">Choose your play</p>
        <div className="action-row">
          {(["hit", "stand", "double", "split", "surrender"] as Action[]).map(
            (action) => (
              <button
                key={action}
                type="button"
                className={`action-btn ${action}`}
                disabled={disabled || !actions.includes(action)}
                onClick={() => onAction(action)}
              >
                {actionLabel(action)}
              </button>
            ),
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="action-bar">
      <p className="action-prompt">Dealer playing…</p>
    </div>
  );
}
