from datetime import datetime
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from database import get_connection
from dependencies import get_current_user


router = APIRouter(
    prefix="/api/v1/productivity",
    tags=["Productivity"],
)


# =========================================================
# PYDANTIC MODELS / INPUT VALIDATION
# =========================================================

class NoteCreate(BaseModel):
    title: str = Field(
        ...,
        min_length=1,
        max_length=200,
    )

    content: str = Field(
        ...,
        min_length=1,
        max_length=10000,
    )

    workspace_id: int | None = None


class NoteUpdate(BaseModel):
    title: str | None = Field(
        None,
        min_length=1,
        max_length=200,
    )

    content: str | None = Field(
        None,
        min_length=1,
        max_length=10000,
    )


class TaskCreate(BaseModel):
    title: str = Field(
        ...,
        min_length=1,
        max_length=200,
    )

    description: str | None = Field(
        None,
        max_length=10000,
    )

    priority: Literal["high", "medium", "low"] = "medium"

    status: Literal[
        "pending",
        "in_progress",
        "completed",
    ] = "pending"

    deadline: datetime | None = None

    workspace_id: int | None = None


class TaskUpdate(BaseModel):
    title: str | None = Field(
        None,
        min_length=1,
        max_length=200,
    )

    description: str | None = Field(
        None,
        max_length=10000,
    )

    priority: Literal[
        "high",
        "medium",
        "low",
    ] | None = None

    status: Literal[
        "pending",
        "in_progress",
        "completed",
    ] | None = None

    deadline: datetime | None = None


# =========================================================
# NOTES
# =========================================================

@router.post("/notes")
def create_note(
    note: NoteCreate,
    current_user=Depends(get_current_user),
):
    user_id = current_user["user_id"]

    connection = get_connection()
    cursor = connection.cursor()

    try:
        cursor.execute(
            """
            INSERT INTO notes (
                user_id,
                workspace_id,
                title,
                content
            )
            VALUES (%s, %s, %s, %s)
            RETURNING id, user_id, workspace_id, title, content,
                      created_at, updated_at;
            """,
            (
                user_id,
                note.workspace_id,
                note.title,
                note.content,
            ),
        )

        created_note = cursor.fetchone()
        connection.commit()

        return {
            "message": "Note created successfully",
            "note": created_note,
        }

    except Exception:
        connection.rollback()

        raise HTTPException(
            status_code=500,
            detail="Failed to create note.",
        )

    finally:
        cursor.close()
        connection.close()


@router.get("/notes")
def get_notes(
    workspace_id: int | None = None,
    current_user=Depends(get_current_user),
):
    user_id = current_user["user_id"]

    connection = get_connection()
    cursor = connection.cursor()

    try:
        if workspace_id is not None:
            cursor.execute(
                """
                SELECT id, user_id, workspace_id, title, content,
                       created_at, updated_at
                FROM notes
                WHERE user_id = %s
                  AND workspace_id = %s
                ORDER BY updated_at DESC;
                """,
                (
                    user_id,
                    workspace_id,
                ),
            )

        else:
            cursor.execute(
                """
                SELECT id, user_id, workspace_id, title, content,
                       created_at, updated_at
                FROM notes
                WHERE user_id = %s
                ORDER BY updated_at DESC;
                """,
                (user_id,),
            )

        notes = cursor.fetchall()

        return {
            "count": len(notes),
            "notes": notes,
        }

    finally:
        cursor.close()
        connection.close()


@router.put("/notes/{note_id}")
def update_note(
    note_id: int,
    note: NoteUpdate,
    current_user=Depends(get_current_user),
):
    user_id = current_user["user_id"]

    connection = get_connection()
    cursor = connection.cursor()

    try:
        cursor.execute(
            """
            UPDATE notes
            SET
                title = COALESCE(%s, title),
                content = COALESCE(%s, content),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = %s
              AND user_id = %s
            RETURNING id, user_id, workspace_id, title, content,
                      created_at, updated_at;
            """,
            (
                note.title,
                note.content,
                note_id,
                user_id,
            ),
        )

        updated_note = cursor.fetchone()

        if updated_note is None:
            connection.rollback()

            raise HTTPException(
                status_code=404,
                detail="Note not found.",
            )

        connection.commit()

        return {
            "message": "Note updated successfully",
            "note": updated_note,
        }

    except HTTPException:
        raise

    except Exception:
        connection.rollback()

        raise HTTPException(
            status_code=500,
            detail="Failed to update note.",
        )

    finally:
        cursor.close()
        connection.close()


