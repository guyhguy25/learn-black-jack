"use client";

type Props = {
  open: boolean;
  onClose: () => void;
};

export function ChartPanel({ open, onClose }: Props) {
  if (!open) return null;

  return (
    <aside className="float-overlay chart-overlay" aria-label="Strategy chart">
      <div className="float-overlay-header">
        <h2>Strategy Chart</h2>
        <button type="button" className="ghost-btn" onClick={onClose}>
          Close
        </button>
      </div>
      <div className="chart-scroll">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/strategy-chart.png"
          alt="Blackjack basic strategy chart"
          className="strategy-chart-img"
        />
      </div>
      <a
        className="chart-source"
        href="https://www.blackjackapprenticeship.com/blackjack-strategy-charts/"
        target="_blank"
        rel="noopener noreferrer"
      >
        Blackjack Apprenticeship
      </a>
    </aside>
  );
}
