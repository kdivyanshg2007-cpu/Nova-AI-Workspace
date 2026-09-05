from typing import Any


class ResearchReportGenerator:
    """
    Converts a research answer and its sources
    into a structured research report.
    """

    def generate(
        self,
        query: str,
        answer: str,
        sources: list[dict[str, Any]] | None = None,
    ) -> dict[str, Any]:

        query = query.strip()
        answer = answer.strip()
        sources = sources or []

        if not query:
            raise ValueError(
                "Research query cannot be empty."
            )

        if not answer:
            raise ValueError(
                "Research answer cannot be empty."
            )

        title = self._build_title(query)
        summary = self._build_summary(answer)
        key_findings = self._build_key_findings(answer)

        citations = []

        for index, source in enumerate(
            sources,
            start=1,
        ):
            if not source:
                continue

            url = str(
                source.get("url", "")
            ).strip()

            if not url:
                continue

            citations.append(
                {
                    "id": index,
                    "title": (
                        source.get(
                            "title",
                            "Web Source",
                        )
                        or "Web Source"
                    ),
                    "url": url,
                    "source_type": (
                        source.get(
                            "source_type",
                            "web",
                        )
                        or "web"
                    ),
                }
            )

        return {
            "title": title,
            "query": query,
            "summary": summary,
            "key_findings": key_findings,
            "citations": citations,
            "source_count": len(citations),
        }

    def _build_title(
        self,
        query: str,
    ) -> str:
        return f"Research Report: {query}"

    def _build_summary(
        self,
        answer: str,
    ) -> str:
        return answer

    def _build_key_findings(
        self,
        answer: str,
    ) -> list[str]:

        sentences = [
            sentence.strip()
            for sentence in answer.replace(
                "\n",
                " ",
            ).split(".")
            if sentence.strip()
        ]

        return sentences[:5]


def get_research_report_generator():
    return ResearchReportGenerator()