import { useEffect, useRef, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";

// Pages: All Big 5 first (top-25), then each league (top-12, smaller samples).
const PAGES = [
  { code: "", label: "All Big 5", top: 25 },
  { code: "GB1", label: "Premier League", top: 12 },
  { code: "ES1", label: "La Liga", top: 12 },
  { code: "L1", label: "Bundesliga", top: 12 },
  { code: "IT1", label: "Serie A", top: 12 },
  { code: "FR1", label: "Ligue 1", top: 12 },
];

// Dark palette (lighter ramp stops read better on a dark background).
const C = {
  fee: "#F0997B",
  value: "#F0B44B",
  output: "#4FD1A5",
  grid: "rgba(255,255,255,0.08)",
  axis: "#9aa3ad",
  text: "#e6e8eb",
  muted: "#9aa3ad",
  card: "#161a20",
  border: "#262b33",
};

function Panel({ page, data }) {
  return (
    <div style={{ flex: "0 0 100%", scrollSnapAlign: "start", boxSizing: "border-box" }}>
      <h2 style={{ fontSize: 18, fontWeight: 600, margin: "0 0 2px", color: C.text }}>
        {page.label}
      </h2>
      <p style={{ color: C.muted, fontSize: 13, margin: "0 0 8px" }}>
        Top-{page.top} attacking signings each season · indexed to 2013/14 = 100
      </p>
      <ResponsiveContainer width="100%" height={360}>
        <LineChart data={data} margin={{ top: 16, right: 24, bottom: 8, left: 0 }}>
          <CartesianGrid stroke={C.grid} strokeDasharray="3 3" />
          <XAxis dataKey="transfer_season" tick={{ fontSize: 12, fill: C.axis }} stroke={C.axis} />
          <YAxis domain={[60, "auto"]} tick={{ fontSize: 12, fill: C.axis }} stroke={C.axis} />
          <Tooltip
            contentStyle={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8 }}
            labelStyle={{ color: C.text }}
            itemStyle={{ color: C.text }}
          />
          <Legend wrapperStyle={{ color: C.muted, fontSize: 13 }} />
          <ReferenceLine y={100} stroke="#555b63" strokeDasharray="5 5" />
          <Line type="monotone" dataKey="fee_idx" name="Fee" stroke={C.fee} strokeWidth={3} dot={false} />
          <Line type="monotone" dataKey="market_value_idx" name="Market value" stroke={C.value} strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="ga_per_90_idx" name="Goals + assists / 90" stroke={C.output} strokeWidth={3} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function AttackerDeepDive() {
  const [datasets, setDatasets] = useState(null);
  const [status, setStatus] = useState("loading");
  const [active, setActive] = useState(0);
  const scroller = useRef(null);

  useEffect(() => {
    Promise.all(
      PAGES.map((p) => {
        const q = p.code ? `?league=${p.code}&top_n=${p.top}` : `?top_n=${p.top}`;
        return fetch(`/api/attacker-caliber${q}`).then((r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.json();
        });
      })
    )
      .then((all) => {
        setDatasets(all);
        setStatus("ready");
      })
      .catch((e) => {
        console.error(e);
        setStatus("error");
      });
  }, []);

  const goTo = (i) => {
    setActive(i);
    const el = scroller.current;
    if (el) el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
  };
  const onScroll = () => {
    const el = scroller.current;
    if (el) setActive(Math.round(el.scrollLeft / el.clientWidth));
  };

  if (status === "loading") return <p style={{ color: C.muted }}>Loading…</p>;
  if (status === "error")
    return <p style={{ color: "#ff6b6b" }}>Failed to load — is the API running on :8000?</p>;

  return (
    <div style={{ marginTop: 20 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        {PAGES.map((p, i) => (
          <button
            key={p.code || "all"}
            onClick={() => goTo(i)}
            style={{
              padding: "6px 12px",
              fontSize: 13,
              borderRadius: 8,
              cursor: "pointer",
              border: `1px solid ${i === active ? C.output : C.border}`,
              background: i === active ? "rgba(79,209,165,0.12)" : "transparent",
              color: i === active ? C.output : C.muted,
            }}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div
        ref={scroller}
        onScroll={onScroll}
        className="pager"
        style={{
          display: "flex",
          overflowX: "auto",
          scrollSnapType: "x mandatory",
        }}
      >
        {PAGES.map((p, i) => (
          <Panel key={p.code || "all"} page={p} data={datasets[i]} />
        ))}
      </div>

      <p style={{ fontSize: 12, color: C.muted, marginTop: 10 }}>
        Scroll sideways or use the tabs · page {active + 1} of {PAGES.length}
      </p>
    </div>
  );
}
