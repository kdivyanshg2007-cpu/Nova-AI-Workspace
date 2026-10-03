from pathlib import Path
import re

import pymupdf
from docx import Document

from database import get_connection
from rag_service import embed_document_chunks


# =========================================================
# TEXT CLEANING
# =========================================================

def clean_text(text: str) -> str:
    """Clean extracted document text."""

    if not text:
        return ""

    # Normalize line endings.
    text = text.replace("\r\n", "\n")
    text = text.replace("\r", "\n")

    # Replace tabs with spaces.
    text = text.replace("\t", " ")

    # Remove trailing spaces from every line.
    lines = [
        line.strip()
        for line in text.split("\n")
    ]

    cleaned = "\n".join(lines)

    # Remove excessive blank lines.
    cleaned = re.sub(
        r"\n{3,}",
        "\n\n",
        cleaned
    )

    # Normalize multiple spaces.
    cleaned = re.sub(
        r"[ ]{2,}",
        " ",
        cleaned
    )

    return cleaned.strip()


# =========================================================
# TXT EXTRACTION
# =========================================================

def extract_txt(file_path: str) -> list[dict]:
    """Extract text from a TXT file."""

    path = Path(file_path)

    if not path.exists():
        raise FileNotFoundError(
            f"File not found: {file_path}"
        )

    text = path.read_text(
        encoding="utf-8",
        errors="replace"
    )

    text = clean_text(text)

    return [
        {
            "page": None,
            "text": text
        }
    ]


# =========================================================
# PDF EXTRACTION
# =========================================================

def extract_pdf(file_path: str) -> list[dict]:
    """Extract PDF text page by page."""

    path = Path(file_path)

    if not path.exists():
        raise FileNotFoundError(
            f"File not found: {file_path}"
        )

    pages = []

    pdf = pymupdf.open(file_path)

    try:
        for page_number, page in enumerate(
            pdf,
            start=1
        ):
            text = page.get_text("text")
            text = clean_text(text)

            if text:
                pages.append(
                    {
                        "page": page_number,
                        "text": text
                    }
                )

    finally:
        pdf.close()

    return pages


# =========================================================
# DOCX EXTRACTION
# =========================================================

def extract_docx(file_path: str) -> list[dict]:
    """Extract paragraphs from a DOCX file."""

    path = Path(file_path)

    if not path.exists():
        raise FileNotFoundError(
            f"File not found: {file_path}"
        )

    document = Document(file_path)

    paragraphs = []

    for paragraph in document.paragraphs:
        text = clean_text(
            paragraph.text
        )

        if text:
            paragraphs.append(text)

    combined_text = "\n\n".join(
        paragraphs
    )

    return [
        {
            "page": None,
            "text": combined_text
        }
    ]


# =========================================================
# GENERIC EXTRACTION
# =========================================================

def extract_text(
    file_path: str
) -> list[dict]:
    """
    Detect file type and extract text.

    Supported:
    PDF, DOCX, TXT
    """

    path = Path(file_path)

    if not path.exists():
        raise FileNotFoundError(
            f"File not found: {file_path}"
        )

    extension = path.suffix.lower()

    if extension == ".pdf":
        return extract_pdf(
            file_path
        )

    if extension == ".docx":
        return extract_docx(
            file_path
        )

    if extension == ".txt":
        return extract_txt(
            file_path
        )

    raise ValueError(
        f"Unsupported document type: {extension}"
    )


# =========================================================
# CHUNKING
# =========================================================

def create_chunks(
    pages: list[dict],
    chunk_size: int = 1000,
    overlap: int = 150
) -> list[dict]:
    """Split extracted text into overlapping chunks."""

    if chunk_size <= 0:
        raise ValueError(
            "chunk_size must be greater than 0."
        )

    if overlap < 0:
        raise ValueError(
            "overlap cannot be negative."
        )

    if overlap >= chunk_size:
        raise ValueError(
            "overlap must be smaller than chunk_size."
        )

    chunks = []

    for page_data in pages:

        page_number = page_data.get(
            "page"
        )

        text = page_data.get(
            "text",
            ""
        ).strip()

        if not text:
            continue

        start = 0

        while start < len(text):

            end = min(
                start + chunk_size,
                len(text)
            )

            chunk_text = text[
                start:end
            ].strip()

            if chunk_text:
                chunks.append(
                    {
                        "page": page_number,
                        "chunk_index": len(chunks),
                        "text": chunk_text
                    }
                )

            if end >= len(text):
                break

            start = end - overlap

    return chunks


# =========================================================
# SAVE CHUNKS TO DATABASE
# =========================================================

