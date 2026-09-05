from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from database import get_connection
from dependencies import get_current_user


router = APIRouter(
    prefix="/api/v1/evaluations",
    tags=["AI Evaluations"],
)


class EvaluationCreate(BaseModel):
    workspace_id: int | None = None
    conversation_id: int | None = None
    message_id: int | None = None
    score: int = Field(..., ge=1, le=5)
    feedback: str | None = None
    evaluation_type: str = "quality"


@router.post("")
def create_evaluation(
    request: EvaluationCreate,
    current_user: dict = Depends(get_current_user),
):
    user_id = current_user["user_id"]

    connection = get_connection()
    cursor = connection.cursor()

    try:
        cursor.execute(
            """
            INSERT INTO ai_evaluations (
                user_id,
                workspace_id,
                conversation_id,
                message_id,
                score,
                feedback,
                evaluation_type
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            RETURNING
                id,
                user_id,
                workspace_id,
                conversation_id,
                message_id,
                score,
                feedback,
                evaluation_type,
                created_at;
            """,
            (
                user_id,
                request.workspace_id,
                request.conversation_id,
                request.message_id,
                request.score,
                request.feedback,
                request.evaluation_type,
            ),
        )

        row = cursor.fetchone()
        connection.commit()

        return {
            "success": True,
            "message": "Evaluation created successfully.",
            "evaluation": {
                "id": row[0],
                "user_id": row[1],
                "workspace_id": row[2],
                "conversation_id": row[3],
                "message_id": row[4],
                "score": row[5],
                "feedback": row[6],
                "evaluation_type": row[7],
                "created_at": row[8],
            },
        }

    finally:
        cursor.close()
        connection.close()


@router.get("")
def get_evaluations(
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
                conversation_id,
                message_id,
                score,
                feedback,
                evaluation_type,
                created_at
            FROM ai_evaluations
            WHERE user_id = %s
            ORDER BY created_at DESC;
            """,
            (user_id,),
        )

        rows = cursor.fetchall()

        evaluations = []

        for row in rows:
            evaluations.append(
                {
                    "id": row[0],
                    "user_id": row[1],
                    "workspace_id": row[2],
                    "conversation_id": row[3],
                    "message_id": row[4],
                    "score": row[5],
                    "feedback": row[6],
                    "evaluation_type": row[7],
                    "created_at": row[8],
                }
            )

        return {
            "success": True,
            "count": len(evaluations),
            "evaluations": evaluations,
        }

    finally:
        cursor.close()
        connection.close()