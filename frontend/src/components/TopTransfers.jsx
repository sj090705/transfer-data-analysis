import { useEffect, useMemo, useRef, useState } from "react";

const PAGES = [
  { code: "", label: "All Big 5" },
  { code: "GB1", label: "Premier League" },
  { code: "ES1", label: "La Liga" },
  { code: "L1", label: "Bundesliga" },
  { code: "IT1", label: "Serie A" },
  { code: "FR1", label: "Ligue 1" },
];
const TOP_N_OPTIONS = [5, 7, 10, 15, 20];
const C = { text: "#e6e8eb", muted: "#9aa3ad", card: "#161a20", border: "#262b33", accent: "#4FD1A5" };

const MODES = {
  expensive: {
    label: "Most expensive",
    endpoint: "/api/top-transfers",
    sortKey: "fee_in_millions",
    valueLabel: "Fee",
    caption: (n) => `Most expensive paid buys · top ${n}`,
    showRatio: true,
  },
  free: {
    label: "Best free signings",
    endpoint: "/api/best-free-transfers",
    sortKey: "market_value_in_millions",
    valueLabel: "Market value",
    caption: (n) => `Most valuable free signings · top ${n} · loans best-effort filtered`,
    showRatio: false,
  },
};

function pickRows(data, season, sortKey, topN) {
  if (!data) return [];
  const rows = season === "all" ? data : data.filter((r) => r.transfer_season === season);
  return [...rows].sort((a, b) => b[sortKey] - a[sortKey]).slice(0, topN);
}

