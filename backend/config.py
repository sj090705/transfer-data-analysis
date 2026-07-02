"""Deploy-time configuration, read from the environment.

Set ALLOWED_ORIGINS to your deployed frontend URL(s), comma-separated, e.g.
  ALLOWED_ORIGINS="https://transfer-suite.vercel.app"
Defaults to the local Vite dev server.
"""
import os

ALLOWED_ORIGINS = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:5173,http://127.0.0.1:5173",
).split(",")

API_TITLE = "Big-5 Transfer Suite API"
