from database import get_connection

from rag_service import embed_document_chunks


# =========================================================
# RAG — DOCUMENT CHUNKING
# =========================================================

CHUNK_SIZE = 1000
CHUNK_OVERLAP = 200


def split_text_into_chunks(
    text: str,
    chunk_size: int = CHUNK_SIZE,
    chunk_overlap: int = CHUNK_OVERLAP
) -> list[str]:
    """Split document text into overlapping chunks for RAG."""

    text = text.strip()

    if not text:
        return []

    if chunk_size <= 0:
        chunk_size = CHUNK_SIZE

    if chunk_overlap < 0:
        chunk_overlap = 0

    if chunk_overlap >= chunk_size:
        chunk_overlap = chunk_size // 5

    chunks = []

    start = 0
    text_length = len(text)

    while start < text_length:
        end = min(start + chunk_size, text_length)

        chunk = text[start:end].strip()

        if chunk:
            chunks.append(chunk)

        if end >= text_length:
            break

        start = end - chunk_overlap

    return chunks


def create_document_chunks(
    document_id: int,
    workspace_id: int,
    user_id: int,
    content: str,
    cursor
):
    """Create and store RAG chunks for a document."""

    chunks = split_text_into_chunks(content)

    for chunk_index, chunk_content in enumerate(chunks):
        cursor.execute(
            """
            INSERT INTO document_chunks (
                document_id,
                workspace_id,
                user_id,
                chunk_index,
                content
            )
            VALUES (%s, %s, %s, %s, %s);
            """,
            (
                document_id,
                workspace_id,
                user_id,
                chunk_index,
                chunk_content,
            ),
        )

    return len(chunks)


def recreate_document_chunks(
    document_id: int,
    workspace_id: int,
    user_id: int,
    content: str,
    cursor
):
    """Delete old chunks and create fresh chunks after document update."""

    cursor.execute(
        """
        DELETE FROM document_chunks
        WHERE document_id = %s
          AND workspace_id = %s
          AND user_id = %s;
        """,
        (
            document_id,
            workspace_id,
            user_id,
        ),
    )

    return create_document_chunks(
        document_id=document_id,
        workspace_id=workspace_id,
        user_id=user_id,
        content=content,
        cursor=cursor,
    )


# =========================================================
# DOCUMENT CRUD
# =========================================================


