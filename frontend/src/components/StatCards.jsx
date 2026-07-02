import { useEffect, useState } from "react";

const CARDS = [
  { key: "transfers", label: "Transfers analysed", fmt: (v) => v.toLocaleString(), sub: "Big-5 involved", color: "#5AA0E8" },
  { key: "total_spend_bn", label: "Total fees", fmt: (v) => `€${v}bn`, sub: "recorded paid deals", color: "#4FD1A5" },
  { key: "record_fee", label: "Record fee", fmt: (v) => `€${v}m`, subKey: "record_player", color: "#F0997B" },
  { key: "clubs", label: "Clubs covered", fmt: (v) => v, sub: "across the Big 5", color: "#EFB24E" },
];

export default function StatCards() {
  const [s, setS] = useState(null);
  useEffect(() => {
    fetch("/api/summary").then((r) => r.json()).then(setS).catch(console.error);
  }, []);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 14 }}>
      {CARDS.map((c) => (
        <div
          key={c.key}
          style={{
            background: "#161a20",
            border: "1px solid #232a33",
            borderRadius: 16,
            padding: "18px 20px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.35)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10 }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: c.color }} />
            <span style={{ fontSize: 12.5, color: "#8b93a0" }}>{c.label}</span>
          </div>
          <div style={{ fontSize: 30, fontWeight: 600, color: c.color, lineHeight: 1.1 }}>
            {s ? c.fmt(s[c.key]) : "—"}
          </div>
          <div style={{ fontSize: 12, color: "#6b7480", marginTop: 4 }}>{s && c.subKey ? s[c.subKey] : c.sub}</div>
        </div>
      ))}
    </div>
  );
}
