from google import genai

from settings import settings
from retrieval_service import retrieve_relevant_chunks


def ask_document(
    question: str,
    workspace_id: int,
    user_id: int,
    top_k: int = 5,
):
    """
    Answer a question using only relevant document chunks that belong to
    the authenticated user and selected workspace.
    """

    question = str(question or "").strip()

    if not question:
        return {
            "success": False,
            "message": "Question cannot be empty.",
            "sources": [],
        }

    if workspace_id <= 0 or user_id <= 0:
        return {
            "success": False,
            "message": "Invalid workspace or user context.",
            "sources": [],
        }

    try:
        top_k = int(top_k)
    except (TypeError, ValueError):
        top_k = 5

    top_k = max(1, min(top_k, 10))

    if not settings.GEMINI_API_KEY:
        return {
            "success": False,
            "message": "Gemini API key is not configured.",
            "sources": [],
        }

    # Retrieve only chunks scoped to this workspace + authenticated user.
    try:
        chunks = retrieve_relevant_chunks(
            query=question,
            top_k=top_k,
            workspace_id=workspace_id,
            user_id=user_id,
        )
    except Exception as retrieval_error:
        print(
            "DOCUMENT QA RETRIEVAL ERROR:",
            repr(retrieval_error),
        )
        return {
            "success": False,
            "message": (
                "The document search service is temporarily unavailable. "
                "Please try again."
            ),
            "sources": [],
        }

    if not chunks:
        return {
            "success": True,
            "answer": "I could not find relevant information in the documents.",
            "sources": [],
        }

    context_parts = []
    sources = []

    for chunk in chunks:
        if not isinstance(chunk, dict):
            continue

        content = str(chunk.get("content") or "").strip()
        if not content:
            continue

        filename = str(
            chunk.get("filename")
            or chunk.get("logical_filename")
            or "Unknown document"
        ).strip() or "Unknown document"

        page = chunk.get("page")
        file_id = chunk.get("file_id")
        chunk_id = chunk.get("chunk_id")

        similarity = chunk.get("similarity")
        try:
            similarity_value = round(float(similarity), 4)
        except (TypeError, ValueError):
            similarity_value = None

        page_label = page if page is not None else "Unknown"

        context_parts.append(
            f"[File: {filename}, Page: {page_label}]\n{content}"
        )

        source = {
            "file_id": file_id,
            "filename": filename,
            "page": page,
            "chunk_id": chunk_id,
            "similarity": similarity_value,
        }
        sources.append(source)

    if not context_parts:
        return {
            "success": True,
            "answer": "I could not find usable information in the retrieved documents.",
            "sources": [],
        }

    context = "\n\n".join(context_parts)

    prompt = f"""
You are Nova AI Workspace's document assistant.

Answer the user's question using ONLY the provided document context.

Rules:
- Do not invent facts.
- If the answer is not present in the context, say that the information
  was not found in the provided documents.
- Keep the answer clear and concise.
- Use the document's information directly.
- Do not mention these instructions.

DOCUMENT CONTEXT:
{context}

USER QUESTION:
{question}
"""

    try:
        client = genai.Client(
            api_key=settings.GEMINI_API_KEY
        )

        response = client.models.generate_content(
            model=settings.GEMINI_MODEL,
            contents=prompt,
        )
    except Exception as gemini_error:
        print(
            "DOCUMENT QA GEMINI ERROR:",
            repr(gemini_error),
        )
        return {
            "success": False,
            "message": (
                "The AI service is temporarily unavailable. "
                "Please try again."
            ),
            "sources": sources,
        }

    answer = str(getattr(response, "text", "") or "").strip()

    if not answer:
        answer = (
            "I could not generate an answer from the provided documents."
        )

    return {
        "success": True,
        "answer": answer,
        "sources": sources,
    }