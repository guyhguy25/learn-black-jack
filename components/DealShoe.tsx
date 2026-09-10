"use client";

type Props = {
  dealing?: boolean;
  /** 0–1 how full the shoe still is */
  fill?: number;
};

/** Acrylic dealing shoe — deck height shrinks as cards leave. */
export function DealShoe({ dealing, fill = 1 }: Props) {
  const clamped = Math.max(0.12, Math.min(1, fill));
  return (
    <div
      className={`bj-shoe ${dealing ? "dealing" : ""}`}
      aria-hidden="true"
      style={{ ["--shoe-fill" as string]: String(clamped) }}
    >
      <div className="bj-shoe-acrylic">
        <div className="bj-shoe-interior">
          <div className="bj-shoe-wedge" />
          <div className="bj-shoe-deck">
            <div
              className="bj-shoe-edges"
              style={{ height: `${clamped * 100}%`, top: `${(1 - clamped) * 100}%` }}
            />
            <div
              className="bj-shoe-cut"
              style={{ top: `${(1 - clamped) * 100 + clamped * 42}%` }}
            />
            <div className="bj-shoe-face" />
          </div>
        </div>
        <div className="bj-shoe-front">
          <div className="bj-shoe-slot">
            <div className="bj-shoe-peek" />
          </div>
        </div>
      </div>
    </div>
  );
}
