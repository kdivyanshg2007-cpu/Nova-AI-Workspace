from database import get_connection
from embedding_storage import save_embeddings_for_chunks


def get_document_chunks():
    """
    Fetch all document chunks that do not have embeddings yet.
    """

    connection = get_connection()

    try:
        cursor = connection.cursor()

        cursor.execute(
            """
            SELECT dc.id, dc.content
            FROM document_chunks dc
            LEFT JOIN document_chunk_embeddings dce
                ON dc.id = dce.chunk_id
            WHERE dce.chunk_id IS NULL
            ORDER BY dc.id
            """
        )

        rows = cursor.fetchall()

        return [
            {
                "id": row[0],
                "content": row[1],
            }
            for row in rows
        ]

    finally:
        cursor.close()
        connection.close()


def generate_all_embeddings():
    """
    Generate embeddings for all chunks
    that do not already have embeddings.
    """

    chunks = get_document_chunks()

    if not chunks:
        print("No new chunks found.")
        return 0

    print(
        f"Found {len(chunks)} chunks without embeddings."
    )

    saved_count = save_embeddings_for_chunks(chunks)

    print(
        f"Successfully saved {saved_count} embeddings."
    )

    return saved_count


if __name__ == "__main__":
    generate_all_embeddings()