def create_document(
    workspace_id: int,
    user_id: int,
    title: str,
    content: str
):
    """Create a document and generate RAG chunks + embeddings."""

    if workspace_id <= 0:
        return {
            "success": False,
            "message": "Invalid workspace_id."
        }

    title = title.strip()
    content = content.strip()

    if not title:
        return {
            "success": False,
            "message": "Document title cannot be empty."
        }

    if not content:
        return {
            "success": False,
            "message": "Document content cannot be empty."
        }

    connection = get_connection()
    cursor = connection.cursor()

    try:
        # =====================================================
        # CREATE DOCUMENT
        # =====================================================

        cursor.execute(
            """
            INSERT INTO documents (
                workspace_id,
                user_id,
                title,
                content
            )
            VALUES (%s, %s, %s, %s)
            RETURNING
                id,
                workspace_id,
                user_id,
                title,
                content,
                created_at,
                updated_at;
            """,
            (
                workspace_id,
                user_id,
                title,
                content,
            ),
        )

        document = cursor.fetchone()

        # =====================================================
        # CREATE RAG CHUNKS
        # =====================================================

        chunk_count = create_document_chunks(
            document_id=document[0],
            workspace_id=document[1],
            user_id=document[2],
            content=document[4],
            cursor=cursor,
        )

        # Save the document + chunks first.
        connection.commit()

        # =====================================================
        # GENERATE EMBEDDINGS
        # =====================================================

        try:
            embedded_chunk_count = embed_document_chunks(
                document_id=document[0]
            )
        except Exception as embedding_error:
            print(
                "RAG EMBEDDING ERROR:",
                repr(embedding_error),
            )

            embedded_chunk_count = 0

        return {
            "success": True,
            "document": {
                "id": document[0],
                "workspace_id": document[1],
                "user_id": document[2],
                "title": document[3],
                "content": document[4],
                "created_at": document[5],
                "updated_at": document[6],
            },
            "chunk_count": chunk_count,
            "embedded_chunk_count": embedded_chunk_count,
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
    user_id: int,
    page: int = 1,
    limit: int = 10
):
    """Get documents with pagination."""

    if workspace_id <= 0:
        return {
            "success": False,
            "message": "Invalid workspace_id."
        }

    if page < 1:
        page = 1

    if limit < 1:
        limit = 10

    if limit > 100:
        limit = 100

    offset = (page - 1) * limit

    connection = get_connection()
    cursor = connection.cursor()

    try:
        cursor.execute(
            """
            SELECT
                id,
                workspace_id,
                user_id,
                title,
                content,
                created_at,
                updated_at
            FROM documents
            WHERE workspace_id = %s
              AND user_id = %s
            ORDER BY created_at DESC
            LIMIT %s
            OFFSET %s;
            """,
            (
                workspace_id,
                user_id,
                limit,
                offset,
            ),
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
                "updated_at": row[6],
            }
            for row in rows
        ]

        return {
            "success": True,
            "page": page,
            "limit": limit,
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


def update_document(
    document_id: int,
    user_id: int,
    title: str,
    content: str
):
    """Update a document and recreate RAG chunks + embeddings."""

    if document_id <= 0:
        return {
            "success": False,
            "message": "Invalid document_id."
        }

    title = title.strip()
    content = content.strip()

    if not title:
        return {
            "success": False,
            "message": "Document title cannot be empty."
        }

    if not content:
        return {
            "success": False,
            "message": "Document content cannot be empty."
        }

    connection = get_connection()
    cursor = connection.cursor()

    try:
        # =====================================================
        # UPDATE DOCUMENT
        # =====================================================

        cursor.execute(
            """
            UPDATE documents
            SET
                title = %s,
                content = %s,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = %s
              AND user_id = %s
            RETURNING
                id,
                workspace_id,
                user_id,
                title,
                content,
                created_at,
                updated_at;
            """,
            (
                title,
                content,
                document_id,
                user_id,
            ),
        )

        document = cursor.fetchone()

        if document is None:
            connection.rollback()

            return {
                "success": False,
                "message": "Document not found or access denied.",
            }

        # =====================================================
        # RECREATE RAG CHUNKS
        # =====================================================

        chunk_count = recreate_document_chunks(
            document_id=document[0],
            workspace_id=document[1],
            user_id=document[2],
            content=document[4],
            cursor=cursor,
        )

        # Save updated document + fresh chunks.
        connection.commit()

        # =====================================================
        # GENERATE NEW EMBEDDINGS
        # =====================================================

        try:
            embedded_chunk_count = embed_document_chunks(
                document_id=document[0]
            )
        except Exception as embedding_error:
            print(
                "RAG EMBEDDING ERROR:",
                repr(embedding_error),
            )

            embedded_chunk_count = 0

        return {
            "success": True,
            "document": {
                "id": document[0],
                "workspace_id": document[1],
                "user_id": document[2],
                "title": document[3],
                "content": document[4],
                "created_at": document[5],
                "updated_at": document[6],
            },
            "chunk_count": chunk_count,
            "embedded_chunk_count": embedded_chunk_count,
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


def delete_document(
    document_id: int,
    user_id: int
):
    """Delete a document owned by the current user."""

    if document_id <= 0:
        return {
            "success": False,
            "message": "Invalid document_id."
        }

    connection = get_connection()
    cursor = connection.cursor()

    try:
        cursor.execute(
            """
            DELETE FROM documents
            WHERE id = %s
              AND user_id = %s
            RETURNING id;
            """,
            (
                document_id,
                user_id,
            ),
        )

        deleted_document = cursor.fetchone()

        if deleted_document is None:
            connection.rollback()

            return {
                "success": False,
                "message": "Document not found or access denied.",
            }

        connection.commit()

        return {
            "success": True,
            "message": "Document deleted successfully.",
            "document_id": deleted_document[0],
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


def get_document(
    document_id: int,
    user_id: int
):
    """Get a single document owned by the current user."""

    if document_id <= 0:
        return {
            "success": False,
            "message": "Invalid document_id."
        }

    connection = get_connection()
    cursor = connection.cursor()

    try:
        cursor.execute(
            """
            SELECT
                id,
                workspace_id,
                user_id,
                title,
                content,
                created_at,
                updated_at
            FROM documents
            WHERE id = %s
              AND user_id = %s;
            """,
            (
                document_id,
                user_id,
            ),
        )

        document = cursor.fetchone()

        if document is None:
            return {
                "success": False,
                "message": "Document not found or access denied.",
            }

        return {
            "success": True,
            "document": {
                "id": document[0],
                "workspace_id": document[1],
                "user_id": document[2],
                "title": document[3],
                "content": document[4],
                "created_at": document[5],
                "updated_at": document[6],
            },
        }

    except Exception as e:
        return {
            "success": False,
            "message": str(e),
        }

    finally:
        cursor.close()
        connection.close()


def search_documents(
    workspace_id: int,
    user_id: int,
    query: str
):
    """Search documents by title or content inside a workspace."""

    if workspace_id <= 0:
        return {
            "success": False,
            "message": "Invalid workspace_id."
        }

    query = query.strip()

    if not query:
        return {
            "success": False,
            "message": "Search query cannot be empty."
        }

    connection = get_connection()
    cursor = connection.cursor()

    try:
        search_pattern = f"%{query}%"

        cursor.execute(
            """
            SELECT
                id,
                workspace_id,
                user_id,
                title,
                content,
                created_at,
                updated_at
            FROM documents
            WHERE workspace_id = %s
              AND user_id = %s
              AND (
                  title ILIKE %s
                  OR content ILIKE %s
              )
            ORDER BY created_at DESC;
            """,
            (
                workspace_id,
                user_id,
                search_pattern,
                search_pattern,
            ),
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
                "updated_at": row[6],
            }
            for row in rows
        ]

        return {
            "success": True,
            "query": query,
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