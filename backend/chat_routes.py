from database import get_connection
from ai_service import generate_ai_response


def generate_conversation_title(message: str) -> str:
    """Generate a simple conversation title from the first user message."""

    title = " ".join(message.strip().split())

    if not title:
        return "New Chat"

    title = title.rstrip(".,!?;:")

    max_length = 45

    if len(title) > max_length:
        title = title[:max_length].rsplit(" ", 1)[0]
        title = title.rstrip(".,!?;:")

        if not title:
            title = message.strip()[:max_length].strip()

        title = f"{title}..."

    special_words = {
        "C++", "C", "C#", "HTML", "CSS", "JS", "SQL", "API", "AI", "DSA", "ML", "UI", "UX",
    }

    words = title.split()
    formatted_words = []

    for word in words:
        if word.upper() in special_words:
            formatted_words.append(word.upper())
        else:
            formatted_words.append(word.capitalize())

    title = " ".join(formatted_words)
    return title or "New Chat"


def create_chat_message(
    workspace_id: int,
    user_id: int,
    message: str,
    conversation_id: int | None = None,
    file_id: int | None = None
):
    """
    Create a user message, optionally attach a file,
    generate an AI response, and save the assistant message.
    """

    if workspace_id <= 0:
        return {"success": False, "message": "Invalid workspace_id."}

    if user_id <= 0:
        return {"success": False, "message": "Invalid user_id."}

    message = message.strip()

    if not message:
        return {"success": False, "message": "Message cannot be empty."}

    connection = get_connection()
    cursor = connection.cursor()
    attached_file = None

    try:
        if conversation_id is not None:
            cursor.execute(
                """
                SELECT id
                FROM conversations
                WHERE id = %s AND workspace_id = %s AND user_id = %s;
                """,
                (conversation_id, workspace_id, user_id),
            )

            conversation = cursor.fetchone()

            if conversation is None:
                return {"success": False, "message": "Conversation not found or access denied."}

        else:
            conversation_title = generate_conversation_title(message)
            cursor.execute(
                """
                INSERT INTO conversations (user_id, workspace_id, title)
                VALUES (%s, %s, %s)
                RETURNING id;
                """,
                (user_id, workspace_id, conversation_title),
            )
            conversation_id = cursor.fetchone()[0]

        if file_id is not None:
            if file_id <= 0:
                return {"success": False, "message": "Invalid file_id."}

            cursor.execute(
                """
                SELECT id, user_id, workspace_id, filename, file_path, mime_type, file_size
                FROM files
                WHERE id = %s AND user_id = %s;
                """,
                (file_id, user_id),
            )

            attached_file = cursor.fetchone()

            if attached_file is None:
                return {"success": False, "message": "File not found or access denied."}

            file_workspace_id = attached_file[2]
            if file_workspace_id is not None and file_workspace_id != workspace_id:
                return {"success": False, "message": "File does not belong to this workspace."}

        cursor.execute(
            "SELECT COUNT(*) FROM messages WHERE conversation_id = %s;",
            (conversation_id,),
        )
        message_count = cursor.fetchone()[0]

        if message_count == 0:
            conversation_title = generate_conversation_title(message)
            cursor.execute(
                "UPDATE conversations SET title = %s WHERE id = %s;",
                (conversation_title, conversation_id),
            )

        cursor.execute(
            """
            INSERT INTO messages (conversation_id, role, content, file_id)
            VALUES (%s, %s, %s, %s)
            RETURNING id, conversation_id, role, content, file_id, created_at;
            """,
            (conversation_id, "user", message, file_id),
        )
        user_message = cursor.fetchone()
        connection.commit()

    except Exception as e:
        connection.rollback()
        return {"success": False, "message": str(e)}
    finally:
        cursor.close()

    history_connection = None
    history_cursor = None

    try:
        history_connection = get_connection()
        history_cursor = history_connection.cursor()
        history_cursor.execute(
            """
            SELECT role, content
            FROM messages
            WHERE conversation_id = %s
            ORDER BY id DESC
            LIMIT 20;
            """,
            (conversation_id,),
        )
        history_rows = history_cursor.fetchall()
        history_rows.reverse()
        conversation_history = [
            {"role": row[0], "content": row[1]}
            for row in history_rows
        ]
    except Exception as e:
        print("HISTORY LOAD ERROR:", repr(e))
        conversation_history = []
    finally:
        if history_cursor is not None:
            history_cursor.close()
        if history_connection is not None:
            history_connection.close()

    file_path = attached_file[4] if attached_file is not None else None

    ai_response = generate_ai_response(
        message=message,
        conversation_history=conversation_history,
        file_path=file_path,
        user_id=user_id,
    )

    connection = get_connection()
    cursor = connection.cursor()

    try:
        cursor.execute(
            """
            INSERT INTO messages (conversation_id, role, content, file_id)
            VALUES (%s, %s, %s, %s)
            RETURNING id, conversation_id, role, content, file_id, created_at;
            """,
            (conversation_id, "assistant", ai_response, None),
        )
        assistant_message = cursor.fetchone()

        cursor.execute(
            """
            UPDATE conversations
            SET updated_at = CURRENT_TIMESTAMP
            WHERE id = %s;
            """,
            (conversation_id,),
        )
        connection.commit()

        return {
            "success": True,
            "conversation_id": conversation_id,
            "user_message": {
                "id": user_message[0], "conversation_id": user_message[1], "role": user_message[2],
                "content": user_message[3], "file_id": user_message[4], "created_at": user_message[5],
            },
            "assistant_message": {
                "id": assistant_message[0], "conversation_id": assistant_message[1], "role": assistant_message[2],
                "content": assistant_message[3], "file_id": assistant_message[4], "created_at": assistant_message[5],
            },
        }
    except Exception as e:
        connection.rollback()
        return {"success": False, "message": str(e)}
    finally:
        cursor.close()
        connection.close()


