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
            INSERT INTO workspaces (
                user_id,
                name,
                is_archived
            )
            VALUES (%s, %s, FALSE)
            RETURNING id, user_id, name, created_at, is_archived;
            """,
            (
                user_id,
                name,
            ),
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
                "is_archived": workspace[4],
            },
        }

    except Exception:
        connection.rollback()

        return {
            "success": False,
            "message": "Unable to create workspace. Please try again.",
        }

    finally:
        cursor.close()
        connection.close()


def get_user_workspaces(
    user_id: int,
    include_archived: bool = False
):
    """Get all workspaces belonging to a user."""

    if user_id <= 0:
        return {
            "success": False,
            "message": "Invalid user_id."
        }

    connection = get_connection()
    cursor = connection.cursor()

    try:
        if include_archived:
            cursor.execute(
                """
                SELECT
                    id,
                    user_id,
                    name,
                    created_at,
                    is_archived
                FROM workspaces
                WHERE user_id = %s
                ORDER BY created_at DESC;
                """,
                (user_id,),
            )
        else:
            cursor.execute(
                """
                SELECT
                    id,
                    user_id,
                    name,
                    created_at,
                    is_archived
                FROM workspaces
                WHERE user_id = %s
                  AND is_archived = FALSE
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
                "is_archived": row[4],
            }
            for row in rows
        ]

        return {
            "success": True,
            "workspaces": workspaces,
        }

    except Exception:
        return {
            "success": False,
            "message": "Unable to load workspaces. Please try again.",
        }

    finally:
        cursor.close()
        connection.close()


def verify_workspace_ownership(
    workspace_id: int,
    user_id: int
):
    """Check whether an active workspace belongs to the current user."""

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
              AND user_id = %s
              AND is_archived = FALSE;
            """,
            (
                workspace_id,
                user_id,
            ),
        )

        workspace = cursor.fetchone()

        return workspace is not None

    except Exception:
        return False

    finally:
        cursor.close()
        connection.close()


def rename_workspace(
    workspace_id: int,
    user_id: int,
    name: str
):
    """Rename an active workspace owned by the current user."""

    if workspace_id <= 0:
        return {
            "success": False,
            "message": "Invalid workspace_id."
        }

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
            UPDATE workspaces
            SET name = %s
            WHERE id = %s
              AND user_id = %s
              AND is_archived = FALSE
            RETURNING
                id,
                user_id,
                name,
                created_at,
                is_archived;
            """,
            (
                name,
                workspace_id,
                user_id,
            ),
        )

        workspace = cursor.fetchone()

        if workspace is None:
            connection.rollback()

            return {
                "success": False,
                "message": (
                    "Workspace not found, archived, "
                    "or access denied."
                )
            }

        connection.commit()

        return {
            "success": True,
            "workspace": {
                "id": workspace[0],
                "user_id": workspace[1],
                "name": workspace[2],
                "created_at": workspace[3],
                "is_archived": workspace[4],
            },
        }

    except Exception:
        connection.rollback()

        return {
            "success": False,
            "message": "Unable to rename workspace. Please try again.",
        }

    finally:
        cursor.close()
        connection.close()


def archive_workspace(
    workspace_id: int,
    user_id: int
):
    """Archive an active workspace."""

    if workspace_id <= 0:
        return {
            "success": False,
            "message": "Invalid workspace_id."
        }

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
            UPDATE workspaces
            SET is_archived = TRUE
            WHERE id = %s
              AND user_id = %s
              AND is_archived = FALSE
            RETURNING
                id,
                user_id,
                name,
                created_at,
                is_archived;
            """,
            (
                workspace_id,
                user_id,
            ),
        )

        workspace = cursor.fetchone()

        if workspace is None:
            connection.rollback()

            return {
                "success": False,
                "message": (
                    "Workspace not found, "
                    "already archived, or access denied."
                ),
            }

        connection.commit()

        return {
            "success": True,
            "message": "Workspace archived successfully.",
            "workspace": {
                "id": workspace[0],
                "user_id": workspace[1],
                "name": workspace[2],
                "created_at": workspace[3],
                "is_archived": workspace[4],
            },
        }

    except Exception:
        connection.rollback()

        return {
            "success": False,
            "message": "Unable to archive workspace. Please try again.",
        }

    finally:
        cursor.close()
        connection.close()


def unarchive_workspace(
    workspace_id: int,
    user_id: int
):
    """Restore an archived workspace."""

    if workspace_id <= 0:
        return {
            "success": False,
            "message": "Invalid workspace_id."
        }

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
            UPDATE workspaces
            SET is_archived = FALSE
            WHERE id = %s
              AND user_id = %s
              AND is_archived = TRUE
            RETURNING
                id,
                user_id,
                name,
                created_at,
                is_archived;
            """,
            (
                workspace_id,
                user_id,
            ),
        )

        workspace = cursor.fetchone()

        if workspace is None:
            connection.rollback()

            return {
                "success": False,
                "message": (
                    "Archived workspace not found "
                    "or access denied."
                ),
            }

        connection.commit()

        return {
            "success": True,
            "message": "Workspace restored successfully.",
            "workspace": {
                "id": workspace[0],
                "user_id": workspace[1],
                "name": workspace[2],
                "created_at": workspace[3],
                "is_archived": workspace[4],
            },
        }

    except Exception:
        connection.rollback()

        return {
            "success": False,
            "message": "Unable to restore workspace. Please try again.",
        }

    finally:
        cursor.close()
        connection.close()


def delete_workspace(
    workspace_id: int,
    user_id: int
):
    """Delete a workspace owned by the current user."""

    if workspace_id <= 0:
        return {
            "success": False,
            "message": "Invalid workspace_id."
        }

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
            DELETE FROM workspaces
            WHERE id = %s
              AND user_id = %s
            RETURNING
                id,
                name,
                is_archived;
            """,
            (
                workspace_id,
                user_id,
            ),
        )

        workspace = cursor.fetchone()

        if workspace is None:
            connection.rollback()

            return {
                "success": False,
                "message": "Workspace not found or access denied."
            }

        connection.commit()

        return {
            "success": True,
            "message": "Workspace deleted successfully.",
            "workspace": {
                "id": workspace[0],
                "name": workspace[1],
                "is_archived": workspace[2],
            },
        }

    except Exception:
        connection.rollback()

        return {
            "success": False,
            "message": "Unable to delete workspace. Please try again.",
        }

    finally:
        cursor.close()
        connection.close()