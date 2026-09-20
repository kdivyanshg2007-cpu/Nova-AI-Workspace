import json

from database import get_connection
from rag_service import generate_document_embedding


def main():
    connection = None
    cursor = None

    try:
        connection = get_connection()
        cursor = connection.cursor()

        cursor.execute(
            """
            SELECT
                dc.id,
                dc.content
            FROM document_chunks dc
            LEFT JOIN document_chunk_embeddings dce
                ON dc.id = dce.chunk_id
            WHERE dce.chunk_id IS NULL
            ORDER BY dc.id;
            """
        )

        chunks = cursor.fetchall()

        print(
            "CHUNKS WITHOUT EMBEDDINGS:",
            len(chunks),
        )

        if not chunks:
            print(
                "No missing embeddings found."
            )
            return

        embedded_count = 0

        for chunk_id, content in chunks:

            print(
                f"Generating embedding for chunk_id={chunk_id}"
            )

            try:
                embedding = generate_document_embedding(
                    content
                )

                if not embedding:
                    print(
                        f"EMPTY EMBEDDING: chunk_id={chunk_id}"
                    )
                    continue

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
                    f"RAG EMBEDDING ERROR "
                    f"for chunk_id={chunk_id}:",
                    repr(embedding_error),
                )

        connection.commit()

        print(
            "TOTAL EMBEDDINGS CREATED:",
            embedded_count,
        )

    except Exception as error:

        if connection is not None:
            connection.rollback()

        print(
            "BACKFILL ERROR:",
            repr(error),
        )

        raise

    finally:

        if cursor is not None:
            cursor.close()

        if connection is not None:
            connection.close()


if __name__ == "__main__":
    main()