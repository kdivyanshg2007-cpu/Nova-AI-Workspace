import json

from database import get_connection
from embedding_service import generate_embedding


def save_chunk_embedding(chunk_id: int, content: str):
    """
    Generate an embedding for one document chunk
    and save it into PostgreSQL.
    """

    embedding = generate_embedding(content)

    connection = get_connection()

    try:
        cursor = connection.cursor()

        cursor.execute(
            """
            INSERT INTO document_chunk_embeddings
                (chunk_id, embedding)
            VALUES (%s, %s)
            ON CONFLICT (chunk_id)
            DO UPDATE SET
                embedding = EXCLUDED.embedding
            """,
            (
                chunk_id,
                json.dumps(embedding),
            ),
        )

        connection.commit()

    finally:
        cursor.close()
        connection.close()


def save_embeddings_for_chunks(chunks):
    """
    Generate and save embeddings for multiple chunks.

    Expected format:

    [
        {
            "id": 1,
            "content": "some text"
        }
    ]
    """

    if not chunks:
        return 0

    connection = get_connection()

    try:
        cursor = connection.cursor()

        saved_count = 0

        for chunk in chunks:

            chunk_id = chunk["id"]
            content = chunk["content"]

            embedding = generate_embedding(content)

            cursor.execute(
                """
                INSERT INTO document_chunk_embeddings
                    (chunk_id, embedding)
                VALUES (%s, %s)
                ON CONFLICT (chunk_id)
                DO UPDATE SET
                    embedding = EXCLUDED.embedding
                """,
                (
                    chunk_id,
                    json.dumps(embedding),
                ),
            )

            saved_count += 1

        connection.commit()

        return saved_count

    finally:
        cursor.close()
        connection.close()