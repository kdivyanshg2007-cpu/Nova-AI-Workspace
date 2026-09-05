import re


def clean_research_text(text: str) -> str:
    """
    Clean whitespace and basic formatting noise
    from research output.
    """

    if not text:
        return ""

    text = text.strip()

    # Replace multiple spaces/newlines with one space.
    text = re.sub(
        r"\s+",
        " ",
        text,
    )

    return text


def build_citation(
    title: str,
    url: str,
    source_type: str = "web",
) -> dict:
    """
    Create a standard citation object.
    """

    return {
        "title": title or "Web Source",
        "url": url,
        "source_type": source_type,
    }


def build_research_summary(
    answer: str,
    sources: list[dict],
) -> dict:
    """
    Build a structured research summary
    with standardized citations.
    """

    cleaned_answer = clean_research_text(
        answer
    )

    citations = []

    for source in sources:
        url = source.get(
            "url",
            "",
        ).strip()

        if not url:
            continue

        citations.append(
            build_citation(
                title=source.get(
                    "title",
                    "Web Source",
                ),
                url=url,
            )
        )

    return {
        "summary": cleaned_answer,
        "citations": citations,
        "source_count": len(citations),
    }