from fastapi import APIRouter, Depends
from pydantic import BaseModel

from database import get_connection
from dependencies import get_current_user


router = APIRouter(
    prefix="/api/v1/memories",
    tags=["Memories"]
)


class MemoryCreate(BaseModel):
    memory_key: str
    memory_value: str
    workspace_id: int | None = None


class MemoryUpdate(BaseModel):
    memory_key: str | None = None
    memory_value: str | None = None


@router.post("")
def create_memory(
    data: MemoryCreate,
    current_user: dict = Depends(get_current_user),
):
    connection = get_connection()
    cursor = connection.cursor()

    try:
        cursor.execute(
            """
            INSERT INTO memories (
                user_id,
                workspace_id,
                memory_key,
                memory_value
            )
            VALUES (%s, %s, %s, %s)
            RETURNING id, user_id, workspace_id,
                      memory_key, memory_value,
                      created_at, updated_at;
            """,
            (
                current_user["user_id"],
                data.workspace_id,
                data.memory_key,
                data.memory_value,
            ),
        )

        memory = cursor.fetchone()
        connection.commit()

        return {
            "message": "Memory created successfully",
            "memory": memory,
        }

    finally:
        cursor.close()
        connection.close()


@router.get("")
def get_memories(
    current_user: dict = Depends(get_current_user),
):
    connection = get_connection()
    cursor = connection.cursor()

    try:
        cursor.execute(
            """
            SELECT id, user_id, workspace_id,
                   memory_key, memory_value,
                   created_at, updated_at
            FROM memories
            WHERE user_id = %s
            ORDER BY updated_at DESC;
            """,
            (current_user["user_id"],),
        )

        memories = cursor.fetchall()

        return {
            "count": len(memories),
            "memories": memories,
        }

    finally:
        cursor.close()
        connection.close()


@router.put("/{memory_id}")
def update_memory(
    memory_id: int,
    data: MemoryUpdate,
    current_user: dict = Depends(get_current_user),
):
    connection = get_connection()
    cursor = connection.cursor()

    try:
        cursor.execute(
            """
            UPDATE memories
            SET
                memory_key = COALESCE(%s, memory_key),
                memory_value = COALESCE(%s, memory_value),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = %s
              AND user_id = %s
            RETURNING id, user_id, workspace_id,
                      memory_key, memory_value,
                      created_at, updated_at;
            """,
            (
                data.memory_key,
                data.memory_value,
                memory_id,
                current_user["user_id"],
            ),
        )

        memory = cursor.fetchone()

        if memory is None:
            connection.rollback()
            return {
                "message": "Memory not found"
            }

        connection.commit()

        return {
            "message": "Memory updated successfully",
            "memory": memory,
        }

    finally:
        cursor.close()
        connection.close()


@router.delete("/{memory_id}")
def delete_memory(
    memory_id: int,
    current_user: dict = Depends(get_current_user),
):
    connection = get_connection()
    cursor = connection.cursor()

    try:
        cursor.execute(
            """
            DELETE FROM memories
            WHERE id = %s
              AND user_id = %s
            RETURNING id;
            """,
            (
                memory_id,
                current_user["user_id"],
            ),
        )

        deleted_memory = cursor.fetchone()

        if deleted_memory is None:
            connection.rollback()
            return {
                "message": "Memory not found"
            }

        connection.commit()

        return {
            "message": "Memory deleted successfully",
            "memory_id": memory_id,
        }

    finally:
        cursor.close()
        connection.close()