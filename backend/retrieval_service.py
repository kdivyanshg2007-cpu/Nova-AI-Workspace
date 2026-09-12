import json
import math
import re

from database import get_connection
from embedding_service import generate_embedding


def cosine_similarity(vector_a, vector_b):
    if not vector_a or not vector_b:
        return 0.0

    if len(vector_a) != len(vector_b):
        return 0.0

    dot_product = sum(
        a * b for a, b in zip(vector_a, vector_b)
    )

    magnitude_a = math.sqrt(
        sum(a * a for a in vector_a)
    )

    magnitude_b = math.sqrt(
        sum(b * b for b in vector_b)
    )

    if magnitude_a == 0 or magnitude_b == 0:
        return 0.0

    return dot_product / (magnitude_a * magnitude_b)


def normalize_filename(filename):
    if not filename:
        return "unknown"

    filename = filename.strip()

    filename = re.sub(
        r"\s*\(\d+\)(?=\.[^.]+$)",
        "",
        filename,
    )

    return filename.lower()


def normalize_content(content):
    if not content:
        return ""

    content = content.lower()
    content = re.sub(r"\s+", " ", content)
    content = re.sub(r"[^a-z0-9\s]", "", content)

    return content.strip()


def tokenize(text):
    if not text:
        return set()

    return set(
        re.findall(
            r"\b[a-zA-Z0-9]+\b",
            text.lower(),
        )
    )


def lexical_score(query, content, filename=""):
    query_words = tokenize(query)

    if not query_words:
        return 0.0

    document_words = tokenize(
        f"{filename} {content}"
    )

    matched_words = query_words.intersection(
        document_words
    )

    return len(matched_words) / len(query_words)


def detect_query_intent(query):
    words = tokenize(query)

    progress_words = {
        "completed",
        "complete",
        "progress",
        "implemented",
        "implementation",
        "finished",
        "done",
        "current",
        "status",
        "built",
        "working",
        "developed",
        "achieved",
        "so",
        "far",
    }

    roadmap_words = {
        "roadmap",
        "plan",
        "planned",
        "days",
        "schedule",
        "future",
    }

    assignment_words = {
        "assignment",
        "python",
        "question",
        "operator",
        "precedence",
    }

    if words.intersection(progress_words):
        return "progress"

    if words.intersection(roadmap_words):
        return "roadmap"

    if words.intersection(assignment_words):
        return "assignment"

    return "general"


def intent_score(filename, intent):
    filename = filename.lower()

    if intent == "progress":
        if (
            "progress" in filename
            or "conversation" in filename
        ):
            return 1.0

    if intent == "roadmap":
        if "roadmap" in filename:
            return 1.0

    if intent == "assignment":
        if "assignment" in filename:
            return 1.0

    return 0.0