def get_workspace_chat_messages(workspace_id: int, user_id: int, conversation_id: int | None = None):
    """Get chat messages for a specific conversation."""
    if workspace_id <= 0:
        return {"success": False, "message": "Invalid workspace_id."}
    if user_id <= 0:
        return {"success": False, "message": "Invalid user_id."}

    connection = get_connection()
    cursor = connection.cursor()
    try:
        if conversation_id is not None:
            cursor.execute(
                """
                SELECT m.id, m.conversation_id, m.role, m.content, m.file_id, m.created_at
                FROM messages m
                JOIN conversations c ON c.id = m.conversation_id
                WHERE c.id = %s AND c.workspace_id = %s AND c.user_id = %s
                ORDER BY m.id ASC;
                """,
                (conversation_id, workspace_id, user_id),
            )
        else:
            cursor.execute(
                """
                SELECT m.id, m.conversation_id, m.role, m.content, m.file_id, m.created_at
                FROM messages m
                JOIN conversations c ON c.id = m.conversation_id
                WHERE c.workspace_id = %s AND c.user_id = %s
                ORDER BY m.id ASC;
                """,
                (workspace_id, user_id),
            )

        rows = cursor.fetchall()
        messages = [
            {"id": row[0], "conversation_id": row[1], "role": row[2], "content": row[3], "file_id": row[4], "created_at": row[5]}
            for row in rows
        ]
        return {"success": True, "messages": messages}
    except Exception as e:
        return {"success": False, "message": str(e)}
    finally:
        cursor.close()
        connection.close()


def get_user_conversations(workspace_id: int, user_id: int):
    """Get all conversations for a user's workspace."""
    if workspace_id <= 0:
        return {"success": False, "message": "Invalid workspace_id."}
    if user_id <= 0:
        return {"success": False, "message": "Invalid user_id."}

    connection = get_connection()
    cursor = connection.cursor()
    try:
        cursor.execute(
            """
            SELECT c.id, c.title, c.created_at, c.updated_at
            FROM conversations c
            WHERE c.workspace_id = %s AND c.user_id = %s
            ORDER BY c.updated_at DESC, c.id DESC;
            """,
            (workspace_id, user_id),
        )
        rows = cursor.fetchall()
        conversations = [
            {"id": row[0], "title": row[1], "created_at": row[2], "updated_at": row[3]}
            for row in rows
        ]
        return {"success": True, "conversations": conversations}
    except Exception as e:
        return {"success": False, "message": str(e)}
    finally:
        cursor.close()
        connection.close()


