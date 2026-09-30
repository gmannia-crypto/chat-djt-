import "./LiquidFlow.css";

/** Decorative, non-interactive motion shared by the proposed Arena screens. */
export function LiquidFlow() {
  return (
    <div className="arena-liquid-flow" aria-hidden="true">
      <span className="arena-liquid-flow__ribbon arena-liquid-flow__ribbon--gold" />
      <span className="arena-liquid-flow__ribbon arena-liquid-flow__ribbon--red" />
      <span className="arena-liquid-flow__ribbon arena-liquid-flow__ribbon--blue" />
    </div>
  );
}