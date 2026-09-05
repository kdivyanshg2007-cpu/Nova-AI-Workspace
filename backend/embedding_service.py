from google import genai

from settings import settings


# =========================================================
# EMBEDDING SERVICE
# =========================================================

EMBEDDING_MODEL = "gemini-embedding-001"


def generate_embedding(text: str) -> list[float]:
    """
    Generate an embedding vector for a single text chunk.
    """

    text = text.strip()

    if not text:
        raise ValueError(
            "Text cannot be empty."
        )

    if not settings.GEMINI_API_KEY:
        raise ValueError(
            "Gemini API key is not configured."
        )

    try:
        client = genai.Client(
            api_key=settings.GEMINI_API_KEY
        )

        response = client.models.embed_content(
            model=EMBEDDING_MODEL,
            contents=text
        )

        if not response.embeddings:
            raise RuntimeError(
                "Gemini returned no embedding."
            )

        embedding = response.embeddings[0]

        if not embedding.values:
            raise RuntimeError(
                "Gemini returned an empty embedding vector."
            )

        return list(
            embedding.values
        )

    except Exception as e:
        print(
            "EMBEDDING ERROR:",
            repr(e)
        )

        raise


def generate_embeddings(
    texts: list[str]
) -> list[list[float]]:
    """
    Generate embeddings for multiple text chunks.
    """

    if not texts:
        return []

    cleaned_texts = [
        text.strip()
        for text in texts
        if text and text.strip()
    ]

    if not cleaned_texts:
        return []

    if not settings.GEMINI_API_KEY:
        raise ValueError(
            "Gemini API key is not configured."
        )

    try:
        client = genai.Client(
            api_key=settings.GEMINI_API_KEY
        )

        response = client.models.embed_content(
            model=EMBEDDING_MODEL,
            contents=cleaned_texts
        )

        if not response.embeddings:
            raise RuntimeError(
                "Gemini returned no embeddings."
            )

        embeddings = []

        for embedding in response.embeddings:

            if not embedding.values:
                raise RuntimeError(
                    "Gemini returned an empty embedding."
                )

            embeddings.append(
                list(embedding.values)
            )

        return embeddings

    except Exception as e:

        print(
            "BATCH EMBEDDING ERROR:",
            repr(e)
        )

        raise