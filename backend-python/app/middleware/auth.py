from fastapi import Header, HTTPException
from app.config import settings


async def verify_internal_request(
    x_internal_secret: str = Header(default=None, alias="X-Internal-Secret"),
) -> None:
    """
    Lightweight internal-service guard.
    Node.js passes the JWT_SECRET as X-Internal-Secret for service-to-service calls.
    This prevents direct external access to the Python AI service.
    In production, put the Python service behind Nginx with internal-only access instead.
    """
    if x_internal_secret != settings.jwt_secret:
        raise HTTPException(status_code=403, detail="Unauthorized internal request")