@router.delete("/notes/{note_id}")
def delete_note(
    note_id: int,
    current_user=Depends(get_current_user),
):
    user_id = current_user["user_id"]

    connection = get_connection()
    cursor = connection.cursor()

    try:
        cursor.execute(
            """
            DELETE FROM notes
            WHERE id = %s
              AND user_id = %s
            RETURNING id;
            """,
            (
                note_id,
                user_id,
            ),
        )

        deleted_note = cursor.fetchone()

        if deleted_note is None:
            connection.rollback()

            raise HTTPException(
                status_code=404,
                detail="Note not found.",
            )

        connection.commit()

        return {
            "message": "Note deleted successfully",
            "note_id": deleted_note[0],
        }

    except HTTPException:
        raise

    except Exception:
        connection.rollback()

        raise HTTPException(
            status_code=500,
            detail="Failed to delete note.",
        )

    finally:
        cursor.close()
        connection.close()


# =========================================================
# TASKS
# =========================================================

@router.post("/tasks")
def create_task(
    task: TaskCreate,
    current_user=Depends(get_current_user),
):
    user_id = current_user["user_id"]

    connection = get_connection()
    cursor = connection.cursor()

    try:
        cursor.execute(
            """
            INSERT INTO tasks (
                user_id,
                workspace_id,
                title,
                description,
                priority,
                status,
                deadline
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            RETURNING id, user_id, workspace_id, title, description,
                      priority, status, deadline, created_at, updated_at;
            """,
            (
                user_id,
                task.workspace_id,
                task.title,
                task.description,
                task.priority,
                task.status,
                task.deadline,
            ),
        )

        created_task = cursor.fetchone()
        connection.commit()

        return {
            "message": "Task created successfully",
            "task": created_task,
        }

    except Exception:
        connection.rollback()

        raise HTTPException(
            status_code=500,
            detail="Failed to create task.",
        )

    finally:
        cursor.close()
        connection.close()


@router.get("/tasks")
def get_tasks(
    workspace_id: int | None = None,
    status: Literal[
        "pending",
        "in_progress",
        "completed",
    ] | None = None,
    current_user=Depends(get_current_user),
):
    user_id = current_user["user_id"]

    connection = get_connection()
    cursor = connection.cursor()

    try:
        query = """
            SELECT id, user_id, workspace_id, title, description,
                   priority, status, deadline, created_at, updated_at
            FROM tasks
            WHERE user_id = %s
        """

        params = [user_id]

        if workspace_id is not None:
            query += " AND workspace_id = %s"
            params.append(workspace_id)

        if status is not None:
            query += " AND status = %s"
            params.append(status)

        query += """
            ORDER BY
                CASE priority
                    WHEN 'high' THEN 1
                    WHEN 'medium' THEN 2
                    WHEN 'low' THEN 3
                    ELSE 4
                END,
                deadline ASC NULLS LAST,
                updated_at DESC;
        """

        cursor.execute(
            query,
            tuple(params),
        )

        tasks = cursor.fetchall()

        return {
            "count": len(tasks),
            "tasks": tasks,
        }

    finally:
        cursor.close()
        connection.close()


@router.put("/tasks/{task_id}")
def update_task(
    task_id: int,
    task: TaskUpdate,
    current_user=Depends(get_current_user),
):
    user_id = current_user["user_id"]

    connection = get_connection()
    cursor = connection.cursor()

    try:
        cursor.execute(
            """
            UPDATE tasks
            SET
                title = COALESCE(%s, title),
                description = COALESCE(%s, description),
                priority = COALESCE(%s, priority),
                status = COALESCE(%s, status),
                deadline = COALESCE(%s, deadline),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = %s
              AND user_id = %s
            RETURNING id, user_id, workspace_id, title, description,
                      priority, status, deadline, created_at, updated_at;
            """,
            (
                task.title,
                task.description,
                task.priority,
                task.status,
                task.deadline,
                task_id,
                user_id,
            ),
        )

        updated_task = cursor.fetchone()

        if updated_task is None:
            connection.rollback()

            raise HTTPException(
                status_code=404,
                detail="Task not found.",
            )

        connection.commit()

        return {
            "message": "Task updated successfully",
            "task": updated_task,
        }

    except HTTPException:
        raise

    except Exception:
        connection.rollback()

        raise HTTPException(
            status_code=500,
            detail="Failed to update task.",
        )

    finally:
        cursor.close()
        connection.close()


@router.delete("/tasks/{task_id}")
def delete_task(
    task_id: int,
    current_user=Depends(get_current_user),
):
    user_id = current_user["user_id"]

    connection = get_connection()
    cursor = connection.cursor()

    try:
        cursor.execute(
            """
            DELETE FROM tasks
            WHERE id = %s
              AND user_id = %s
            RETURNING id;
            """,
            (
                task_id,
                user_id,
            ),
        )

        deleted_task = cursor.fetchone()

        if deleted_task is None:
            connection.rollback()

            raise HTTPException(
                status_code=404,
                detail="Task not found.",
            )

        connection.commit()

        return {
            "message": "Task deleted successfully",
            "task_id": deleted_task[0],
        }

    except HTTPException:
        raise

    except Exception:
        connection.rollback()

        raise HTTPException(
            status_code=500,
            detail="Failed to delete task.",
        )

    finally:
        cursor.close()
        connection.close()