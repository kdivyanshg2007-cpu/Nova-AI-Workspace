from database import get_connection


def create_document(
    workspace_id: int,
    user_id: int,
    title: str,
    content: str
):
    """Create a document inside a workspace."""

    connection = get_connection()
    cursor = connection.cursor()

    try:
        cursor.execute(
            """
            INSERT INTO documents (workspace_id, user_id, title, content)
            VALUES (%s, %s, %s, %s)
            RETURNING id, workspace_id, user_id, title, content, created_at;
            """,
            (workspace_id, user_id, title, content),
        )

        document = cursor.fetchone()
        connection.commit()

        return {
            "success": True,
            "document": {
                "id": document[0],
                "workspace_id": document[1],
                "user_id": document[2],
                "title": document[3],
                "content": document[4],
                "created_at": document[5],
            },
        }

    except Exception as e:
        connection.rollback()

        return {
            "success": False,
            "message": str(e),
        }

    finally:
        cursor.close()
        connection.close()


def get_workspace_documents(
    workspace_id: int,
    user_id: int
):
    """Get all documents belonging to a workspace."""

    connection = get_connection()
    cursor = connection.cursor()

    try:
        cursor.execute(
            """
            SELECT id, workspace_id, user_id, title, content, created_at
            FROM documents
            WHERE workspace_id = %s
              AND user_id = %s
            ORDER BY created_at DESC;
            """,
            (workspace_id, user_id),
        )

        rows = cursor.fetchall()

        documents = [
            {
                "id": row[0],
                "workspace_id": row[1],
                "user_id": row[2],
                "title": row[3],
                "content": row[4],
                "created_at": row[5],
            }
            for row in rows
        ]

        return {
            "success": True,
            "documents": documents,
        }

    except Exception as e:
        return {
            "success": False,
            "message": str(e),
        }

    finally:
        cursor.close()
        connection.close()