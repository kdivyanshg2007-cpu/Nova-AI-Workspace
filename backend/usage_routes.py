from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from database import get_connection
from dependencies import get_current_user


router = APIRouter(
    prefix="/api/v1/usage",
    tags=["AI Usage"],
)


class UsageLogCreate(BaseModel):
    workspace_id: int | None = None
    provider: str = Field(..., min_length=1, max_length=30)
    model: str = Field(..., min_length=1, max_length=100)
    input_tokens: int = Field(0, ge=0)
    output_tokens: int = Field(0, ge=0)
    estimated_cost: float = Field(0, ge=0)


@router.post("")
def create_usage_log(
    request: UsageLogCreate,
    current_user: dict = Depends(get_current_user),
):
    user_id = current_user["user_id"]

    total_tokens = request.input_tokens + request.output_tokens

    connection = get_connection()
    cursor = connection.cursor()

    try:
        cursor.execute(
            """
            INSERT INTO ai_usage_logs (
                user_id,
                workspace_id,
                provider,
                model,
                input_tokens,
                output_tokens,
                total_tokens,
                estimated_cost
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING
                id,
                user_id,
                workspace_id,
                provider,
                model,
                input_tokens,
                output_tokens,
                total_tokens,
                estimated_cost,
                created_at;
            """,
            (
                user_id,
                request.workspace_id,
                request.provider,
                request.model,
                request.input_tokens,
                request.output_tokens,
                total_tokens,
                request.estimated_cost,
            ),
        )

        row = cursor.fetchone()
        connection.commit()

        return {
            "success": True,
            "message": "AI usage logged successfully.",
            "usage": {
                "id": row[0],
                "user_id": row[1],
                "workspace_id": row[2],
                "provider": row[3],
                "model": row[4],
                "input_tokens": row[5],
                "output_tokens": row[6],
                "total_tokens": row[7],
                "estimated_cost": float(row[8]),
                "created_at": row[9],
            },
        }

    finally:
        cursor.close()
        connection.close()


@router.get("")
def get_usage_logs(
    current_user: dict = Depends(get_current_user),
):
    user_id = current_user["user_id"]

    connection = get_connection()
    cursor = connection.cursor()

    try:
        cursor.execute(
            """
            SELECT
                id,
                user_id,
                workspace_id,
                provider,
                model,
                input_tokens,
                output_tokens,
                total_tokens,
                estimated_cost,
                created_at
            FROM ai_usage_logs
            WHERE user_id = %s
            ORDER BY created_at DESC;
            """,
            (user_id,),
        )

        rows = cursor.fetchall()

        usage_logs = []

        for row in rows:
            usage_logs.append(
                {
                    "id": row[0],
                    "user_id": row[1],
                    "workspace_id": row[2],
                    "provider": row[3],
                    "model": row[4],
                    "input_tokens": row[5],
                    "output_tokens": row[6],
                    "total_tokens": row[7],
                    "estimated_cost": float(row[8]),
                    "created_at": row[9],
                }
            )

        total_tokens = sum(
            item["total_tokens"] for item in usage_logs
        )

        total_cost = sum(
            item["estimated_cost"] for item in usage_logs
        )

        return {
            "success": True,
            "count": len(usage_logs),
            "total_tokens": total_tokens,
            "total_estimated_cost": total_cost,
            "usage": usage_logs,
        }

    finally:
        cursor.close()
        connection.close()