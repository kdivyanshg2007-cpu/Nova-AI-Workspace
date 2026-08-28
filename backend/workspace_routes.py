from database import get_connection


def create_workspace(user_id: int, name: str):
    """Create a new workspace for a user."""

    if user_id <= 0:
        return {
            "success": False,
            "message": "Invalid user_id."
        }

    name = name.strip()

    if not name:
        return {
            "success": False,
            "message": "Workspace name cannot be empty."
        }

    connection = get_connection()
    cursor = connection.cursor()

    try:
        cursor.execute(
            """
            INSERT INTO workspaces (user_id, name)
            VALUES (%s, %s)
            RETURNING id, user_id, name, created_at;
            """,
            (user_id, name),
        )

        workspace = cursor.fetchone()
        connection.commit()

        return {
            "success": True,
            "workspace": {
                "id": workspace[0],
                "user_id": workspace[1],
                "name": workspace[2],
                "created_at": workspace[3],
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


def get_user_workspaces(user_id: int):
    """Get all workspaces belonging to a user."""

    if user_id <= 0:
        return {
            "success": False,
            "message": "Invalid user_id."
        }

    connection = get_connection()
    cursor = connection.cursor()

    try:
        cursor.execute(
            """
            SELECT id, user_id, name, created_at
            FROM workspaces
            WHERE user_id = %s
            ORDER BY created_at DESC;
            """,
            (user_id,),
        )

        rows = cursor.fetchall()

        workspaces = [
            {
                "id": row[0],
                "user_id": row[1],
                "name": row[2],
                "created_at": row[3],
            }
            for row in rows
        ]

        return {
            "success": True,
            "workspaces": workspaces,
        }

    except Exception as e:
        return {
            "success": False,
            "message": str(e),
        }

    finally:
        cursor.close()
        connection.close()


def verify_workspace_ownership(
    workspace_id: int,
    user_id: int
):
    """Check whether a workspace belongs to the current user."""

    if workspace_id <= 0:
        return False

    if user_id <= 0:
        return False

    connection = get_connection()
    cursor = connection.cursor()

    try:
        cursor.execute(
            """
            SELECT id
            FROM workspaces
            WHERE id = %s
              AND user_id = %s;
            """,
            (workspace_id, user_id),
        )

        workspace = cursor.fetchone()

        return workspace is not None

    except Exception:
        return False

    finally:
        cursor.close()
        connection.close()