import { useEffect, useState } from "react";

const C = { text: "#e6e8eb", muted: "#9aa3ad", accent: "#4FD1A5", border: "#262b33" };

function EraCard({ r, accent }) {
  return (
    <div style={{ flex: 1, background: "#0f1115", border: `1px solid ${accent ? C.accent : C.border}`, borderRadius: 12, padding: "14px 16px" }}>
      <div style={{ fontSize: 12, color: C.muted }}>{r.transfer_season}</div>
      <div style={{ fontSize: 26, fontWeight: 600, color: accent ? C.accent : C.text }}>€{r.median_fee}m</div>
      <div style={{ fontSize: 12, color: C.muted, marginTop: 6 }}>
        age {r.median_age} · ~{Math.round(r.median_prior_minutes).toLocaleString()} top-flight min
      </div>
    </div>
  );
}

export default function EraCompare() {
  const [rows, setRows] = useState(null);
  useEffect(() => {
    fetch("/api/caliber").then((r) => r.json()).then(setRows).catch(console.error);
  }, []);

  if (!rows || !rows.length) return <p style={{ color: C.muted, fontSize: 13 }}>Loading…</p>;
  const a = rows[0];
  const b = rows[rows.length - 1];
  const mult = (b.median_fee / a.median_fee).toFixed(1);

  return (
    <div>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <EraCard r={a} />
        <div style={{ textAlign: "center", minWidth: 54 }}>
          <div style={{ fontSize: 22, fontWeight: 600, color: C.text }}>×{mult}</div>
          <div style={{ fontSize: 11, color: C.muted }}>the fee</div>
        </div>
        <EraCard r={b} accent />
      </div>
      <p style={{ fontSize: 12, color: C.muted, marginTop: 10, lineHeight: 1.5 }}>
        Median of the 25 biggest signings each season: <strong>{mult}× the price</strong> for a broadly similar
        age & experience profile — the money inflated, the caliber didn't.
      </p>
    </div>
  );
}
