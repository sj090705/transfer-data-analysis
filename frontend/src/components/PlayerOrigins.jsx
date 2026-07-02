import { useEffect, useState } from "react";
import { PieChart, Pie, Cell, Sector, Tooltip, Legend, ResponsiveContainer } from "recharts";

// grow the hovered slice outward
const renderActive = (p) => (
  <Sector
    cx={p.cx}
    cy={p.cy}
    innerRadius={p.innerRadius}
    outerRadius={p.outerRadius + 12}
    startAngle={p.startAngle}
    endAngle={p.endAngle}
    fill={p.fill}
    stroke="#0f1115"
  />
);

const LEAGUES = [
  { code: "GB1", label: "Premier League" },
  { code: "ES1", label: "La Liga" },
  { code: "IT1", label: "Serie A" },
  { code: "L1", label: "Bundesliga" },
  { code: "FR1", label: "Ligue 1" },
];
const PALETTE = ["#378ADD", "#D85A30", "#1D9E75", "#EF9F27", "#7F77DD", "#D4537E", "#97C459", "#5DCAA5", "#F0997B", "#AFA9EC"];
const OTHER = "#5F5E5A";
const C = { text: "#e6e8eb", muted: "#9aa3ad", card: "#161a20", border: "#262b33", accent: "#4FD1A5" };

const selectStyle = { fontSize: 13, padding: "4px 8px", background: "#161a20", color: C.text, border: `1px solid ${C.border}`, borderRadius: 6, maxWidth: 220 };

export default function PlayerOrigins() {
  const [mode, setMode] = useState("league"); // "league" | "country"
  const [league, setLeague] = useState("GB1");
  const [countries, setCountries] = useState([]);
  const [continent, setContinent] = useState("");
  const [country, setCountry] = useState("Brazil");
  const [data, setData] = useState([]);
  const [status, setStatus] = useState("loading");
  const [activeIndex, setActiveIndex] = useState(-1);

  useEffect(() => {
    fetch("/api/countries")
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((list) => setCountries(list))
      .catch((e) => console.error(e));
  }, []);

  useEffect(() => {
    setStatus("loading");
    const url =
      mode === "league"
        ? `/api/league-nationalities?league=${league}`
        : `/api/country-leagues?country=${encodeURIComponent(country)}`;
    fetch(url)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d) => {
        setData(d);
        setStatus("ready");
      })
      .catch((e) => {
        console.error(e);
        setStatus("error");
      });
  }, [mode, league, country]);

  const total = data.reduce((s, d) => s + d.value, 0) || 1;

  // continent -> country two-step
  const CONTINENTS = ["", ...Array.from(new Set(countries.map((c) => c.continent)))];
  const countriesInCont = continent ? countries.filter((c) => c.continent === continent) : countries;
  const changeContinent = (cont) => {
    setContinent(cont);
    const list = cont ? countries.filter((c) => c.continent === cont) : countries;
    if (list.length) setCountry(list[0].country);
  };

  return (
    <div style={{ marginTop: 14 }}>
      {/* mode tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        {[["league", "By league → nationalities"], ["country", "By country → leagues"]].map(([id, label]) => (
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
            {label}
          </button>
        ))}
      </div>

      <div style={{ marginBottom: 8 }}>
        {mode === "league" ? (
          <label style={{ fontSize: 13, color: C.muted }}>
            League:{" "}
            <select value={league} onChange={(e) => setLeague(e.target.value)} style={selectStyle}>
              {LEAGUES.map((l) => (
                <option key={l.code} value={l.code}>{l.label}</option>
              ))}
            </select>
          </label>
        ) : (
          <span style={{ display: "inline-flex", gap: 12, flexWrap: "wrap" }}>
            <label style={{ fontSize: 13, color: C.muted }}>
              Continent:{" "}
              <select value={continent} onChange={(e) => changeContinent(e.target.value)} style={selectStyle}>
                {CONTINENTS.map((c) => (
                  <option key={c || "all"} value={c}>{c || "All continents"}</option>
                ))}
              </select>
            </label>
            <label style={{ fontSize: 13, color: C.muted }}>
              Country:{" "}
              <select value={country} onChange={(e) => setCountry(e.target.value)} style={selectStyle}>
                {countriesInCont.map((c) => (
                  <option key={c.country} value={c.country}>{c.country}</option>
                ))}
              </select>
            </label>
          </span>
        )}
      </div>

      {status === "error" ? (
        <p style={{ color: "#ff6b6b", fontSize: 13 }}>Failed to load — is the API running on :8000?</p>
      ) : (
        <ResponsiveContainer width="100%" height={320}>
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={102}
              innerRadius={55}
              paddingAngle={1}
              activeIndex={activeIndex}
              activeShape={renderActive}
              onMouseEnter={(_, i) => setActiveIndex(i)}
              onMouseLeave={() => setActiveIndex(-1)}
            >
              {data.map((d, i) => (
                <Cell key={i} fill={d.name === "Other" ? OTHER : PALETTE[i % PALETTE.length]} stroke="#0f1115" />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: "6px 10px", fontSize: 12 }}
              itemStyle={{ color: C.text }}
              formatter={(v, n) => [`${v} players (${Math.round((v / total) * 100)}%)`, n]}
            />
            <Legend wrapperStyle={{ fontSize: 12, color: C.muted }} />
          </PieChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
