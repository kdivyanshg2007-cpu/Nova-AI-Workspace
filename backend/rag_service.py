import json
import math

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

    Kept for compatibility with other project code.
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
    Save one chunk's embedding into:

        document_chunk_embeddings

    The embedding is stored as JSON.
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

    embedding_json = json.dumps(
        [
            float(value)
            for value in embedding
        ]
    )

    connection = None
    cursor = None

    try:
        connection = get_connection()
        cursor = connection.cursor()

        cursor.execute(
            """
            INSERT INTO document_chunk_embeddings
                (chunk_id, embedding)
            VALUES
                (%s, %s)
            ON CONFLICT (chunk_id)
            DO UPDATE SET
                embedding = EXCLUDED.embedding;
            """,
            (
                chunk_id,
                embedding_json,
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

    Embeddings are stored in:
        document_chunk_embeddings

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

        # -----------------------------------------------------
        # Find chunks that do not already have an embedding.
        # -----------------------------------------------------

        cursor.execute(
            """
            SELECT
                dc.id,
                dc.content
            FROM document_chunks dc
            LEFT JOIN document_chunk_embeddings dce
                ON dc.id = dce.chunk_id
            WHERE dc.document_id = %s
              AND dce.chunk_id IS NULL
            ORDER BY dc.chunk_index ASC;
            """,
            (document_id,),
        )

        chunks = cursor.fetchall()

        embedded_count = 0

        # -----------------------------------------------------
        # Generate and store embeddings.
        # -----------------------------------------------------

        for chunk_id, content in chunks:

            try:
                embedding = generate_document_embedding(
                    content
                )

                if not embedding:
                    continue

                if len(embedding) != EMBEDDING_DIMENSION:
                    raise RuntimeError(
                        f"Unexpected embedding dimension: "
                        f"{len(embedding)}. "
                        f"Expected {EMBEDDING_DIMENSION}."
                    )

                embedding_json = json.dumps(
                    [
                        float(value)
                        for value in embedding
                    ]
                )

                cursor.execute(
                    """
                    INSERT INTO document_chunk_embeddings
                        (chunk_id, embedding)
                    VALUES
                        (%s, %s)
                    ON CONFLICT (chunk_id)
                    DO UPDATE SET
                        embedding = EXCLUDED.embedding;
                    """,
                    (
                        chunk_id,
                        embedding_json,
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

        print(
            "RAG EMBEDDING TOTAL:",
            embedded_count,
        )

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
    Search document chunks using stored embeddings.

    Embeddings are read from:
        document_chunk_embeddings

    Document/chunk data are read from:
        document_chunks
        files

    Similarity is calculated in Python using cosine similarity.
    """

    # ---------------------------------------------------------
    # BASIC VALIDATION
    # ---------------------------------------------------------

    if workspace_id <= 0:
        return []

    if user_id <= 0:
        return []

    query = str(
        query or ""
    ).strip()

    if not query:
        return []

    limit = max(
        1,
        min(
            int(limit),
            20,
        ),
    )

    # ---------------------------------------------------------
    # GENERATE QUERY EMBEDDING
    # ---------------------------------------------------------

    try:
        query_embedding = generate_query_embedding(
            query
        )

    except Exception as embedding_error:
        print(
            "RAG QUERY EMBEDDING ERROR:",
            repr(embedding_error),
        )
        return []

    if not query_embedding:
        print(
            "RAG SEARCH: query embedding not generated"
        )
        return []

    # ---------------------------------------------------------
    # QUERY VECTOR NORMALIZATION
    # ---------------------------------------------------------

    try:
        query_embedding = [
            float(value)
            for value in query_embedding
        ]

    except Exception as conversion_error:
        print(
            "RAG QUERY EMBEDDING CONVERSION ERROR:",
            repr(conversion_error),
        )
        return []

    query_norm = math.sqrt(
        sum(
            value * value
            for value in query_embedding
        )
    )

    if query_norm == 0:
        print(
            "RAG SEARCH: query embedding norm is zero"
        )
        return []

    connection = None
    cursor = None

    try:
        connection = get_connection()
        cursor = connection.cursor()

        # -----------------------------------------------------
        # GET CHUNKS + STORED EMBEDDINGS
        # -----------------------------------------------------

        cursor.execute(
            """
            SELECT
                dc.id,
                dc.document_id,
                dc.file_id,
                dc.workspace_id,
                dc.chunk_index,
                dc.page,
                dc.content,
                dce.embedding,
                f.filename
            FROM document_chunks dc
            INNER JOIN document_chunk_embeddings dce
                ON dc.id = dce.chunk_id
            INNER JOIN files f
                ON dc.file_id = f.id
            WHERE dc.workspace_id = %s
              AND f.user_id = %s
              AND dce.embedding IS NOT NULL
            """,
            (
                workspace_id,
                user_id,
            ),
        )

        rows = cursor.fetchall()

        print(
            "RAG SEARCH: embedded chunks found =",
            len(rows),
        )

        if not rows:
            return []

        # -----------------------------------------------------
        # CALCULATE COSINE SIMILARITY
        # -----------------------------------------------------

        results = []

        for row in rows:

            chunk_id = row[0]
            document_id = row[1]
            file_id = row[2]
            stored_workspace_id = row[3]
            chunk_index = row[4]
            page = row[5]
            content = row[6]
            stored_embedding = row[7]
            filename = row[8]

            if not stored_embedding:
                continue

            try:
                # -------------------------------------------------
                # Convert stored JSON/string to Python list.
                # -------------------------------------------------

                if isinstance(
                    stored_embedding,
                    str,
                ):
                    stored_embedding = json.loads(
                        stored_embedding
                    )

                stored_embedding = [
                    float(value)
                    for value in stored_embedding
                ]

                # -------------------------------------------------
                # Dimension check
                # -------------------------------------------------

                if (
                    len(stored_embedding)
                    != len(query_embedding)
                ):
                    print(
                        "RAG SEARCH: embedding dimension mismatch "
                        f"for chunk_id={chunk_id}"
                    )
                    continue

                stored_norm = math.sqrt(
                    sum(
                        value * value
                        for value in stored_embedding
                    )
                )

                if stored_norm == 0:
                    continue

                # -------------------------------------------------
                # Dot product
                # -------------------------------------------------

                dot_product = sum(
                    query_value * document_value
                    for query_value, document_value in zip(
                        query_embedding,
                        stored_embedding,
                    )
                )

                # -------------------------------------------------
                # Cosine similarity
                # -------------------------------------------------

                similarity = (
                    dot_product
                    / (
                        query_norm
                        * stored_norm
                    )
                )

                # -------------------------------------------------
                # Cosine distance
                # -------------------------------------------------

                distance = 1.0 - similarity

            except Exception as embedding_error:

                print(
                    "RAG EMBEDDING PARSE ERROR:",
                    repr(embedding_error),
                )

                continue

            results.append(
                {
                    "chunk_id": chunk_id,
                    "document_id": document_id,
                    "file_id": file_id,
                    "workspace_id": stored_workspace_id,
                    "chunk_index": chunk_index,
                    "page": page,
                    "filename": filename,
                    "content": content,
                    "similarity": similarity,
                    "distance": distance,
                }
            )

        # -----------------------------------------------------
        # SORT BY HIGHEST SIMILARITY
        # -----------------------------------------------------

        results.sort(
            key=lambda item: item["similarity"],
            reverse=True,
        )

        # -----------------------------------------------------
        # TOP RESULTS
        # -----------------------------------------------------

        final_results = results[:limit]

        print(
            "RAG SEARCH: returning",
            len(final_results),
            "chunks",
        )

        for index, item in enumerate(
            final_results,
            start=1,
        ):
            print(
                f"RAG RESULT {index}:",
                f"chunk_id={item['chunk_id']}",
                f"document_id={item['document_id']}",
                f"similarity={item['similarity']:.4f}",
            )

        return final_results

    except Exception as error:

        print(
            "RAG SEARCH ERROR:",
            repr(error),
        )

        return []

    finally:

        if cursor is not None:
            cursor.close()

        if connection is not None:
            connection.close()