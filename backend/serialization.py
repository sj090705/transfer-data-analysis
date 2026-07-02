"""JSON serialisation helper shared by every router."""
import json


def records(df) -> list:
    """DataFrame -> JSON-safe list of dicts.

    df.to_json converts NaN -> null and numpy scalars -> native numbers — the
    two things FastAPI's default encoder chokes on. We round-trip through it so
    endpoints can just `return records(df)`.
    """
    return json.loads(df.to_json(orient="records"))