def create_new_conversation(workspace_id: int, user_id: int, title: str = "New Chat"):
    """Create a new conversation for a user's workspace."""
    if workspace_id <= 0:
        return {"success": False, "message": "Invalid workspace_id."}
    if user_id <= 0:
        return {"success": False, "message": "Invalid user_id."}

    title = title.strip() or "New Chat"
    connection = get_connection()
    cursor = connection.cursor()
    try:
        cursor.execute(
            """
            INSERT INTO conversations (user_id, workspace_id, title)
            VALUES (%s, %s, %s)
            RETURNING id, title, created_at, updated_at;
            """,
            (user_id, workspace_id, title),
        )
        row = cursor.fetchone()
        connection.commit()
        return {"success": True, "conversation": {"id": row[0], "title": row[1], "created_at": row[2], "updated_at": row[3]}}
    except Exception as e:
        connection.rollback()
        return {"success": False, "message": str(e)}
    finally:
        cursor.close()
        connection.close()


def rename_conversation(workspace_id: int, user_id: int, conversation_id: int, title: str):
    """Rename a user's conversation."""
    if workspace_id <= 0:
        return {"success": False, "message": "Invalid workspace_id."}
    if user_id <= 0:
        return {"success": False, "message": "Invalid user_id."}
    if conversation_id <= 0:
        return {"success": False, "message": "Invalid conversation_id."}

    title = title.strip()
    if not title:
        return {"success": False, "message": "Conversation title cannot be empty."}
    if len(title) > 100:
        return {"success": False, "message": "Conversation title is too long."}

    connection = get_connection()
    cursor = connection.cursor()
    try:
        cursor.execute(
            """
            UPDATE conversations
            SET title = %s, updated_at = CURRENT_TIMESTAMP
            WHERE id = %s AND workspace_id = %s AND user_id = %s
            RETURNING id, title, created_at, updated_at;
            """,
            (title, conversation_id, workspace_id, user_id),
        )
        row = cursor.fetchone()
        if row is None:
            connection.rollback()
            return {"success": False, "message": "Conversation not found or access denied."}
        connection.commit()
        return {"success": True, "conversation": {"id": row[0], "title": row[1], "created_at": row[2], "updated_at": row[3]}}
    except Exception as e:
        connection.rollback()
        return {"success": False, "message": str(e)}
    finally:
        cursor.close()
        connection.close()


def delete_conversation(workspace_id: int, user_id: int, conversation_id: int):
    """Delete a user's conversation and its messages."""
    if workspace_id <= 0:
        return {"success": False, "message": "Invalid workspace_id."}
    if user_id <= 0:
        return {"success": False, "message": "Invalid user_id."}
    if conversation_id <= 0:
        return {"success": False, "message": "Invalid conversation_id."}

    connection = get_connection()
    cursor = connection.cursor()
    try:
        cursor.execute(
            """
            SELECT id FROM conversations
            WHERE id = %s AND workspace_id = %s AND user_id = %s;
            """,
            (conversation_id, workspace_id, user_id),
        )
        conversation = cursor.fetchone()
        if conversation is None:
            return {"success": False, "message": "Conversation not found or access denied."}

        cursor.execute("DELETE FROM messages WHERE conversation_id = %s;", (conversation_id,))
        cursor.execute(
            """
            DELETE FROM conversations
            WHERE id = %s AND workspace_id = %s AND user_id = %s;
            """,
            (conversation_id, workspace_id, user_id),
        )
        connection.commit()
        return {"success": True, "message": "Conversation deleted successfully."}
    except Exception as e:
        connection.rollback()
        return {"success": False, "message": str(e)}
    finally:
        cursor.close()
        connection.close()
