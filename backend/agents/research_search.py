from typing import Any

from google import genai
from google.genai import types

from settings import settings


class ResearchSearchAdapter:
    """
    Search adapter for Nova AI Research Agent.

    Uses Gemini with Google Search grounding
    for web-based research.
    """

    def __init__(self):
        if not settings.GEMINI_API_KEY:
            raise ValueError(
                "Gemini API key is not configured."
            )

        self.client = genai.Client(
            api_key=settings.GEMINI_API_KEY
        )

    def search(self, query: str) -> dict[str, Any]:
        query = query.strip()

        if not query:
            raise ValueError(
                "Research query cannot be empty."
            )

        grounding_tool = types.Tool(
            google_search=types.GoogleSearch()
        )

        config = types.GenerateContentConfig(
            tools=[grounding_tool]
        )

        response = self.client.models.generate_content(
            model=settings.GEMINI_MODEL,
            contents=query,
            config=config,
        )

        answer = (response.text or "").strip()

        if not answer:
            answer = (
                "No research answer was generated."
            )

        return {
            "query": query,
            "answer": answer,
            "response": response,
        }


def get_research_search_adapter():
    return ResearchSearchAdapter()