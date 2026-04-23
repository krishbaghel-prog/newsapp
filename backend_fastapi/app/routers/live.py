from fastapi import APIRouter

router = APIRouter(prefix="/live", tags=["live"])


@router.get("")
def live_updates_stub():
    """Placeholder until a LiveUpdate table is migrated from Mongo."""
    return {"items": []}
