import { useEffect, useState } from "react";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";

const COLORS = { Attack: "#F0997B", Midfield: "#5AA0E8", Defender: "#4FD1A5", Goalkeeper: "#EFB24E" };
const C = { text: "#e6e8eb", muted: "#9aa3ad", border: "#262b33" };

export default function SpendByPosition() {
  const [data, setData] = useState([]);
  useEffect(() => {
    fetch("/api/spend-by-position").then((r) => r.json()).then(setData).catch(console.error);
  }, []);

  const total = data.reduce((s, d) => s + d.value, 0) || 1;

  return (
    <div>
      <p style={{ color: C.muted, fontSize: 13, margin: "0 0 6px" }}>Total Big-5 fees by position (€bn share)</p>
      <ResponsiveContainer width="100%" height={230}>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={92} paddingAngle={1}>
            {data.map((d) => <Cell key={d.name} fill={COLORS[d.name] || "#5F5E5A"} stroke="#0f1115" />)}
          </Pie>
          <Tooltip
            contentStyle={{ background: "#0f1115", border: `1px solid ${C.border}`, borderRadius: 8, padding: "6px 10px", fontSize: 12 }}
            itemStyle={{ color: C.text }}
            formatter={(v, n) => [`€${(v / 1000).toFixed(1)}bn (${Math.round((v / total) * 100)}%)`, n]}
          />
          <Legend wrapperStyle={{ fontSize: 12, color: C.muted }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