function TablePanel({ label, rows, mode }) {
  const cfg = MODES[mode];
  const valueOf = (r) => (mode === "expensive" ? r.fee_in_millions : r.market_value_in_millions);
  return (
    <div style={{ flex: "0 0 100%", scrollSnapAlign: "start", boxSizing: "border-box" }}>
      <h3 style={{ fontSize: 15, fontWeight: 600, margin: "0 0 8px", color: C.text }}>{label}</h3>
      {rows.length === 0 ? (
        <p style={{ color: C.muted, fontSize: 13 }}>No transfers for this selection.</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ color: C.muted, textAlign: "left" }}>
              <th style={{ padding: "6px 8px", fontWeight: 500 }}>#</th>
              <th style={{ padding: "6px 8px", fontWeight: 500 }}>Player</th>
              <th style={{ padding: "6px 8px", fontWeight: 500 }}>From → To</th>
              <th style={{ padding: "6px 8px", fontWeight: 500, textAlign: "right" }}>{cfg.valueLabel}</th>
              {cfg.showRatio && <th style={{ padding: "6px 8px", fontWeight: 500, textAlign: "right" }}>×Val</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={`${r.player_name}-${r.transfer_season}-${i}`} style={{ borderTop: `1px solid ${C.border}` }}>
                <td style={{ padding: "7px 8px", color: C.muted }}>{i + 1}</td>
                <td style={{ padding: "7px 8px", color: C.text }}>
                  {r.player_name}
                  <span style={{ color: C.muted }}> · {r.transfer_season}</span>
                </td>
                <td style={{ padding: "7px 8px", color: C.muted }}>
                  {r.selling_club_name} → <span style={{ color: C.text }}>{r.buying_club_name}</span>
                </td>
                <td style={{ padding: "7px 8px", textAlign: "right", color: C.text }}>€{valueOf(r)}m</td>
                {cfg.showRatio && (
                  <td
                    style={{
                      padding: "7px 8px",
                      textAlign: "right",
                      color: r.fee_to_value_ratio > 1.5 ? "#F0997B" : C.muted,
                    }}
                  >
                    {r.fee_to_value_ratio == null ? "—" : `${r.fee_to_value_ratio}×`}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default function TopTransfers() {
  const [mode, setMode] = useState("expensive");
  const [topN, setTopN] = useState(7);
  const [datasets, setDatasets] = useState(null);
  const [status, setStatus] = useState("loading");
  const [season, setSeason] = useState("all");
  const [active, setActive] = useState(0);
  const scroller = useRef(null);

  // Free mode is fixed at top 5; the "Show" selector only drives expensive mode.
  const effN = mode === "free" ? 5 : topN;

  // Refetch when mode OR effective N changes (drives the API query and the slice).
  useEffect(() => {
    setStatus("loading");
    Promise.all(
      PAGES.map((p) => {
        const q = p.code ? `?league=${p.code}&top_n=${effN}` : `?top_n=${effN}`;
        return fetch(`${MODES[mode].endpoint}${q}`).then((r) => {
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
  }, [mode, effN]);

  const seasons = useMemo(() => {
    if (!datasets) return [];
    return [...new Set(datasets[0].map((r) => r.transfer_season))].sort((a, b) => (a < b ? 1 : -1));
  }, [datasets]);

  const goTo = (i) => {
    setActive(i);
    const el = scroller.current;
    if (el) el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
  };
  const onScroll = () => {
    const el = scroller.current;
    if (el) setActive(Math.round(el.scrollLeft / el.clientWidth));
  };

  const selectStyle = {
    fontSize: 13,
    padding: "4px 8px",
    background: C.card,
    color: C.text,
    border: `1px solid ${C.border}`,
    borderRadius: 6,
  };

  return (
    <div style={{ marginTop: 20 }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        {Object.entries(MODES).map(([id, cfg]) => (
          <button
            key={id}
            onClick={() => setMode(id)}
            style={{
              padding: "7px 14px",
              fontSize: 13,
              borderRadius: 8,
              cursor: "pointer",
              border: `1px solid ${mode === id ? C.accent : C.border}`,
              background: mode === id ? "rgba(79,209,165,0.14)" : "transparent",
              color: mode === id ? C.accent : C.muted,
              fontWeight: mode === id ? 600 : 400,
            }}
          >
            {cfg.label}
          </button>
        ))}
      </div>

      {status === "loading" && <p style={{ color: C.muted }}>Loading…</p>}
      {status === "error" && <p style={{ color: "#ff6b6b" }}>Failed to load — is the API running on :8000?</p>}

      {status === "ready" && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
            <p style={{ color: C.muted, fontSize: 13, margin: 0 }}>{MODES[mode].caption(effN)}</p>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              {mode === "expensive" && (
                <label style={{ fontSize: 13, color: C.muted }}>
                  Show:{" "}
                  <select value={topN} onChange={(e) => setTopN(Number(e.target.value))} style={selectStyle}>
                    {TOP_N_OPTIONS.map((n) => (
                      <option key={n} value={n}>Top {n}</option>
                    ))}
                  </select>
                </label>
              )}
              <label style={{ fontSize: 13, color: C.muted }}>
                Season:{" "}
                <select value={season} onChange={(e) => setSeason(e.target.value)} style={selectStyle}>
                  <option value="all">All time</option>
                  {seasons.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "12px 0" }}>
            {PAGES.map((p, i) => (
              <button
                key={p.code || "all"}
                onClick={() => goTo(i)}
                style={{
                  padding: "6px 12px",
                  fontSize: 13,
                  borderRadius: 8,
                  cursor: "pointer",
                  border: `1px solid ${i === active ? C.accent : C.border}`,
                  background: i === active ? "rgba(79,209,165,0.12)" : "transparent",
                  color: i === active ? C.accent : C.muted,
                }}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div ref={scroller} onScroll={onScroll} className="pager" style={{ display: "flex", overflowX: "auto", scrollSnapType: "x mandatory" }}>
            {PAGES.map((p, i) => (
              <TablePanel key={p.code || "all"} label={p.label} rows={pickRows(datasets[i], season, MODES[mode].sortKey, effN)} mode={mode} />
            ))}
          </div>

          <p style={{ fontSize: 12, color: C.muted, marginTop: 10 }}>
            Scroll sideways or use the tabs · page {active + 1} of {PAGES.length}
            {mode === "free" && " · recent-season loans may still leak (no loan flag in data)"}
          </p>
        </>
      )}
    </div>
  );
}
