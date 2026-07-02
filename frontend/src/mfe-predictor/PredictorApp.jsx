// Micro-frontend: Market-Value Predictor. Independent feature app; shell mounts
// it lazily. Team picker supplies the buying-club squad value (a top-2 driver).
import { useEffect, useState } from "react";
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip } from "recharts";

const C = { text: "#e6e8eb", muted: "#9aa3ad", card: "#161a20", border: "#262b33", accent: "#4FD1A5", coral: "#F0997B" };
const LEAGUES = [["GB1", "Premier League"], ["ES1", "La Liga"], ["IT1", "Serie A"], ["L1", "Bundesliga"], ["FR1", "Ligue 1"]];
const POSITIONS = ["Attack", "Midfield", "Defender", "Goalkeeper"];
const selectStyle = { fontSize: 14, padding: "6px 10px", background: "#0f1115", color: C.text, border: `1px solid ${C.border}`, borderRadius: 8, width: "100%", height: 36, boxSizing: "border-box" };
const card = { background: C.card, border: "1px solid #232a33", borderRadius: 16, padding: "20px 22px", boxShadow: "0 1px 3px rgba(0,0,0,0.35)" };
const strip = (v) => v.replace(/^0+(?=\d)/, ""); // drop leading zeros ("018" -> "18")

function Field({ label, children }) {
  // Fill the grid cell and let the label grow (flex:1) so the input is pinned to
  // the bottom — inputs bottom-align across a row regardless of 1- or 2-line labels.
  return (
    <label style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <span style={{ fontSize: 13, color: C.muted, marginBottom: 5, lineHeight: 1.3, flex: 1 }}>{label}</span>
      {children}
    </label>
  );
}

