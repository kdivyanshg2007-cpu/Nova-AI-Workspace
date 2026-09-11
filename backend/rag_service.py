from google import genai
from google.genai.types import EmbedContentConfig, HttpOptions

from database import get_connection
from settings import settings


# =========================================================
# RAG EMBEDDING CONFIGURATION
# =========================================================

EMBEDDING_MODEL = "gemini-embedding-001"
EMBEDDING_DIMENSION = 768


# =========================================================
# GEMINI CLIENT
# =========================================================

def get_gemini_client():
    """Create and return the Gemini client."""

    api_key = str(
        settings.GEMINI_API_KEY or ""
    ).strip()

    if not api_key:
        raise RuntimeError(
            "Gemini API key is not configured."
        )

    return genai.Client(
        api_key=api_key,
        http_options=HttpOptions(
            api_version="v1beta"
        ),
    )


# =========================================================
# GENERATE DOCUMENT EMBEDDING
# =========================================================

def generate_document_embedding(
    text: str,
) -> list[float]:
    """
    Generate an embedding for a document chunk.

    Uses RETRIEVAL_DOCUMENT because this text
    belongs to a stored document.
    """

    text = str(text or "").strip()

    if not text:
        return []

    client = get_gemini_client()

    response = client.models.embed_content(
        model=EMBEDDING_MODEL,
        contents=text,
        config=EmbedContentConfig(
            task_type="RETRIEVAL_DOCUMENT",
            output_dimensionality=EMBEDDING_DIMENSION,
        ),
    )

    if not response.embeddings:
        raise RuntimeError(
            "Gemini returned no embedding."
        )

    embedding = response.embeddings[0].values

    if not embedding:
        raise RuntimeError(
            "Gemini returned an empty embedding."
        )

    embedding = [
        float(value)
        for value in embedding
    ]

    if len(embedding) != EMBEDDING_DIMENSION:
        raise RuntimeError(
            f"Unexpected embedding dimension: "
            f"{len(embedding)}. "
            f"Expected {EMBEDDING_DIMENSION}."
        )

    return embedding


# =========================================================
# CONVERT EMBEDDING TO PGVECTOR FORMAT
# =========================================================

def embedding_to_pgvector(
    embedding: list[float],
) -> str:
    """
    Convert a Python list into PostgreSQL pgvector format.
    """

    if not embedding:
        raise ValueError(
            "Embedding cannot be empty."
        )

    return (
        "["
        + ",".join(
            str(float(value))
            for value in embedding
        )
        + "]"
    )


# =========================================================
# SAVE EMBEDDING FOR A CHUNK
# =========================================================

def save_chunk_embedding(
    chunk_id: int,
    embedding: list[float],
) -> None:
    """
    Save one chunk's embedding into PostgreSQL.
    """

    if chunk_id <= 0:
        raise ValueError(
            "Invalid document chunk ID."
        )

    if len(embedding) != EMBEDDING_DIMENSION:
        raise ValueError(
            f"Embedding must contain "
            f"{EMBEDDING_DIMENSION} values."
        )

    vector_value = embedding_to_pgvector(
        embedding
    )

    connection = None
    cursor = None

    try:
        connection = get_connection()
        cursor = connection.cursor()

        cursor.execute(
            """
            UPDATE document_chunks
            SET embedding = %s::vector
            WHERE id = %s;
            """,
            (
                vector_value,
                chunk_id,
            ),
        )

        connection.commit()

    except Exception:
        if connection is not None:
            connection.rollback()

        raise

    finally:
        if cursor is not None:
            cursor.close()

        if connection is not None:
            connection.close()


# =========================================================
# EMBED ALL CHUNKS OF A DOCUMENT
# =========================================================

