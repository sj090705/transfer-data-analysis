import { useEffect, useRef, useState } from "react";
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";

const PAGES = [
  { id: "net", label: "Net transfer value", key: "net_spend" },
  { id: "spent", label: "Money spent", key: "money_spent" },
  { id: "earned", label: "Money earned (sales)", key: "money_earned" },
];
const LEAGUE_OPTS = [
  { code: "", label: "All leagues" },
  { code: "GB1", label: "Premier League" },
  { code: "ES1", label: "La Liga" },
  { code: "L1", label: "Bundesliga" },
  { code: "IT1", label: "Serie A" },
  { code: "FR1", label: "Ligue 1" },
];
const FEW = 8; // clubs shown before "Show all"
const C = {
  spend: "#F0997B", // coral = money out
  earn: "#4FD1A5", // teal  = money in
  text: "#e6e8eb",
  muted: "#9aa3ad",
  card: "#161a20",
  border: "#262b33",
  accent: "#4FD1A5",
};

function ChartPanel({ page, data, selected, onSeason }) {
  // net: colour by sign (spent > earned = coral, net earner = teal)
  const colorFor = (row) => {
    if (page.id === "spent") return C.spend;
    if (page.id === "earned") return C.earn;
    return row.net_spend >= 0 ? C.spend : C.earn;
  };
  return (
    <div style={{ flex: "0 0 100%", scrollSnapAlign: "start", boxSizing: "border-box" }}>
      <h3 style={{ fontSize: 15, fontWeight: 600, margin: "0 0 8px", color: C.text }}>{page.label}</h3>
      <ResponsiveContainer width="100%" height={320}>
        <BarChart
          data={data}
          margin={{ top: 8, right: 16, bottom: 8, left: 0 }}
          onClick={(s) => s && s.activeLabel && onSeason(s.activeLabel)}
          style={{ cursor: "pointer" }}
        >
          <CartesianGrid stroke="rgba(255,255,255,0.08)" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="transfer_season" tick={{ fontSize: 12, fill: C.muted }} stroke={C.muted} />
          <YAxis tick={{ fontSize: 12, fill: C.muted }} stroke={C.muted} tickFormatter={(v) => `€${v}m`} />
          <ReferenceLine y={0} stroke="#555b63" />
          <Tooltip
            contentStyle={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: "6px 10px", fontSize: 12 }}
            labelStyle={{ color: C.text, fontSize: 12, fontWeight: 600 }}
            itemStyle={{ color: C.text, fontSize: 12 }}
            cursor={{ fill: "rgba(255,255,255,0.04)" }}
            formatter={(v) => [`€${v}m`, page.label]}
          />
          <Bar dataKey={page.key} radius={[3, 3, 0, 0]}>
            {data.map((row, i) => (
              <Cell
                key={i}
                fill={colorFor(row)}
                fillOpacity={selected && row.transfer_season !== selected ? 0.35 : 1}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function ClubActivity() {
  const [clubs, setClubs] = useState([]);
  const [clubId, setClubId] = useState(null);
  const [data, setData] = useState([]);
  const [status, setStatus] = useState("loading");
  const [active, setActive] = useState(0);
  const [season, setSeason] = useState("");
  const [transfers, setTransfers] = useState([]);
  const [leagueFilter, setLeagueFilter] = useState("");
  const [showAllTx, setShowAllTx] = useState(false);
  const scroller = useRef(null);

  useEffect(() => {
    fetch("/api/clubs")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((list) => {
        setClubs(list);
        if (list.length) setClubId(list[0].club_id);
      })
      .catch((e) => {
        console.error(e);
        setStatus("error");
      });
  }, []);

  useEffect(() => {
    if (clubId == null) return;
    setStatus("loading");
    setSeason(""); // clear the season drill-down when switching clubs
    setTransfers([]);
    fetch(`/api/club-activity?club_id=${clubId}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((rows) => {
        setData(rows);
        setStatus("ready");
      })
      .catch((e) => {
        console.error(e);
        setStatus("error");
      });
  }, [clubId]);

  // Drill-down: fetch the individual transfers once a season is chosen.
  useEffect(() => {
    setShowAllTx(false); // collapse the list on each new drill-down
    if (clubId == null || !season) {
      setTransfers([]);
      return;
    }
    fetch(`/api/club-transfers?club_id=${clubId}&season=${encodeURIComponent(season)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then(setTransfers)
      .catch((e) => console.error(e));
  }, [clubId, season]);

  const feeLabel = (r) =>
    r.is_undisclosed_fee ? "—" : r.is_free_transfer ? "Free" : `€${r.fee_in_millions}m`;

  // League -> club filtering (club dropdown lists ALL clubs in the league).
  const clubsInLeague = leagueFilter ? clubs.filter((c) => c.league === leagueFilter) : clubs;

  const changeLeague = (code) => {
    setLeagueFilter(code);
    const list = code ? clubs.filter((c) => c.league === code) : clubs;
    if (list.length) setClubId(list[0].club_id);
  };

  // Transfers list: show a few, expand for the rest.
  const shownTx = showAllTx ? transfers : transfers.slice(0, FEW);

  const selectStyle = { fontSize: 13, padding: "4px 8px", background: C.card, color: C.text, border: `1px solid ${C.border}`, borderRadius: 6 };

  const goTo = (i) => {
    setActive(i);
    const el = scroller.current;
    if (el) el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
  };
  const onScroll = () => {
    const el = scroller.current;
    if (el) setActive(Math.round(el.scrollLeft / el.clientWidth));
  };

  if (status === "error")
    return <p style={{ color: "#ff6b6b" }}>Failed to load — is the API running on :8000?</p>;

  return (
    <div style={{ marginTop: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <label style={{ fontSize: 13, color: C.muted }}>
            League:{" "}
            <select value={leagueFilter} onChange={(e) => changeLeague(e.target.value)} style={selectStyle}>
              {LEAGUE_OPTS.map((l) => (
                <option key={l.code} value={l.code}>{l.label}</option>
              ))}
            </select>
          </label>
          <label style={{ fontSize: 13, color: C.muted }}>
            Club:{" "}
            <select
              value={clubId ?? ""}
              onChange={(e) => setClubId(Number(e.target.value))}
              style={{ ...selectStyle, maxWidth: 240 }}
            >
              {clubsInLeague.map((c) => (
                <option key={c.club_id} value={c.club_id}>
                  {c.club_name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p style={{ color: C.muted, fontSize: 13, margin: 0 }}>Transfer spend / income by season (fee-known deals)</p>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "12px 0" }}>
        {PAGES.map((p, i) => (
          <button
            key={p.id}
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

      {status === "loading" ? (
        <p style={{ color: C.muted }}>Loading…</p>
      ) : (
        <div ref={scroller} onScroll={onScroll} className="pager" style={{ display: "flex", overflowX: "auto", scrollSnapType: "x mandatory" }}>
          {PAGES.map((p) => (
            <ChartPanel key={p.id} page={p} data={data} selected={season} onSeason={setSeason} />
          ))}
        </div>
      )}

      <p style={{ fontSize: 12, color: C.muted, marginTop: 10 }}>
        Scroll/tab between metrics · click a bar to see that season's deals · net &gt; 0 spender (coral), &lt; 0 earner (teal)
      </p>

      {season && (
        <div style={{ marginTop: 18, borderTop: `1px solid ${C.border}`, paddingTop: 14 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, margin: "0 0 8px", color: C.text }}>
            Deals in {season}
          </h3>
          {transfers.length === 0 ? (
            <p style={{ color: C.muted, fontSize: 13 }}>No transfers recorded for this season.</p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ color: C.muted, textAlign: "left" }}>
                  <th style={{ padding: "6px 8px", fontWeight: 500 }}></th>
                  <th style={{ padding: "6px 8px", fontWeight: 500 }}>Player</th>
                  <th style={{ padding: "6px 8px", fontWeight: 500 }}>Club</th>
                  <th style={{ padding: "6px 8px", fontWeight: 500, textAlign: "right" }}>Fee</th>
                </tr>
              </thead>
              <tbody>
                {shownTx.map((t, i) => {
                  const isIn = t.direction === "in";
                  return (
                    <tr key={`${t.player_name}-${i}`} style={{ borderTop: `1px solid ${C.border}` }}>
                      <td style={{ padding: "7px 8px", color: isIn ? C.earn : C.spend, fontWeight: 500, whiteSpace: "nowrap" }}>
                        {isIn ? "↓ In" : "↑ Out"}
                      </td>
                      <td style={{ padding: "7px 8px", color: C.text }}>
                        {t.player_name}
                        <span style={{ color: C.muted }}> · {t.position}</span>
                      </td>
                      <td style={{ padding: "7px 8px", color: C.muted }}>
                        {isIn ? "from " : "to "}{t.counterpart}
                      </td>
                      <td style={{ padding: "7px 8px", textAlign: "right", color: C.text }}>{feeLabel(t)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          {transfers.length > FEW && (
            <button
              onClick={() => setShowAllTx((v) => !v)}
              style={{ marginTop: 10, fontSize: 12, padding: "5px 12px", borderRadius: 6, cursor: "pointer", border: `1px solid ${C.border}`, background: "transparent", color: C.accent }}
            >
              {showAllTx ? `Show fewer` : `Show all ${transfers.length} deals`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
