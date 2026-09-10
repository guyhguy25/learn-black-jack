"use client";

import { DEFAULT_SETTINGS, GameSettings } from "@/lib/game";

type Props = {
  settings: GameSettings;
  open: boolean;
  onClose: () => void;
  onChange: (patch: Partial<GameSettings>) => void;
  onResetBankroll: () => void;
  onAddPlayer: () => void;
  onRemovePlayer: (id: string) => void;
  playerCount: number;
  extraSeatIds: string[];
  bankroll: number;
};

export function SettingsPanel({
  settings,
  open,
  onClose,
  onChange,
  onResetBankroll,
  onAddPlayer,
  onRemovePlayer,
  playerCount,
  extraSeatIds,
  bankroll,
}: Props) {
  if (!open) return null;

  return (
    <div className="settings-overlay" role="dialog" aria-modal="true">
      <div className="settings-panel">
        <div className="settings-header">
          <h2>Table Settings</h2>
          <button type="button" className="ghost-btn" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="settings-grid">
          <label className="setting" htmlFor="setting-infinite-money">
            <span>Infinite money</span>
            <input
              id="setting-infinite-money"
              name="infiniteMoney"
              type="checkbox"
              checked={settings.infiniteMoney}
              onChange={(e) => onChange({ infiniteMoney: e.target.checked })}
            />
          </label>

          <label className="setting" htmlFor="setting-starting-bankroll">
            <span>Starting bankroll</span>
            <input
              id="setting-starting-bankroll"
              name="startingBankroll"
              type="number"
              min={100}
              step={100}
              value={settings.startingBankroll}
              onChange={(e) =>
                onChange({ startingBankroll: Number(e.target.value) || 1000 })
              }
            />
          </label>

          {!settings.infiniteMoney && (
            <div className="setting setting-stack">
              <span>
                Current balance: ${bankroll.toLocaleString("en-US")}
              </span>
              <button
                type="button"
                className="action-btn secondary"
                onClick={onResetBankroll}
              >
                Reset bankroll to ${settings.startingBankroll.toLocaleString("en-US")}
              </button>
            </div>
          )}

          <label className="setting" htmlFor="setting-min-bet">
            <span>Min bet</span>
            <input
              id="setting-min-bet"
              name="minBet"
              type="number"
              min={1}
              value={settings.minBet}
              onChange={(e) => onChange({ minBet: Number(e.target.value) || 1 })}
            />
          </label>

          <label className="setting" htmlFor="setting-max-bet">
            <span>Max bet</span>
            <input
              id="setting-max-bet"
              name="maxBet"
              type="number"
              min={1}
              value={settings.maxBet}
              onChange={(e) => onChange({ maxBet: Number(e.target.value) || 100 })}
            />
          </label>

          <label className="setting" htmlFor="setting-decks">
            <span>Decks in shoe</span>
            <select
              id="setting-decks"
              name="decks"
              value={settings.decks}
              onChange={(e) => onChange({ decks: Number(e.target.value) })}
            >
              {[1, 2, 4, 6, 8].map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </label>

          <label className="setting" htmlFor="setting-penetration">
            <span>Shuffle at % remaining</span>
            <input
              id="setting-penetration"
              name="penetration"
              type="number"
              min={10}
              max={75}
              value={Math.round(settings.penetration * 100)}
              onChange={(e) =>
                onChange({
                  penetration: Math.min(0.75, Math.max(0.1, Number(e.target.value) / 100)),
                })
              }
            />
          </label>

          <label className="setting" htmlFor="setting-blackjack-pays">
            <span>Blackjack pays</span>
            <select
              id="setting-blackjack-pays"
              name="blackjackPays"
              value={settings.blackjackPays}
              onChange={(e) =>
                onChange({ blackjackPays: e.target.value as "3:2" | "6:5" })
              }
            >
              <option value="3:2">3 to 2</option>
              <option value="6:5">6 to 5</option>
            </select>
          </label>

          <label className="setting" htmlFor="setting-dealer-soft-17">
            <span>Dealer soft 17</span>
            <select
              id="setting-dealer-soft-17"
              name="dealerHitsSoft17"
              value={settings.dealerHitsSoft17 ? "H17" : "S17"}
              onChange={(e) =>
                onChange({ dealerHitsSoft17: e.target.value === "H17" })
              }
            >
              <option value="H17">Hit soft 17 (H17)</option>
              <option value="S17">Stand on all 17s (S17)</option>
            </select>
          </label>

          <label className="setting" htmlFor="setting-surrender">
            <span>Late surrender</span>
            <input
              id="setting-surrender"
              name="surrenderAllowed"
              type="checkbox"
              checked={settings.surrenderAllowed}
              onChange={(e) => onChange({ surrenderAllowed: e.target.checked })}
            />
          </label>

          <label className="setting" htmlFor="setting-train-mode">
            <span>Strategy trainer feedback</span>
            <input
              id="setting-train-mode"
              name="trainMode"
              type="checkbox"
              checked={settings.trainMode}
              onChange={(e) => onChange({ trainMode: e.target.checked })}
            />
          </label>

          <label className="setting" htmlFor="setting-clear-table-delay">
            <span>Clear table after (sec)</span>
            <input
              id="setting-clear-table-delay"
              name="clearTableDelaySec"
              type="number"
              min={1}
              max={30}
              step={1}
              value={settings.clearTableDelaySec}
              onChange={(e) =>
                onChange({
                  clearTableDelaySec: Math.min(
                    30,
                    Math.max(1, Math.round(Number(e.target.value) || 5)),
                  ),
                })
              }
            />
          </label>
        </div>

        <div className="settings-players">
          <h3>Players ({playerCount}/5)</h3>
          <p className="hint">You always play. Extra seats use perfect basic strategy.</p>
          <div className="player-actions">
            <button
              type="button"
              className="action-btn secondary"
              disabled={playerCount >= 5}
              onClick={onAddPlayer}
            >
              Add player
            </button>
            {extraSeatIds.map((id, i) => (
              <button
                key={id}
                type="button"
                className="action-btn ghost"
                onClick={() => onRemovePlayer(id)}
              >
                Remove Player {i + 2}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          className="action-btn secondary"
          onClick={() => onChange({ ...DEFAULT_SETTINGS })}
        >
          Reset defaults
        </button>
      </div>
    </div>
  );
}
