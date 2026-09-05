from pathlib import Path
from typing import Any


class ResearchExportService:
    """
    Export Nova AI research reports into text files.
    """

    def export_txt(
        self,
        report: dict[str, Any],
        output_dir: str = "generated/research",
    ) -> str:

        if not report:
            raise ValueError(
                "Research report cannot be empty."
            )

        output_path = Path(output_dir)
        output_path.mkdir(
            parents=True,
            exist_ok=True,
        )

        query = str(
            report.get(
                "query",
                "research_report",
            )
        ).strip()

        safe_name = "".join(
            character
            if character.isalnum()
            else "_"
            for character in query
        ).strip("_")

        if not safe_name:
            safe_name = "research_report"

        file_path = (
            output_path
            / f"{safe_name}.txt"
        )

        lines = []

        lines.append(
            report.get(
                "title",
                "Nova AI Research Report",
            )
        )

        lines.append("")
        lines.append(
            f"Query: {query}"
        )

        lines.append("")
        lines.append("SUMMARY")
        lines.append("-------")
        lines.append(
            report.get(
                "summary",
                "",
            )
        )

        lines.append("")
        lines.append("KEY FINDINGS")
        lines.append("------------")

        key_findings = report.get(
            "key_findings",
            [],
        )

        for index, finding in enumerate(
            key_findings,
            start=1,
        ):
            lines.append(
                f"{index}. {finding}"
            )

        lines.append("")
        lines.append("SOURCES & CITATIONS")
        lines.append("-------------------")

        citations = report.get(
            "citations",
            [],
        )

        for citation in citations:
            citation_id = citation.get(
                "id",
                "",
            )

            title = citation.get(
                "title",
                "Web Source",
            )

            url = citation.get(
                "url",
                "",
            )

            source_type = citation.get(
                "source_type",
                "web",
            )

            lines.append(
                f"[{citation_id}] {title}"
            )

            lines.append(
                f"Type: {source_type}"
            )

            if url:
                lines.append(
                    f"URL: {url}"
                )

            lines.append("")

        file_path.write_text(
            "\n".join(lines),
            encoding="utf-8",
        )

        return str(file_path)


def get_research_export_service():
    return ResearchExportService()