from pathlib import Path
import re

import pymupdf
from docx import Document

from database import get_connection


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
) -> int:
    """
    Save processed chunks into document_chunks table.
    """

    if file_id <= 0:
        raise ValueError(
            "Invalid file_id."
        )

    connection = get_connection()
    cursor = connection.cursor()

    inserted_count = 0

    try:

        # Delete previous chunks for this file.
        cursor.execute(
            """
            DELETE FROM document_chunks
            WHERE file_id = %s;
            """,
            (file_id,)
        )

        for chunk in chunks:

            content = (
                chunk.get("text", "")
                .strip()
            )

            if not content:
                continue

            cursor.execute(
                """
                INSERT INTO document_chunks (
                    file_id,
                    workspace_id,
                    page,
                    chunk_index,
                    content
                )
                VALUES (
                    %s,
                    %s,
                    %s,
                    %s,
                    %s
                );
                """,
                (
                    file_id,
                    workspace_id,
                    chunk.get("page"),
                    chunk.get(
                        "chunk_index",
                        inserted_count
                    ),
                    content,
                )
            )

            inserted_count += 1

        connection.commit()

        return inserted_count

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
    -> database storage
    """

    # Extract text.
    pages = extract_text(
        file_path
    )

    # Create chunks.
    chunks = create_chunks(
        pages
    )

    # Save chunks to PostgreSQL.
    saved_chunk_count = 0

    if file_id is not None:
        saved_chunk_count = save_chunks_to_database(
            file_id=file_id,
            workspace_id=workspace_id,
            chunks=chunks
        )

    return {
        "file_id": file_id,
        "filename": (
            filename
            or Path(file_path).name
        ),
        "pages": pages,
        "chunks": chunks,
        "page_count": len(pages),
        "chunk_count": len(chunks),
        "saved_chunk_count": saved_chunk_count,
        "success": True
    }