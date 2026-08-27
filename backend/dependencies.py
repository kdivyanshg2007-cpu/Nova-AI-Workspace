from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError

from jwt_utils import decode_access_token


security = HTTPBearer()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Validate the JWT token from the Authorization header."""

    token = credentials.credentials

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