def retrieve_relevant_chunks(
    query: str,
    top_k: int = 5,
    workspace_id: int | None = None,
):
    query = query.strip()

    if not query:
        return []

    if workspace_id is None:
        return []

    query_embedding = generate_embedding(query)

    print(
        "QUERY EMBEDDING DIMENSION:",
        len(query_embedding),
    )

    intent = detect_query_intent(query)

    connection = get_connection()

    try:
        cursor = connection.cursor()

        cursor.execute(
            """
            SELECT
                dc.id,
                dc.page,
                dc.chunk_index,
                dc.content,
                dce.embedding,
                d.title
            FROM document_chunks dc
            INNER JOIN documents d
                ON dc.document_id = d.id
            INNER JOIN document_chunk_embeddings dce
                ON dc.id = dce.chunk_id
            WHERE dc.workspace_id = %s
              AND d.workspace_id = %s
            ORDER BY dc.id ASC;
            """,
            (
                workspace_id,
                workspace_id,
            ),
        )

        rows = cursor.fetchall()

        print(
            "RETRIEVAL ROW COUNT:",
            len(rows),
        )

        if not rows:
            return []

        candidates = []

        for row in rows:
            chunk_id = row[0]
            page = row[1]
            chunk_index = row[2]
            content = row[3]
            stored_embedding = row[4]
            filename = row[5] or "unknown"

            try:
                if isinstance(
                    stored_embedding,
                    str,
                ):
                    stored_embedding = json.loads(
                        stored_embedding
                    )

                semantic_score = cosine_similarity(
                    query_embedding,
                    stored_embedding,
                )

            except Exception as embedding_error:
                print(
                    "STORED EMBEDDING ERROR:",
                    repr(embedding_error),
                )

                semantic_score = 0.0

            keyword_score = lexical_score(
                query,
                content,
                filename,
            )

            file_intent_score = intent_score(
                filename,
                intent,
            )

            combined_score = (
                semantic_score * 0.55
                + keyword_score * 0.20
                + file_intent_score * 0.25
            )

            candidates.append(
                {
                    "chunk_id": chunk_id,
                    "file_id": None,
                    "filename": filename,
                    "logical_filename": normalize_filename(
                        filename
                    ),
                    "page": page,
                    "chunk_index": chunk_index,
                    "content": content,
                    "similarity": combined_score,
                    "semantic_similarity": semantic_score,
                    "keyword_similarity": keyword_score,
                    "intent_score": file_intent_score,
                }
            )

        # --------------------------------------------------
        # Remove exact duplicate chunks
        # --------------------------------------------------

        unique_chunks = []
        seen_chunks = set()

        for item in candidates:
            content_key = normalize_content(
                item["content"]
            )

            duplicate_key = (
                item["logical_filename"],
                content_key,
            )

            if duplicate_key in seen_chunks:
                continue

            seen_chunks.add(duplicate_key)
            unique_chunks.append(item)

        # --------------------------------------------------
        # Group chunks by logical document
        # --------------------------------------------------

        documents = {}

        for item in unique_chunks:
            logical_name = item["logical_filename"]

            if logical_name not in documents:
                documents[logical_name] = []

            documents[logical_name].append(item)

        # --------------------------------------------------
        # Score documents
        # --------------------------------------------------

        ranked_documents = []

        for logical_name, chunks in documents.items():

            chunks.sort(
                key=lambda item: item["similarity"],
                reverse=True,
            )

            strongest_chunks = chunks[:5]

            best_score = strongest_chunks[0]["similarity"]

            average_score = (
                sum(
                    item["similarity"]
                    for item in strongest_chunks
                )
                / len(strongest_chunks)
            )

            document_score = (
                best_score * 0.70
                + average_score * 0.30
            )

            document_intent = intent_score(
                logical_name,
                intent,
            )

            document_score += (
                document_intent * 0.25
            )

            ranked_documents.append(
                {
                    "logical_filename": logical_name,
                    "document_score": document_score,
                    "chunks": chunks,
                }
            )

        ranked_documents.sort(
            key=lambda item: item["document_score"],
            reverse=True,
        )

        # --------------------------------------------------
        # Progress questions
        # --------------------------------------------------

        if intent == "progress":

            progress_docs = []
            other_docs = []

            for document in ranked_documents:

                name = document["logical_filename"]

                if (
                    "conversation" in name
                    or "progress" in name
                ):
                    progress_docs.append(document)
                else:
                    other_docs.append(document)

            ranked_documents = (
                progress_docs + other_docs
            )

        # --------------------------------------------------
        # First pass:
        # one best chunk from each document
        # --------------------------------------------------

        final_results = []

        for document in ranked_documents:

            if not document["chunks"]:
                continue

            best_chunk = document["chunks"][0]

            final_results.append(best_chunk)

            if len(final_results) >= top_k:
                break

        # --------------------------------------------------
        # Second pass:
        # additional chunks
        # --------------------------------------------------

        if len(final_results) < top_k:

            for document in ranked_documents:

                for chunk in document["chunks"][1:]:

                    already_added = any(
                        result["chunk_id"]
                        == chunk["chunk_id"]
                        for result in final_results
                    )

                    if already_added:
                        continue

                    final_results.append(chunk)

                    if len(final_results) >= top_k:
                        break

                if len(final_results) >= top_k:
                    break

        print(
            "FINAL RETRIEVAL RESULT COUNT:",
            len(final_results),
        )

        return final_results[:top_k]

    finally:
        cursor.close()
        connection.close()


def build_context(
    query: str,
    top_k: int = 5,
    workspace_id: int | None = None,
):
    results = retrieve_relevant_chunks(
        query=query,
        top_k=top_k,
        workspace_id=workspace_id,
    )

    context_parts = []

    for result in results:
        context_parts.append(
            f"[File: {result['filename']}, "
            f"Page: {result['page']}]\n"
            f"{result['content']}"
        )

    return "\n\n".join(context_parts)