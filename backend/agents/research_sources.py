from typing import Any


def extract_sources(response: Any) -> list[dict]:
    """
    Extract web sources from Gemini grounding metadata.
    """

    sources = []

    if response is None:
        return sources

    try:
        candidates = getattr(
            response,
            "candidates",
            None,
        )

        if not candidates:
            return sources

        candidate = candidates[0]

        grounding_metadata = getattr(
            candidate,
            "grounding_metadata",
            None,
        )

        if not grounding_metadata:
            return sources

        grounding_chunks = getattr(
            grounding_metadata,
            "grounding_chunks",
            None,
        )

        if not grounding_chunks:
            return sources

        for chunk in grounding_chunks:

            web = getattr(
                chunk,
                "web",
                None,
            )

            if not web:
                continue

            title = getattr(
                web,
                "title",
                None,
            )

            url = getattr(
                web,
                "uri",
                None,
            )

            if not url:
                continue

            sources.append(
                {
                    "title": title or "Web Source",
                    "url": url,
                }
            )

    except Exception:
        return []

    return deduplicate_sources(sources)


def deduplicate_sources(
    sources: list[dict],
) -> list[dict]:
    """
    Remove duplicate sources using URL.
    """

    unique_sources = []
    seen_urls = set()

    for source in sources:

        url = source.get("url", "").strip()

        if not url:
            continue

        if url in seen_urls:
            continue

        seen_urls.add(url)

        unique_sources.append(
            {
                "title": source.get(
                    "title",
                    "Web Source",
                ),
                "url": url,
            }
        )

    return unique_sources


def rank_sources(
    sources: list[dict],
    query: str,
) -> list[dict]:
    """
    Rank sources using simple query/title overlap.
    """

    if not sources:
        return []

    query_words = {
        word.lower()
        for word in query.split()
        if word.strip()
    }

    ranked = []

    for source in sources:

        title = source.get(
            "title",
            "",
        ).lower()

        score = sum(
            1
            for word in query_words
            if word in title
        )

        ranked.append(
            (
                score,
                source,
            )
        )

    ranked.sort(
        key=lambda item: item[0],
        reverse=True,
    )

    return [
        source
        for _, source in ranked
    ]