def embed_document_chunks(
    document_id: int,
) -> int:
    """
    Generate and save embeddings for all chunks
    belonging to one document.

    Returns:
        Number of successfully embedded chunks.
    """

    if document_id <= 0:
        return 0

    connection = None
    cursor = None

    try:
        connection = get_connection()
        cursor = connection.cursor()

        cursor.execute(
            """
            SELECT id, content
            FROM document_chunks
            WHERE document_id = %s
            AND embedding IS NULL
            ORDER BY chunk_index ASC;
            """,
            (document_id,),
        )

        chunks = cursor.fetchall()

        embedded_count = 0

        for chunk_id, content in chunks:

            try:
                embedding = generate_document_embedding(
                    content
                )

                vector_value = embedding_to_pgvector(
                    embedding
                )

                cursor.execute(
                    """
                    UPDATE document_chunks
                    SET embedding = %s::vector
                    WHERE id = %s;
                    """,
                    (
                        vector_value,
                        chunk_id,
                    ),
                )

                embedded_count += 1

                print(
                    f"RAG EMBEDDING CREATED: "
                    f"chunk_id={chunk_id}"
                )

            except Exception as embedding_error:

                print(
                    "RAG EMBEDDING ERROR:",
                    repr(embedding_error),
                )

        connection.commit()

        return embedded_count

    except Exception:
        if connection is not None:
            connection.rollback()

        raise

    finally:
        if cursor is not None:
            cursor.close()

        if connection is not None:
            connection.close()


# =========================================================
# GENERATE QUERY EMBEDDING
# =========================================================

def generate_query_embedding(
    query: str,
) -> list[float]:
    """
    Generate an embedding for a user's search query.

    Uses RETRIEVAL_QUERY because this text
    represents a search/question.
    """

    query = str(query or "").strip()

    if not query:
        return []

    client = get_gemini_client()

    response = client.models.embed_content(
        model=EMBEDDING_MODEL,
        contents=query,
        config=EmbedContentConfig(
            task_type="RETRIEVAL_QUERY",
            output_dimensionality=EMBEDDING_DIMENSION,
        ),
    )

    if not response.embeddings:
        raise RuntimeError(
            "Gemini returned no query embedding."
        )

    embedding = response.embeddings[0].values

    if not embedding:
        raise RuntimeError(
            "Gemini returned an empty query embedding."
        )

    embedding = [
        float(value)
        for value in embedding
    ]

    if len(embedding) != EMBEDDING_DIMENSION:
        raise RuntimeError(
            f"Unexpected query embedding dimension: "
            f"{len(embedding)}. "
            f"Expected {EMBEDDING_DIMENSION}."
        )

    return embedding


# =========================================================
# VECTOR SEARCH
# =========================================================

def search_similar_chunks(
    workspace_id: int,
    user_id: int,
    query: str,
    limit: int = 5,
) -> list[dict]:
    """
    Search document chunks using vector similarity.
    """

    if workspace_id <= 0:
        return []

    if user_id <= 0:
        return []

    query = str(query or "").strip()

    if not query:
        return []

    limit = max(
        1,
        min(limit, 20),
    )

    query_embedding = generate_query_embedding(
        query
    )

    if not query_embedding:
        return []

    query_vector = embedding_to_pgvector(
        query_embedding
    )

    connection = None
    cursor = None

    try:
        connection = get_connection()
        cursor = connection.cursor()

        cursor.execute(
            """
            SELECT
                dc.id,
                dc.document_id,
                dc.chunk_index,
                dc.content,
                dc.embedding <=> %s::vector AS distance
            FROM document_chunks dc
            WHERE dc.workspace_id = %s
            AND dc.user_id = %s
            AND dc.embedding IS NOT NULL
            ORDER BY dc.embedding <=> %s::vector
            LIMIT %s;
            """,
            (
                query_vector,
                workspace_id,
                user_id,
                query_vector,
                limit,
            ),
        )

        rows = cursor.fetchall()

        return [
            {
                "chunk_id": row[0],
                "document_id": row[1],
                "chunk_index": row[2],
                "content": row[3],
                "distance": float(row[4]),
            }
            for row in rows
        ]

    finally:
        if cursor is not None:
            cursor.close()

        if connection is not None:
            connection.close()