def save_chunks_to_database(
    file_id: int,
    workspace_id: int | None,
    chunks: list[dict]
) -> dict:
    """
    Save processed chunks using the production document schema.

    ``document_chunks`` is linked to ``documents`` through ``document_id``.
    It does not use a ``file_id`` column. The uploaded file remains the
    attachment record in ``files`` while its extracted text is represented
    by a document + RAG chunks.
    """

    if file_id <= 0:
        raise ValueError("Invalid file_id.")

    connection = get_connection()
    cursor = connection.cursor()

    try:
        cursor.execute(
            """
            SELECT
                user_id,
                workspace_id,
                filename
            FROM files
            WHERE id = %s;
            """,
            (file_id,),
        )

        file_record = cursor.fetchone()

        if file_record is None:
            raise ValueError("Uploaded file record was not found.")

        user_id = int(file_record[0])
        actual_workspace_id = (
            int(file_record[1])
            if file_record[1] is not None
            else workspace_id
        )
        filename = str(
            file_record[2] or f"document-{file_id}"
        ).strip()

        if actual_workspace_id is None or int(actual_workspace_id) <= 0:
            raise ValueError("Uploaded file has no valid workspace.")

        actual_workspace_id = int(actual_workspace_id)

        # Reconstruct the extracted document text from its chunks.
        full_text = "\n\n".join(
            str(chunk.get("text") or "").strip()
            for chunk in chunks
            if isinstance(chunk, dict)
            and str(chunk.get("text") or "").strip()
        ).strip()

        if not full_text:
            raise ValueError("No document text was extracted.")

        # Reuse the latest same-name document for this tenant so repeated
        # processing does not create unbounded duplicate document records.
        cursor.execute(
            """
            SELECT id
            FROM documents
            WHERE workspace_id = %s
              AND user_id = %s
              AND title = %s
            ORDER BY id DESC
            LIMIT 1;
            """,
            (
                actual_workspace_id,
                user_id,
                filename,
            ),
        )

        existing = cursor.fetchone()

        if existing:
            document_id = int(existing[0])

            cursor.execute(
                """
                UPDATE documents
                SET content = %s,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = %s
                  AND workspace_id = %s
                  AND user_id = %s;
                """,
                (
                    full_text,
                    document_id,
                    actual_workspace_id,
                    user_id,
                ),
            )

            cursor.execute(
                """
                DELETE FROM document_chunks
                WHERE document_id = %s
                  AND workspace_id = %s
                  AND user_id = %s;
                """,
                (
                    document_id,
                    actual_workspace_id,
                    user_id,
                ),
            )
        else:
            cursor.execute(
                """
                INSERT INTO documents (
                    workspace_id,
                    user_id,
                    title,
                    content
                )
                VALUES (%s, %s, %s, %s)
                RETURNING id;
                """,
                (
                    actual_workspace_id,
                    user_id,
                    filename,
                    full_text,
                ),
            )

            document_id = int(cursor.fetchone()[0])

        inserted_count = 0

        for chunk in chunks:
            content = str(chunk.get("text") or "").strip()

            if not content:
                continue

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
                    actual_workspace_id,
                    user_id,
                    chunk.get("chunk_index", inserted_count),
                    content,
                ),
            )

            inserted_count += 1

        if inserted_count == 0:
            raise ValueError("No non-empty document chunks were created.")

        connection.commit()

        # Generate embeddings using the canonical document embedding path.
        embedded_chunk_count = embed_document_chunks(document_id)

        if embedded_chunk_count != inserted_count:
            raise RuntimeError(
                "Document processing completed, but not all chunks received "
                "RAG embeddings."
            )

        return {
            "document_id": document_id,
            "saved_chunk_count": inserted_count,
            "embedded_chunk_count": embedded_chunk_count,
            "workspace_id": actual_workspace_id,
            "user_id": user_id,
        }

    except Exception:
        connection.rollback()
        raise

    finally:
        cursor.close()
        connection.close()


# =========================================================
# FULL DOCUMENT PROCESSING
# =========================================================

def process_document(
    file_path: str,
    file_id: int | None = None,
    filename: str | None = None,
    workspace_id: int | None = None
) -> dict:
    """
    Full document processing pipeline:

    file
    -> extraction
    -> cleaning
    -> chunking
    -> production-schema document/chunk storage
    -> RAG embedding generation
    """

    pages = extract_text(file_path)
    chunks = create_chunks(pages)

    saved_chunk_count = 0
    embedded_chunk_count = 0
    document_id = None

    if file_id is not None:
        storage_result = save_chunks_to_database(
            file_id=file_id,
            workspace_id=workspace_id,
            chunks=chunks,
        )

        document_id = storage_result["document_id"]
        saved_chunk_count = storage_result["saved_chunk_count"]
        embedded_chunk_count = storage_result["embedded_chunk_count"]

    return {
        "file_id": file_id,
        "document_id": document_id,
        "filename": filename or Path(file_path).name,
        "pages": pages,
        "chunks": chunks,
        "page_count": len(pages),
        "chunk_count": len(chunks),
        "saved_chunk_count": saved_chunk_count,
        "embedded_chunk_count": embedded_chunk_count,
        "success": True,
    }

