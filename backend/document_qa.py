from google import genai

from settings import settings
from retrieval_service import retrieve_relevant_chunks


def ask_document(
    question: str,
    workspace_id: int,
    top_k: int = 5,
):
    """
    Answer a question using relevant document chunks
    from the selected workspace.
    """

    question = question.strip()

    if not question:
        raise ValueError("Question cannot be empty.")

    if not settings.GEMINI_API_KEY:
        raise ValueError("Gemini API key is not configured.")

    # Retrieve relevant chunks
    chunks = retrieve_relevant_chunks(
        query=question,
        top_k=top_k,
        workspace_id=workspace_id,
    )

    if not chunks:
        return {
            "answer": "I could not find relevant information in the documents.",
            "sources": [],
        }

    # Build grounded context
    context_parts = []

    sources = []

    for chunk in chunks:
        context_parts.append(
            f"[File: {chunk['filename']}, "
            f"Page: {chunk['page']}]\n"
            f"{chunk['content']}"
        )

        sources.append(
            {
                "file_id": chunk["file_id"],
                "filename": chunk["filename"],
                "page": chunk["page"],
                "chunk_id": chunk["chunk_id"],
                "similarity": round(chunk["similarity"], 4),
            }
        )

    context = "\n\n".join(context_parts)

    # Grounded prompt
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

    client = genai.Client(
        api_key=settings.GEMINI_API_KEY
    )

    response = client.models.generate_content(
        model=settings.GEMINI_MODEL,
        contents=prompt,
    )

    answer = (response.text or "").strip()

    if not answer:
        answer = (
            "I could not generate an answer from the provided documents."
        )

    return {
        "answer": answer,
        "sources": sources,
    }