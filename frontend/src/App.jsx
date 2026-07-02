// Shell (host) app. Owns the chrome — a responsive side nav — and lazily mounts
// the two micro-frontends. Each import() is a separate code-split bundle, loaded
// on demand: a runtime module-composition (MFE) pattern.
import { lazy, Suspense, useState } from "react";

const AnalyticsApp = lazy(() => import("./mfe-analytics/AnalyticsApp.jsx"));
const PredictorApp = lazy(() => import("./mfe-predictor/PredictorApp.jsx"));

const APPS = [
  { id: "analytics", label: "Transfer Analytics", sub: "interactive dashboard", icon: "📊", Comp: AnalyticsApp },
  { id: "predictor", label: "Value Predictor", sub: "ML model + insights", icon: "🎯", Comp: PredictorApp },
];

const CSS = `
.shell{display:flex;min-height:100vh;}
.sidebar{width:208px;flex:0 0 208px;box-sizing:border-box;background:#12151b;
  border-right:1px solid #20242c;padding:20px 12px;position:sticky;top:0;height:100vh;
  display:flex;flex-direction:column;}
.brand{display:flex;align-items:center;gap:10px;padding:0 8px 6px;}
.brand-logo{width:30px;height:30px;border-radius:9px;background:#4FD1A5;color:#0f1115;
  display:flex;align-items:center;justify-content:center;font-size:16px;}
.nav-label{font-size:10px;letter-spacing:1px;text-transform:uppercase;color:#5b636d;padding:18px 10px 6px;}
.nav-apps{display:flex;flex-direction:column;gap:4px;}
.nav-item{display:flex;align-items:center;gap:11px;width:100%;text-align:left;padding:9px 11px;
  border:none;border-radius:10px;cursor:pointer;background:transparent;color:#9aa3ad;
  transition:background .15s ease,color .15s ease;}
.nav-item:hover{background:rgba(255,255,255,0.05);color:#e6e8eb;}
.nav-item.active{background:rgba(79,209,165,0.12);color:#4FD1A5;box-shadow:inset 3px 0 0 #4FD1A5;}
.nav-ic{display:flex;align-items:center;justify-content:center;width:28px;height:28px;flex:0 0 28px;
  border-radius:8px;background:rgba(255,255,255,0.05);font-size:15px;}
.nav-item.active .nav-ic{background:rgba(79,209,165,0.18);}
.nav-txt{display:flex;flex-direction:column;line-height:1.25;}
.nav-sub{font-size:11px;color:#6b7480;font-weight:400;}
.nav-foot{margin-top:auto;font-size:11px;color:#4d545d;line-height:1.5;padding:0 10px;}
.main{flex:1;min-width:0;max-width:1360px;margin:0 auto;padding:28px 26px 64px;width:100%;box-sizing:border-box;}
@media (max-width:820px){
  .shell{flex-direction:column;}
  .sidebar{width:100%;flex:none;height:auto;position:sticky;top:0;z-index:10;
    border-right:none;border-bottom:1px solid #20242c;padding:12px 14px;}
  .nav-label,.nav-foot{display:none;}
  .nav-apps{flex-direction:row;gap:8px;margin-top:8px;}
  .nav-item{width:auto;}
  .nav-sub{display:none;}
  .nav-item.active{box-shadow:none;border:1px solid #4FD1A5;}
  .main{padding:20px 16px 48px;}
}
`;

export default function App() {
  const [active, setActive] = useState("analytics");
  const Active = APPS.find((a) => a.id === active).Comp;

  return (
    <div className="shell" style={{ fontFamily: "system-ui, sans-serif", color: "#e6e8eb" }}>
      <style>{CSS}</style>

      <nav className="sidebar">
        <div className="brand">
          <div className="brand-logo">⚽</div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#e6e8eb", lineHeight: 1.1 }}>Transfer Suite</div>
            <div style={{ fontSize: 11, color: "#6b7480" }}>Big-5 market</div>
          </div>
        </div>

        <div className="nav-label">Apps</div>
        <div className="nav-apps">
          {APPS.map((a) => (
            <button key={a.id} className={`nav-item${a.id === active ? " active" : ""}`} onClick={() => setActive(a.id)}>
              <span className="nav-ic" aria-hidden>{a.icon}</span>
              <span className="nav-txt">
                <span>{a.label}</span>
                <span className="nav-sub">{a.sub}</span>
              </span>
            </button>
          ))}
        </div>

        <div className="nav-foot">Shell + micro-frontends · each app is a lazily-loaded module.</div>
      </nav>

      <main className="main">
        <Suspense fallback={<p style={{ color: "#9aa3ad" }}>Loading module…</p>}>
          <Active />
        </Suspense>
      </main>
    </div>
  );
}
