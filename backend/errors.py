from fastapi import HTTPException


def not_found_error(message="Resource not found"):
    raise HTTPException(
        status_code=404,
        detail=message,
    )