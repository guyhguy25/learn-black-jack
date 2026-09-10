/** Shared breakpoint for phone / landscape-phone layout */
export const NARROW_MQ =
  "(max-width: 700px), (max-height: 520px) and (orientation: landscape)";

export const TABLE_W = 1100;
export const TABLE_H = 700;

export function isNarrowViewport(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia(NARROW_MQ).matches;
}

/** Fit the full artboard in the visible phone viewport (contain — never crop-zoom). */
export function computeTableScale(opts: {
  mobile: boolean;
  width: number;
  height: number;
}): number {
  const byW = Math.max(1, opts.width) / TABLE_W;
  const byH = Math.max(1, opts.height) / TABLE_H;
  if (opts.mobile) {
    return Math.max(0.14, Math.min(byW, byH) * 0.96);
  }
  return Math.max(0.38, Math.min(byW, byH, 1.55));
}

export function measureMobileTableBox(stage: HTMLElement | null): {
  width: number;
  height: number;
} {
  const viewW = window.visualViewport?.width ?? window.innerWidth;
  const viewH = window.visualViewport?.height ?? window.innerHeight;
  const casino = stage?.closest(".live-casino") as HTMLElement | null;
  const top = casino?.querySelector(".live-top") as HTMLElement | null;
  const hud = stage?.querySelector(".live-hud") as HTMLElement | null;
  const topH = top?.getBoundingClientRect().height ?? 52;
  const hudH = hud?.getBoundingClientRect().height ?? 150;
  const stageW = stage?.clientWidth || viewW;
  return {
    width: Math.max(1, stageW - 8),
    height: Math.max(120, viewH - topH - hudH - 8),
  };
}
