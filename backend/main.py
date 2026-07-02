"""
FastAPI entry point. Thin by design — it just creates the app, sets CORS from
config, and mounts the three routers:

  routers/analytics.py  market trends (inflation, caliber, top deals, recruitment)
  routers/clubs.py      club & player entities (ledgers, net earners, origins)
  routers/model.py      ML (value predictor + fee counter-example)

The DataFrame that everything queries is built once, on import of backend.data.

Run:  python3 -m uvicorn backend.main:app --reload      (from the project root)
Note: first boot builds the master DataFrame from the CSVs, so it's slow.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.config import ALLOWED_ORIGINS, API_TITLE
from backend.routers import analytics, clubs, model

app = FastAPI(title=API_TITLE)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(analytics.router)
app.include_router(clubs.router)
app.include_router(model.router)


@app.get("/api/health")
def health():
    return {"status": "ok"}
