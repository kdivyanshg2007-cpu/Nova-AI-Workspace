from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Literal

from database import get_connection
from dependencies import get_current_user


router = APIRouter(
    prefix="/api/v1/preferences",
    tags=["Preferences"],
)


class PreferencesUpdate(BaseModel):
    language: Literal["en", "hi"] = "en"
    theme: Literal["light", "dark"] = "light"
    model_preference: str = "gemini-3.6-flash"


def get_or_create_preferences(user_id: int):
    connection = get_connection()
    cursor = connection.cursor()

    try:
        cursor.execute(
            """
            SELECT
                user_id,
                language,
                theme,
                model_preference,
                created_at,
                updated_at
            FROM user_preferences
            WHERE user_id = %s;
            """,
            (user_id,),
        )

        row = cursor.fetchone()

        if row is None:
            cursor.execute(
                """
                INSERT INTO user_preferences (
                    user_id,
                    language,
                    theme,
                    model_preference
                )
                VALUES (%s, %s, %s, %s)
                RETURNING
                    user_id,
                    language,
                    theme,
                    model_preference,
                    created_at,
                    updated_at;
                """,
                (
                    user_id,
                    "en",
                    "light",
                    "gemini-3.6-flash",
                ),
            )

            row = cursor.fetchone()
            connection.commit()

        return {
            "user_id": row[0],
            "language": row[1],
            "theme": row[2],
            "model_preference": row[3],
            "created_at": row[4],
            "updated_at": row[5],
        }

    finally:
        cursor.close()
        connection.close()


@router.get("")
def get_preferences(
    current_user: dict = Depends(get_current_user),
):
    user_id = current_user["user_id"]

    return {
        "success": True,
        "preferences": get_or_create_preferences(user_id),
    }


@router.put("")
def update_preferences(
    request: PreferencesUpdate,
    current_user: dict = Depends(get_current_user),
):
    user_id = current_user["user_id"]

    connection = get_connection()
    cursor = connection.cursor()

    try:
        cursor.execute(
            """
            INSERT INTO user_preferences (
                user_id,
                language,
                theme,
                model_preference
            )
            VALUES (%s, %s, %s, %s)

            ON CONFLICT (user_id)
            DO UPDATE SET
                language = EXCLUDED.language,
                theme = EXCLUDED.theme,
                model_preference = EXCLUDED.model_preference,
                updated_at = CURRENT_TIMESTAMP

            RETURNING
                user_id,
                language,
                theme,
                model_preference,
                created_at,
                updated_at;
            """,
            (
                user_id,
                request.language,
                request.theme,
                request.model_preference,
            ),
        )

        row = cursor.fetchone()
        connection.commit()

        return {
            "success": True,
            "message": "Preferences updated successfully.",
            "preferences": {
                "user_id": row[0],
                "language": row[1],
                "theme": row[2],
                "model_preference": row[3],
                "created_at": row[4],
                "updated_at": row[5],
            },
        }

    finally:
        cursor.close()
        connection.close()