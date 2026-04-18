from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.schemas import CurrentUser
from app.security.directus_auth import get_current_user

router = APIRouter(prefix="/api", tags=["auth"])


class MeResponse(BaseModel):
    id: str
    email: str
    role: str  # 'admin' | 'viewer'


@router.get("/me", response_model=MeResponse)
async def get_me(user: CurrentUser = Depends(get_current_user)) -> MeResponse:
    # Role is a StrEnum with lowercase values ('admin' | 'viewer').
    role_str = user.role.value.lower() if hasattr(user.role, "value") else str(user.role).lower()
    return MeResponse(id=str(user.id), email=user.email, role=role_str)