export default function PredictorApp() {
  const [clubs, setClubs] = useState([]);
  const [leagueSel, setLeagueSel] = useState("GB1");
  const [team, setTeam] = useState(null); // {club_name, squad_value_in_millions, league_id}
  const [age, setAge] = useState("23");
  const [position, setPosition] = useState("Attack");
  const [cross, setCross] = useState(false); // moving from a different league?
  const [goals, setGoals] = useState("");
  const [minutes, setMinutes] = useState("");
  const [value, setValue] = useState(null);
  const [insights, setInsights] = useState(null);

  useEffect(() => {
    fetch("/api/top-clubs")
      .then((r) => r.json())
      .then((cs) => { setClubs(cs); setTeam(cs.find((c) => c.league_id === "GB1") || cs[0]); })
      .catch(console.error);
    fetch("/api/value-insights").then((r) => r.json()).then(setInsights).catch(console.error);
  }, []);

  const clubsInLeague = clubs.filter((c) => c.league_id === leagueSel);
  const changeLeague = (lg) => {
    setLeagueSel(lg);
    const first = clubs.find((c) => c.league_id === lg);
    if (first) setTeam(first);
  };

  const predict = () => {
    if (!team) return;
    // buying league = the picked team's league; cross-league from the toggle
    let q = `squad_value=${team.squad_value_in_millions}&age=${age}&position=${position}&league=${team.league_id}&cross_league=${cross}`;
    if (goals !== "") q += `&goals=${goals}`;
    if (minutes !== "") q += `&minutes=${minutes}`;
    fetch(`/api/predict-value?${q}`).then((r) => r.json()).then((d) => setValue(d.predicted_value)).catch(console.error);
  };

  // Warn on inputs the model never saw: no midfielder scored >=20 in training,
  // only 1 U19 played >=2500 min, and trees saturate at the training ceiling (~€40m).
  const g = goals === "" ? null : Number(goals);
  const m = minutes === "" ? null : Number(minutes);
  const outOfRange =
    (g != null && g > 20) ||
    (m != null && m > 3200) ||
    (Number(age) < 19 && m != null && m > 2000);

  const impMax = insights ? Math.max(...insights.importance.map((f) => f.importance)) : 1;
  const pretty = (f) => f.replace(/_/g, " ").replace("in millions", "").replace("big5", "prior").replace("buying squad value", "team squad value").trim();

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 4 }}>Market Value Predictor</h1>
      <p style={{ color: C.muted, marginTop: 0 }}>Estimate a player's market value from their profile and destination club.</p>

      {/* team clicker: league -> teams */}
      <div style={{ ...card, marginTop: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
          <div style={{ fontSize: 13, color: C.muted }}>
            Destination club <span style={{ color: "#6b7480" }}>· squad value is a top driver — pick the buyer</span>
          </div>
          <label style={{ fontSize: 13, color: C.muted }}>
            League:{" "}
            <select value={leagueSel} onChange={(e) => changeLeague(e.target.value)} style={{ ...selectStyle, width: "auto" }}>
              {LEAGUES.map(([c, l]) => <option key={c} value={c}>{l}</option>)}
            </select>
          </label>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 8 }}>
          {clubsInLeague.map((cl) => {
            const on = team && cl.club_name === team.club_name;
            return (
              <button
                key={cl.club_name}
                onClick={() => setTeam(cl)}
                style={{
                  textAlign: "left", padding: "9px 11px", borderRadius: 9, cursor: "pointer",
                  border: `1px solid ${on ? C.accent : C.border}`,
                  background: on ? "rgba(79,209,165,0.14)" : "transparent",
                  color: on ? C.text : C.muted,
                }}
              >
                <div style={{ fontSize: 13, fontWeight: on ? 600 : 400, color: on ? C.accent : C.text }}>{cl.club_name}</div>
                <div style={{ fontSize: 11, color: C.muted }}>€{Math.round(cl.squad_value_in_millions)}m squad</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* player inputs + result */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 18, marginTop: 18, alignItems: "stretch" }}>
        <div style={card}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 14 }}>
          <Field label="Age"><input type="number" min="15" max="40" value={age} onChange={(e) => setAge(strip(e.target.value))} style={selectStyle} /></Field>
          <Field label="Position">
            <select value={position} onChange={(e) => setPosition(e.target.value)} style={selectStyle}>
              {POSITIONS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </Field>
          <Field label="Arriving from">
            <select value={cross ? "diff" : "same"} onChange={(e) => setCross(e.target.value === "diff")} style={selectStyle}>
              <option value="same">Same league</option>
              <option value="diff">A different league</option>
            </select>
          </Field>
          <Field label="Goals (opt.)"><input type="number" min="0" value={goals} onChange={(e) => setGoals(strip(e.target.value))} style={selectStyle} placeholder="—" /></Field>
          <Field label="Minutes (opt.)"><input type="number" min="0" value={minutes} onChange={(e) => setMinutes(strip(e.target.value))} style={selectStyle} placeholder="—" /></Field>
          </div>
          <button onClick={predict} style={{ width: "100%", padding: "11px", marginTop: 16, fontSize: 14, fontWeight: 600, borderRadius: 8, cursor: "pointer", border: "none", background: C.accent, color: "#0f1115" }}>
            Predict value
          </button>
        </div>

        <div style={{ ...card, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", minHeight: 180 }}>
          <div style={{ fontSize: 13, color: C.muted, marginBottom: 6 }}>Predicted market value</div>
          <div style={{ fontSize: 44, fontWeight: 600, color: value == null ? C.muted : outOfRange ? C.coral : C.accent }}>
            {value == null ? "—" : `€${value}m`}
          </div>
          {value != null && outOfRange ? (
            <div style={{ fontSize: 12, color: C.coral, marginTop: 8, textAlign: "center", maxWidth: 260, lineHeight: 1.5 }}>
              ⚠ Inputs unlike anything in the training data (e.g. a midfielder with 20+ goals, or a
              teen with 2,500+ min). The model saturates near €40m and can't value generational
              outliers — treat as unreliable.
            </div>
          ) : (
            <div style={{ fontSize: 12, color: C.muted, marginTop: 8, textAlign: "center", maxWidth: 240 }}>
              {value == null ? "Pick a club, set the profile, hit Predict." : `at ${team && team.club_name}`}
            </div>
          )}
        </div>
      </div>

      {/* honest insights */}
      {insights && (
        <div style={{ ...card, marginTop: 18 }}>
          <div style={{ fontSize: 12, letterSpacing: 0.4, textTransform: "uppercase", color: "#6b7480", marginBottom: 10 }}>How good is it, honestly?</div>
          <p style={{ fontSize: 14, color: C.text, margin: "0 0 6px", lineHeight: 1.6 }}>
            On unseen recent seasons it's off by <strong>€{insights.metrics.mae}m</strong> (R² {insights.metrics.r2}), well ahead of the
            "just guess the median" baseline (€{insights.metrics.baseline_mae}m). A real model — value is genuinely predictable from
            <strong> team stature and playing time</strong>, unlike the fee.
          </p>
          <p style={{ fontSize: 13, color: C.muted, margin: "0 0 16px", lineHeight: 1.6 }}>
            Caveat: predicts Transfermarkt's <em>estimated</em> value (not hard ground truth), and the selling club's squad value is
            excluded (it contains the player himself → leakage). ~half the variance is left to reputation/potential/contract.
          </p>
          {insights.agreement && (
            <div style={{ marginBottom: 18 }}>
              <p style={{ fontSize: 13, color: C.text, margin: "0 0 8px", lineHeight: 1.6 }}>
                Predicted vs Transfermarkt's actual value (unseen seasons): correlation
                <strong> r={insights.agreement.corr}</strong>, and <strong>{insights.agreement.within10_pct}%</strong> of
                predictions land within €10m. Dots cluster along the trend at the low end but
                drift <em>above</em> the diagonal higher up — the model under-predicts the priciest
                players (its ceiling: predictions rarely pass €45m while real values reach €65m+).
              </p>
              <ResponsiveContainer width="100%" height={240}>
                <ScatterChart margin={{ top: 8, right: 12, bottom: 8, left: 0 }}>
                  <CartesianGrid stroke="rgba(255,255,255,0.06)" />
                  <XAxis type="number" dataKey="p" name="Predicted" unit="m" tick={{ fontSize: 11, fill: C.muted }} stroke={C.muted} />
                  <YAxis type="number" dataKey="a" name="Actual" unit="m" tick={{ fontSize: 11, fill: C.muted }} stroke={C.muted} />
                  <ReferenceLine segment={[{ x: 0, y: 0 }, { x: 120, y: 120 }]} stroke="#5b636d" strokeDasharray="5 5" />
                  <Tooltip
                    contentStyle={{ background: "#0f1115", border: `1px solid ${C.border}`, borderRadius: 8, padding: "6px 10px", fontSize: 12 }}
                    itemStyle={{ color: C.text }} cursor={{ stroke: "rgba(255,255,255,0.15)" }}
                    formatter={(v) => `€${v}m`}
                  />
                  <Scatter data={insights.agreement.scatter} fill={C.accent} fillOpacity={0.5} />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          )}
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 8 }}>Feature importance (permutation)</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {insights.importance.map((f) => (
              <div key={f.feature} style={{ display: "grid", gridTemplateColumns: "150px 1fr 44px", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 12, color: C.text }}>{pretty(f.feature)}</span>
                <div style={{ height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 3 }}>
                  <div style={{ width: `${Math.max((f.importance / impMax) * 100, 0)}%`, height: "100%", background: C.coral, borderRadius: 3 }} />
                </div>
                <span style={{ fontSize: 12, color: C.muted, textAlign: "right" }}>{f.importance}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
