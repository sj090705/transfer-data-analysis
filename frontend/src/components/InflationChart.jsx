import { useEffect, useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

const C = { text: "#e6e8eb", muted: "#9aa3ad", border: "#262b33" };

export default function InflationChart() {
  const [d, setD] = useState([]);
  useEffect(() => {
    fetch("/api/inflation").then((r) => r.json()).then(setD).catch(console.error);
  }, []);

  return (
    <ResponsiveContainer width="100%" height={250}>
      <LineChart data={d} margin={{ top: 8, right: 12, bottom: 4, left: -8 }}>
        <CartesianGrid stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
        <XAxis dataKey="transfer_season" tick={{ fontSize: 11, fill: C.muted }} stroke={C.muted} />
        <YAxis tick={{ fontSize: 11, fill: C.muted }} stroke={C.muted} tickFormatter={(v) => `€${v}m`} />
        <Tooltip
          contentStyle={{ background: "#0f1115", border: `1px solid ${C.border}`, borderRadius: 8, padding: "6px 10px", fontSize: 12 }}
          labelStyle={{ color: C.text }} itemStyle={{ color: C.text }} formatter={(v) => `€${v}m`}
        />
        <Legend wrapperStyle={{ fontSize: 11, color: C.muted }} />
        <Line type="monotone" dataKey="median_fee" name="Median fee" stroke="#378ADD" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="mean_fee" name="Mean fee" stroke="#EF9F27" strokeWidth={2} strokeDasharray="5 4" dot={false} />
        <Line type="monotone" dataKey="median_value" name="Median market value" stroke="#1D9E75" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
