from google import genai
from google.genai.types import EmbedContentConfig

from settings import settings


# =========================================================
# EMBEDDING SERVICE
# =========================================================

EMBEDDING_MODEL = "gemini-embedding-001"
EMBEDDING_DIMENSION = 768


def generate_embedding(text: str) -> list[float]:
    """
    Generate a 768-dimensional embedding vector for text.
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
            contents=text,
            config=EmbedContentConfig(
                task_type="RETRIEVAL_QUERY",
                output_dimensionality=EMBEDDING_DIMENSION,
            ),
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

        values = [
            float(value)
            for value in embedding.values
        ]

        if len(values) != EMBEDDING_DIMENSION:
            raise RuntimeError(
                f"Unexpected embedding dimension: "
                f"{len(values)}. "
                f"Expected {EMBEDDING_DIMENSION}."
            )

        return values

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
    Generate 768-dimensional embeddings for multiple texts.
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
            contents=cleaned_texts,
            config=EmbedContentConfig(
                task_type="RETRIEVAL_DOCUMENT",
                output_dimensionality=EMBEDDING_DIMENSION,
            ),
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

            values = [
                float(value)
                for value in embedding.values
            ]

            if len(values) != EMBEDDING_DIMENSION:
                raise RuntimeError(
                    f"Unexpected embedding dimension: "
                    f"{len(values)}. "
                    f"Expected {EMBEDDING_DIMENSION}."
                )

            embeddings.append(values)

        return embeddings

    except Exception as e:

        print(
            "BATCH EMBEDDING ERROR:",
            repr(e)
        )

        raise