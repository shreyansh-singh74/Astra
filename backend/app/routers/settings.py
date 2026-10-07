from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from backend.app.core import app_settings

router = APIRouter(prefix="/api/settings", tags=["settings"])


class SettingsUpdate(BaseModel):
    weights: Optional[dict] = None
    sieve_threshold: Optional[float] = None
    collusion_threshold: Optional[float] = None
    default_models: Optional[list] = None


@router.get("")
def get_settings():
    return app_settings.snapshot()


@router.put("")
def update_settings(body: SettingsUpdate):
    try:
        if body.weights is not None:
            app_settings.set_weights(body.weights)
        if body.sieve_threshold is not None:
            app_settings.set_sieve_threshold(body.sieve_threshold)
        if body.collusion_threshold is not None:
            app_settings.set_collusion_threshold(body.collusion_threshold)
        if body.default_models is not None:
            app_settings.set_default_models(body.default_models)
    except (TypeError, ValueError) as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    return app_settings.snapshot()
