"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  value: number;
  infinite?: boolean;
  className?: string;
};

/** Tweens numeric bankroll display and flashes on change. */
export function AnimatedBalance({ value, infinite, className }: Props) {
  const [display, setDisplay] = useState(value);
  const [flash, setFlash] = useState<"up" | "down" | null>(null);
  const prev = useRef(value);

  useEffect(() => {
    if (infinite) {
      setDisplay(value);
      return;
    }
    const from = prev.current;
    const to = value;
    prev.current = to;
    if (from === to) return;

    setFlash(to > from ? "up" : "down");
    const start = performance.now();
    const dur = 520;
    let raf = 0;

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(from + (to - from) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const clear = setTimeout(() => setFlash(null), 700);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(clear);
    };
  }, [value, infinite]);

  return (
    <strong
      className={[className, flash ? `balance-flash-${flash}` : ""]
        .filter(Boolean)
        .join(" ")}
    >
      {infinite ? "∞" : `$${display.toLocaleString("en-US")}`}
    </strong>
  );
}
