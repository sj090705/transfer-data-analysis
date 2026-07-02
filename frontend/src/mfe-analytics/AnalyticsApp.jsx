// Micro-frontend: Transfer Analytics. Grid dashboard — KPI stat cards, a tidy
// overview grid of equal-height tiles, then heavier interactive panels below.
import StatCards from "../components/StatCards.jsx";
import InflationChart from "../components/InflationChart.jsx";
import EraCompare from "../components/EraCompare.jsx";
import NetEarners from "../components/NetEarners.jsx";
import NetSpenders from "../components/NetSpenders.jsx";
import SpendByPosition from "../components/SpendByPosition.jsx";
import PlayerOrigins from "../components/PlayerOrigins.jsx";
import AttackerDeepDive from "../components/AttackerDeepDive.jsx";
import RecruitmentTrends from "../components/RecruitmentTrends.jsx";
import TopTransfers from "../components/TopTransfers.jsx";
import ClubActivity from "../components/ClubActivity.jsx";

const cardBase = {
  background: "#161a20",
  border: "1px solid #232a33",
  borderRadius: 16,
  boxShadow: "0 1px 3px rgba(0,0,0,0.35)",
  minWidth: 0, // let charts inside shrink instead of overflowing (grid/flex gotcha)
};

function TileTitle({ dot, children }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: dot || "#4FD1A5" }} />
      <span style={{ fontSize: 12, letterSpacing: 0.5, textTransform: "uppercase", color: "#8b93a0" }}>{children}</span>
    </div>
  );
}

function Tile({ title, dot, children }) {
  return (
    <div style={{ ...cardBase, padding: "18px 20px", display: "flex", flexDirection: "column" }}>
      <TileTitle dot={dot}>{title}</TileTitle>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>{children}</div>
    </div>
  );
}

function Section({ title, dot, children }) {
  return (
    <section style={{ ...cardBase, padding: "22px 24px", marginTop: 18 }}>
      <TileTitle dot={dot}>{title}</TileTitle>
      {children}
    </section>
  );
}

export default function AnalyticsApp() {
  return (
    <div>
      <h1 style={{ fontSize: 25, fontWeight: 600, marginBottom: 4 }}>Big-5 Transfer Analytics</h1>
      <p style={{ color: "#9aa3ad", marginTop: 0, marginBottom: 22 }}>How the Big-5 transfer market has changed.</p>

      <StatCards />

      {/* overview grid — equal-height tiles (row stretch) */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 18, marginTop: 18 }}>
        <Tile title="Fee inflation" dot="#378ADD"><InflationChart /></Tile>
        <Tile title="What big money buys · 2013 vs now" dot="#4FD1A5"><EraCompare /></Tile>
        <Tile title="Where the money goes" dot="#F0997B"><SpendByPosition /></Tile>
        <Tile title="Biggest net spenders" dot="#F0997B"><NetSpenders /></Tile>
        <Tile title="Best player traders" dot="#EF9F27"><NetEarners /></Tile>
        <Tile title="Player origins" dot="#F0997B"><PlayerOrigins /></Tile>
      </div>

      {/* interactive tools — full width */}
      <Section title="Fee vs caliber" dot="#378ADD"><AttackerDeepDive /></Section>
      <Section title="Top transfers" dot="#4FD1A5"><TopTransfers /></Section>
      <Section title="Club transfer activity" dot="#EF9F27"><ClubActivity /></Section>
      <Section title="Recruitment" dot="#F0997B"><RecruitmentTrends /></Section>
    </div>
  );
}
