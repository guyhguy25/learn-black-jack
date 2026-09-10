import { DEFAULT_SETTINGS, GameSettings } from "./game";

const STORAGE_KEY = "learn-blackjack-v1";

export type PersistedTrainer = {
  settings: GameSettings;
  bankroll: number;
};

export function loadPersisted(): PersistedTrainer | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as Partial<PersistedTrainer>;
    if (!data || typeof data !== "object") return null;
    const saved = (data.settings ?? {}) as Partial<GameSettings>;
    const settings: GameSettings = { ...DEFAULT_SETTINGS, ...saved };
    // Legacy default was $500 — lift to the new table max unless already higher
    if (saved.maxBet === undefined || saved.maxBet === 500) {
      settings.maxBet = DEFAULT_SETTINGS.maxBet;
    }
    if (!saved.chipValues || saved.chipValues.length < DEFAULT_SETTINGS.chipValues.length) {
      settings.chipValues = DEFAULT_SETTINGS.chipValues;
    }
    return {
      settings,
      bankroll:
        typeof data.bankroll === "number" && Number.isFinite(data.bankroll)
          ? Math.max(0, Math.floor(data.bankroll))
          : DEFAULT_SETTINGS.startingBankroll,
    };
  } catch {
    return null;
  }
}

export function savePersisted(settings: GameSettings, bankroll: number) {
  if (typeof window === "undefined") return;
  try {
    const payload: PersistedTrainer = {
      settings,
      bankroll: Math.max(0, Math.floor(bankroll)),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // ignore quota / private mode
  }
}
