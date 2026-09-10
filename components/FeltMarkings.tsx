"use client";

type Props = {
  bjLabel: string;
  dealerRule: string;
};

function ribbonPath(
  cx: number,
  cy: number,
  rInner: number,
  rOuter: number,
  startDeg: number,
  endDeg: number,
  tipSpread = 8,
) {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const pt = (r: number, deg: number) => {
    const a = toRad(deg);
    return [cx + r * Math.sin(a), cy + r * Math.cos(a)] as const;
  };

  const rMid = (rInner + rOuter) / 2;
  const outerStart = pt(rOuter, startDeg);
  const outerEnd = pt(rOuter, endDeg);
  const innerEnd = pt(rInner, endDeg);
  const innerStart = pt(rInner, startDeg);
  // Swallowtails: points beyond the band ends along the arc
  const tipL = pt(rMid, startDeg - tipSpread);
  const tipR = pt(rMid, endDeg + tipSpread);

  return [
    `M ${outerStart[0].toFixed(1)} ${outerStart[1].toFixed(1)}`,
    `A ${rOuter} ${rOuter} 0 0 0 ${outerEnd[0].toFixed(1)} ${outerEnd[1].toFixed(1)}`,
    `L ${tipR[0].toFixed(1)} ${tipR[1].toFixed(1)}`,
    `L ${innerEnd[0].toFixed(1)} ${innerEnd[1].toFixed(1)}`,
    `A ${rInner} ${rInner} 0 0 1 ${innerStart[0].toFixed(1)} ${innerStart[1].toFixed(1)}`,
    `L ${tipL[0].toFixed(1)} ${tipL[1].toFixed(1)}`,
    "Z",
  ].join(" ");
}

function arcPath(cx: number, cy: number, r: number, a0: number, a1: number) {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const x0 = cx + r * Math.sin(toRad(a0));
  const y0 = cy + r * Math.cos(toRad(a0));
  const x1 = cx + r * Math.sin(toRad(a1));
  const y1 = cy + r * Math.cos(toRad(a1));
  return `M ${x0.toFixed(1)} ${y0.toFixed(1)} A ${r} ${r} 0 0 0 ${x1.toFixed(1)} ${y1.toFixed(1)}`;
}

/**
 * Felt graphics locked to the table artboard (scales with transform).
 * Insurance ribbon sits near the seat arc; logo/pays/rules above it.
 */
export function FeltMarkings({ bjLabel, dealerRule }: Props) {
  // Match .seat-orbit (felt top ≈ 130px) in a 1000×640 felt viewBox
  const cx = 500;
  const cy = 120;
  const rOuter = 318;
  const rInner = 278;
  const startDeg = -54;
  const endDeg = 54;
  const band = ribbonPath(cx, cy, rInner, rOuter, startDeg, endDeg, 10);

  const insMid = (rInner + rOuter) / 2;
  const ruleR = rInner - 36;
  const paysR = rInner - 78;
  const logoY = cy + paysR - 78;

  return (
    <div className="felt-markings" aria-hidden="true">
      <svg
        className="mark-arc"
        viewBox="0 0 1000 640"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <path id="paysArc" d={arcPath(cx, cy, paysR, -42, 42)} fill="none" />
          <path id="ruleArc" d={arcPath(cx, cy, ruleR, -48, 48)} fill="none" />
          <path
            id="insLeftPays"
            d={arcPath(cx, cy, insMid - 8, -50, -28)}
            fill="none"
          />
          <path
            id="insLeftOdds"
            d={arcPath(cx, cy, insMid + 8, -50, -28)}
            fill="none"
          />
          <path
            id="insWord"
            d={arcPath(cx, cy, insMid, -24, 24)}
            fill="none"
          />
          <path
            id="insRightPays"
            d={arcPath(cx, cy, insMid - 8, 28, 50)}
            fill="none"
          />
          <path
            id="insRightOdds"
            d={arcPath(cx, cy, insMid + 8, 28, 50)}
            fill="none"
          />
        </defs>

        {/* GBJ logo */}
        <g transform={`translate(${cx} ${logoY})`}>
          {Array.from({ length: 11 }).map((_, i) => {
            const a = ((i - 5) * Math.PI) / 14;
            return (
              <line
                key={i}
                x1={Math.sin(a) * 10}
                y1={-Math.cos(a) * 6}
                x2={Math.sin(a) * 34}
                y2={-Math.cos(a) * 20}
                stroke="#e8c76b"
                strokeWidth="1.4"
                opacity="0.9"
              />
            );
          })}
          <text className="felt-logo" textAnchor="middle" y="8">
            GBJ
          </text>
          <text className="felt-logo-sub" textAnchor="middle" y="28">
            Guy Black Jack
          </text>
        </g>

        <path className="ins-ribbon" d={band} />
        <path className="ins-ribbon-stroke" d={band} />

        <text className="arc-pays">
          <textPath href="#paysArc" startOffset="50%" textAnchor="middle">
            PAYS {bjLabel}
          </textPath>
        </text>

        <text className="arc-rule">
          <textPath href="#ruleArc" startOffset="50%" textAnchor="middle">
            {dealerRule}
          </textPath>
        </text>

        {/* Insurance: Pays / 2 TO 1 · INSURANCE · Pays / 2 TO 1 */}
        <text className="arc-ins-pays">
          <textPath href="#insLeftPays" startOffset="50%" textAnchor="middle">
            PAYS
          </textPath>
        </text>
        <text className="arc-ins-odds">
          <textPath href="#insLeftOdds" startOffset="50%" textAnchor="middle">
            2 TO 1
          </textPath>
        </text>
        <text className="arc-ins-word" textAnchor="middle">
          <textPath href="#insWord" startOffset="50%">
            INSURANCE
          </textPath>
        </text>
        <text className="arc-ins-pays">
          <textPath href="#insRightPays" startOffset="50%" textAnchor="middle">
            PAYS
          </textPath>
        </text>
        <text className="arc-ins-odds">
          <textPath href="#insRightOdds" startOffset="50%" textAnchor="middle">
            2 TO 1
          </textPath>
        </text>
      </svg>
    </div>
  );
}
