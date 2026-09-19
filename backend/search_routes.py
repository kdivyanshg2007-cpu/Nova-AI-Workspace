from fastapi import APIRouter, Depends
from dependencies import get_current_user
from database import get_connection


router = APIRouter(
    prefix="/api/v1/search",
    tags=["Global Search"],
)


@router.get("")
def global_search(
    q: str,
    current_user: dict = Depends(get_current_user),
):
    q = q.strip()

    if not q:
        return {
            "success": False,
            "message": "Search query cannot be empty.",
        }

    user_id = current_user["user_id"]

    connection = get_connection()
    cursor = connection.cursor()

    results = []

    try:
        # -------------------------------------------------
        # SEARCH CONVERSATIONS
        # -------------------------------------------------

        cursor.execute(
            """
            SELECT
                id,
                workspace_id,
                title,
                created_at,
                updated_at
            FROM conversations
            WHERE user_id = %s
              AND title ILIKE %s
            ORDER BY updated_at DESC
            LIMIT 20;
            """,
            (
                user_id,
                f"%{q}%",
            ),
        )

        for row in cursor.fetchall():
            results.append(
                {
                    "type": "conversation",
                    "id": row[0],
                    "workspace_id": row[1],
                    "title": row[2],
                    "created_at": row[3],
                    "updated_at": row[4],
                }
            )

        # -------------------------------------------------
        # SEARCH MESSAGES
        # -------------------------------------------------

        cursor.execute(
            """
            SELECT
                m.id,
                m.conversation_id,
                c.workspace_id,
                m.role,
                m.content,
                m.created_at
            FROM messages m
            JOIN conversations c
                ON c.id = m.conversation_id
            WHERE c.user_id = %s
              AND m.content ILIKE %s
            ORDER BY m.created_at DESC
            LIMIT 30;
            """,
            (
                user_id,
                f"%{q}%",
            ),
        )

        for row in cursor.fetchall():
            results.append(
                {
                    "type": "message",
                    "id": row[0],
                    "conversation_id": row[1],
                    "workspace_id": row[2],
                    "role": row[3],
                    "content": row[4],
                    "created_at": row[5],
                }
            )

        # -------------------------------------------------
        # SEARCH FILES
        # -------------------------------------------------

        cursor.execute(
            """
            SELECT
                id,
                workspace_id,
                filename,
                mime_type,
                file_size,
                created_at
            FROM files
            WHERE user_id = %s
              AND filename ILIKE %s
            ORDER BY created_at DESC
            LIMIT 20;
            """,
            (
                user_id,
                f"%{q}%",
            ),
        )

        for row in cursor.fetchall():
            results.append(
                {
                    "type": "file",
                    "id": row[0],
                    "workspace_id": row[1],
                    "filename": row[2],
                    "mime_type": row[3],
                    "file_size": row[4],
                    "created_at": row[5],
                }
            )

        # -------------------------------------------------
        # SEARCH NOTES
        # -------------------------------------------------

        cursor.execute(
            """
            SELECT
                id,
                workspace_id,
                title,
                content,
                created_at,
                updated_at
            FROM notes
            WHERE user_id = %s
              AND (
                    title ILIKE %s
                    OR content ILIKE %s
              )
            ORDER BY updated_at DESC
            LIMIT 20;
            """,
            (
                user_id,
                f"%{q}%",
                f"%{q}%",
            ),
        )

        for row in cursor.fetchall():
            results.append(
                {
                    "type": "note",
                    "id": row[0],
                    "workspace_id": row[1],
                    "title": row[2],
                    "content": row[3],
                    "created_at": row[4],
                    "updated_at": row[5],
                }
            )

        # -------------------------------------------------
        # SEARCH TASKS
        # -------------------------------------------------

        cursor.execute(
            """
            SELECT
                id,
                workspace_id,
                title,
                description,
                priority,
                status,
                deadline,
                created_at,
                updated_at
            FROM tasks
            WHERE user_id = %s
              AND (
                    title ILIKE %s
                    OR description ILIKE %s
              )
            ORDER BY updated_at DESC
            LIMIT 20;
            """,
            (
                user_id,
                f"%{q}%",
                f"%{q}%",
            ),
        )

        for row in cursor.fetchall():
            results.append(
                {
                    "type": "task",
                    "id": row[0],
                    "workspace_id": row[1],
                    "title": row[2],
                    "description": row[3],
                    "priority": row[4],
                    "status": row[5],
                    "deadline": row[6],
                    "created_at": row[7],
                    "updated_at": row[8],
                }
            )

        return {
            "success": True,
            "query": q,
            "count": len(results),
            "results": results,
        }

    except Exception as e:
        return {
            "success": False,
            "message": "Unable to complete search. Please try again.",
        }

    finally:
        cursor.close()
        connection.close()