"use client";

type Props = {
  dealing?: boolean;
  name?: string;
};

export function DealerFigure({ dealing, name = "Dealer" }: Props) {
  return (
    <div className={`dealer-figure ${dealing ? "is-dealing" : ""}`} aria-hidden="true">
      <div className="dealer-bust">
        <div className="dealer-head">
          <div className="dealer-hair" />
          <div className="dealer-face">
            <span className="eye left" />
            <span className="eye right" />
            <span className="smile" />
          </div>
        </div>
        <div className="dealer-torso">
          <div className="dealer-shirt" />
          <div className="dealer-vest" />
          <div className="dealer-bow" />
        </div>
        <div className="dealer-arm left-arm">
          <div className="sleeve" />
          <div className="forearm" />
          <div className="hand resting" />
        </div>
        <div className="dealer-arm deal-arm">
          <div className="sleeve" />
          <div className="forearm">
            <div className="shoe-card" />
          </div>
          <div className="hand dealing-hand">
            <span className="finger" />
            <span className="finger" />
            <span className="finger" />
            <span className="thumb" />
          </div>
        </div>
      </div>
      <div className="dealer-nameplate">{name}</div>
    </div>
  );
}
