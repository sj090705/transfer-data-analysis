import { useEffect, useMemo, useState } from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const LEAGUES = [
  { code: "GB1", label: "Premier League", color: "#6FB0EE" },
  { code: "ES1", label: "La Liga", color: "#F0997B" },
  { code: "IT1", label: "Serie A", color: "#5DCAA5" },
  { code: "L1", label: "Bundesliga", color: "#FAC775" },
  { code: "FR1", label: "Ligue 1", color: "#AFA9EC" },
];
const SOURCES = [
  { key: "outside_big5_pct", label: "Outside the Big 5" },
  { key: "domestic_pct", label: "Domestic" },
  { key: "other_big5_pct", label: "Other Big-5" },
];
const C = { grid: "rgba(255,255,255,0.08)", axis: "#9aa3ad", text: "#e6e8eb", muted: "#9aa3ad", card: "#161a20", border: "#262b33" };

// Compact dark tooltip (smaller font + tight padding).
const TT = {
  contentStyle: { background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: "6px 10px", fontSize: 12 },
  labelStyle: { color: C.text, fontSize: 12, marginBottom: 2, fontWeight: 600 },
  itemStyle: { color: C.text, fontSize: 12, padding: "1px 0" },
};

export default function RecruitmentTrends() {
  const [rows, setRows] = useState(null);
  const [status, setStatus] = useState("loading");
  const [source, setSource] = useState("outside_big5_pct");
  const [seasonIdx, setSeasonIdx] = useState(null);
  const [hidden, setHidden] = useState({}); // { [code]: true } = muted
  const toggle = (code) => setHidden((h) => ({ ...h, [code]: !h[code] }));

  useEffect(() => {
    fetch("/api/recruitment-trends")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        setRows(data);
        setStatus("ready");
      })
      .catch((e) => {
        console.error(e);
        setStatus("error");
      });
  }, []);

  // Sorted unique seasons + quick lookup [code][season] -> row
  const { seasons, lookup } = useMemo(() => {
    if (!rows) return { seasons: [], lookup: {} };
    const s = [...new Set(rows.map((r) => r.transfer_season))].sort(
      (a, b) => (a < b ? -1 : 1)
    );
    const l = {};
    rows.forEach((r) => {
      (l[r.league] ||= {})[r.transfer_season] = r;
    });
    return { seasons: s, lookup: l };
  }, [rows]);

  // Line-chart data: one row per season with a key per league = selected source %
  const lineData = useMemo(
    () =>
      seasons.map((s) => {
        const o = { season: s };
        LEAGUES.forEach((lg) => {
          o[lg.code] = lookup[lg.code]?.[s]?.[source] ?? null;
        });
        return o;
      }),
    [seasons, lookup, source]
  );

  // Grouped-bar data for the selected season: 3 source rows, one bar per league
  const drillSeason = seasonIdx == null ? seasons[seasons.length - 1] : seasons[seasonIdx];
  const barData = useMemo(
    () =>
      SOURCES.map((src) => {
        const o = { source: src.label };
        LEAGUES.forEach((lg) => {
          o[lg.code] = lookup[lg.code]?.[drillSeason]?.[src.key] ?? null;
        });
        return o;
      }),
    [lookup, drillSeason]
  );

  if (status === "loading") return <p style={{ color: C.muted }}>Loading…</p>;
  if (status === "error")
    return <p style={{ color: "#ff6b6b" }}>Failed to load — is the API running on :8000?</p>;

  return (
    <div style={{ marginTop: 20 }}>
      <h2 style={{ fontSize: 18, fontWeight: 600, margin: "0 0 2px", color: C.text }}>
        How each league recruits, over time
      </h2>
      <p style={{ color: C.muted, fontSize: 13, margin: "0 0 12px" }}>
        Share of incoming signings by source. Click a point to break that season down below.
      </p>

      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        {SOURCES.map((s) => (
          <button
            key={s.key}
            onClick={() => setSource(s.key)}
            style={{
              padding: "6px 12px",
              fontSize: 13,
              borderRadius: 8,
              cursor: "pointer",
              border: `1px solid ${source === s.key ? "#6FB0EE" : C.border}`,
              background: source === s.key ? "rgba(111,176,238,0.12)" : "transparent",
              color: source === s.key ? "#6FB0EE" : C.muted,
            }}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 8 }}>
        {LEAGUES.map((lg) => {
          const muted = !!hidden[lg.code];
          return (
            <button
              key={lg.code}
              onClick={() => toggle(lg.code)}
              title={muted ? "Click to show" : "Click to hide"}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                background: "transparent",
                border: "none",
                cursor: "pointer",
                padding: 0,
                fontSize: 13,
                color: muted ? "#5b636d" : C.text,
              }}
            >
              <span
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: "50%",
                  border: `2px solid ${lg.color}`,
                  background: muted ? "transparent" : lg.color,
                  boxSizing: "border-box",
                }}
              />
              <span>{lg.label}</span>
            </button>
          );
        })}
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <LineChart
          data={lineData}
          margin={{ top: 12, right: 24, bottom: 8, left: 0 }}
          onClick={(e) => {
            if (e && e.activeTooltipIndex != null) setSeasonIdx(e.activeTooltipIndex);
          }}
        >
          <CartesianGrid stroke={C.grid} strokeDasharray="3 3" />
          <XAxis dataKey="season" tick={{ fontSize: 12, fill: C.axis }} stroke={C.axis} />
          <YAxis unit="%" tick={{ fontSize: 12, fill: C.axis }} stroke={C.axis} />
          <Tooltip
            {...TT}
            cursor={{ stroke: "rgba(255,255,255,0.15)" }}
            formatter={(v, n) => [v == null ? "—" : `${v}%`, LEAGUES.find((l) => l.code === n)?.label ?? n]}
          />
          {LEAGUES.map((lg) => (
            <Line
              key={lg.code}
              type="monotone"
              dataKey={lg.code}
              stroke={lg.color}
              strokeWidth={2}
              dot={false}
              connectNulls
              hide={!!hidden[lg.code]}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>

      <h3 style={{ fontSize: 15, fontWeight: 600, margin: "18px 0 2px", color: C.text }}>
        Season breakdown — {drillSeason}
      </h3>
      <p style={{ color: C.muted, fontSize: 12, margin: "0 0 8px" }}>
        Click any point on the line chart above to change the season.
      </p>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={barData} layout="vertical" margin={{ top: 8, right: 28, bottom: 8, left: 40 }}>
          <CartesianGrid stroke={C.grid} strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" unit="%" domain={[0, 100]} tick={{ fontSize: 12, fill: C.axis }} stroke={C.axis} />
          <YAxis type="category" dataKey="source" tick={{ fontSize: 12, fill: C.axis }} stroke={C.axis} width={110} />
          <Tooltip
            {...TT}
            cursor={{ fill: "rgba(255,255,255,0.04)" }}
            formatter={(v, n) => [v == null ? "—" : `${v}%`, LEAGUES.find((l) => l.code === n)?.label ?? n]}
          />
          {LEAGUES.map((lg) => (
            <Bar key={lg.code} dataKey={lg.code} fill={lg.color} radius={[0, 3, 3, 0]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
