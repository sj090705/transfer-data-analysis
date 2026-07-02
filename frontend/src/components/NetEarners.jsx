import { useEffect, useState } from "react";

const C = {
  text: "#e6e8eb",
  muted: "#9aa3ad",
  earn: "#4FD1A5",
  track: "rgba(79,209,165,0.15)",
  border: "#262b33",
};

// "all" + seasons newest-first: 2009..2025 -> "09/10".."25/26"
const YEARS = Array.from({ length: 2025 - 2009 + 1 }, (_, i) => 2009 + i);
const SEASONS = [
  "all",
  ...YEARS.map((y) => `${String(y % 100).padStart(2, "0")}/${String((y + 1) % 100).padStart(2, "0")}`).reverse(),
];

export default function NetEarners() {
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState("loading");
  const [season, setSeason] = useState("all");

  useEffect(() => {
    setStatus("loading");
    const q = season === "all" ? "" : `&season=${encodeURIComponent(season)}`;
    fetch(`/api/net-earners?top_n=10${q}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d) => {
        setRows(d);
        setStatus("ready");
      })
      .catch((e) => {
        console.error(e);
        setStatus("error");
      });
  }, [season]);

  const max = Math.max(...rows.map((r) => r.net_earned), 1);
  const short = (n) => (n.length > 22 ? n.slice(0, 20) + "…" : n);

  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <p style={{ color: C.muted, fontSize: 13, margin: 0 }}>
          Net €m earned from the Big 5 (sales − purchases)
        </p>
        <label style={{ fontSize: 13, color: C.muted }}>
          Season:{" "}
          <select
            value={season}
            onChange={(e) => setSeason(e.target.value)}
            style={{ fontSize: 13, padding: "4px 8px", background: "#161a20", color: C.text, border: `1px solid ${C.border}`, borderRadius: 6 }}
          >
            {SEASONS.map((s) => (
              <option key={s} value={s}>{s === "all" ? "All time" : s}</option>
            ))}
          </select>
        </label>
      </div>

      {status === "loading" && <p style={{ color: C.muted, fontSize: 13 }}>Loading…</p>}
      {status === "error" && <p style={{ color: "#ff6b6b", fontSize: 13 }}>Failed to load — is the API running on :8000?</p>}
      {status === "ready" && rows.length === 0 && (
        <p style={{ color: C.muted, fontSize: 13 }}>No net earners for this season.</p>
      )}

      <style>{`@keyframes neFade{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}`}</style>
      {status === "ready" && rows.length > 0 && (
        <div
          key={season}
          style={{ display: "flex", flexDirection: "column", gap: 8, animation: "neFade 0.35s ease" }}
        >
          {rows.map((r, i) => (
            <div key={r.club_id} style={{ display: "grid", gridTemplateColumns: "18px 1fr auto", alignItems: "center", gap: 10 }}>
              <span style={{ color: C.muted, fontSize: 12, textAlign: "right" }}>{i + 1}</span>
              <div>
                <div style={{ color: C.text, fontSize: 13, marginBottom: 3 }} title={r.club_name}>
                  {short(r.club_name)}
                </div>
                <div style={{ height: 4, background: C.track, borderRadius: 2 }}>
                  <div
                    style={{
                      width: `${Math.max((r.net_earned / max) * 100, 0)}%`,
                      height: "100%",
                      background: C.earn,
                      borderRadius: 2,
                      transition: "width 0.45s ease",
                    }}
                  />
                </div>
              </div>
              <span style={{ color: C.earn, fontSize: 13, fontWeight: 500, whiteSpace: "nowrap" }}>
                +€{Math.round(r.net_earned)}m
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
