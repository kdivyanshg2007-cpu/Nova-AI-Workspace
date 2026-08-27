from fastapi import Header, HTTPException
from jose import JWTError

from jwt_utils import decode_access_token


def get_current_user(authorization: str | None = Header(default=None)):
    """Validate the JWT token from the Authorization header."""

    if not authorization:
        raise HTTPException(
            status_code=401,
            detail="Authorization header is missing.",
        )

    if not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=401,
            detail="Invalid authorization format.",
        )

    token = authorization.split(" ", 1)[1]

    try:
        payload = decode_access_token(token)
        user_id = payload.get("user_id")

        if user_id is None:
            raise HTTPException(
                status_code=401,
                detail="Invalid token.",
            )

        return {"user_id": user_id}

    except JWTError:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired token.",
        )