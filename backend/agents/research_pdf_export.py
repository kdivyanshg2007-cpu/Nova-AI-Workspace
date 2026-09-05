from pathlib import Path
from typing import Any

from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    ListFlowable,
    ListItem,
)
from reportlab.lib.enums import TA_CENTER


class ResearchPDFExportService:
    """
    Export Nova AI research reports as PDF files.
    """

    def export_pdf(
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
            / f"{safe_name}_research_report.pdf"
        )

        document = SimpleDocTemplate(
            str(file_path),
            pagesize=A4,
            rightMargin=40,
            leftMargin=40,
            topMargin=40,
            bottomMargin=40,
        )

        styles = getSampleStyleSheet()

        title_style = ParagraphStyle(
            "ResearchTitle",
            parent=styles["Title"],
            alignment=TA_CENTER,
            spaceAfter=18,
        )

        heading_style = ParagraphStyle(
            "ResearchHeading",
            parent=styles["Heading2"],
            spaceBefore=14,
            spaceAfter=8,
        )

        body_style = ParagraphStyle(
            "ResearchBody",
            parent=styles["BodyText"],
            leading=17,
            spaceAfter=8,
        )

        story = []

        # Title
        story.append(
            Paragraph(
                report.get(
                    "title",
                    "Nova AI Research Report",
                ),
                title_style,
            )
        )

        # Query
        story.append(
            Paragraph(
                "Query",
                heading_style,
            )
        )

        story.append(
            Paragraph(
                query,
                body_style,
            )
        )

        # Summary
        story.append(
            Paragraph(
                "Summary",
                heading_style,
            )
        )

        summary = str(
            report.get(
                "summary",
                "",
            )
        )

        story.append(
            Paragraph(
                summary.replace(
                    "\n",
                    "<br/>",
                ),
                body_style,
            )
        )

        # Key Findings
        story.append(
            Paragraph(
                "Key Findings",
                heading_style,
            )
        )

        key_findings = report.get(
            "key_findings",
            [],
        )

        if key_findings:
            finding_items = []

            for finding in key_findings:
                finding_items.append(
                    ListItem(
                        Paragraph(
                            str(finding),
                            body_style,
                        )
                    )
                )

            story.append(
                ListFlowable(
                    finding_items,
                    bulletType="bullet",
                    leftIndent=20,
                )
            )
        else:
            story.append(
                Paragraph(
                    "No key findings available.",
                    body_style,
                )
            )

        # Sources
        story.append(
            Paragraph(
                "Sources & Citations",
                heading_style,
            )
        )

        citations = report.get(
            "citations",
            [],
        )

        if citations:

            for citation in citations:

                citation_id = citation.get(
                    "id",
                    "",
                )

                title = citation.get(
                    "title",
                    "Web Source",
                )

                source_type = citation.get(
                    "source_type",
                    "web",
                )

                url = citation.get(
                    "url",
                    "",
                )

                story.append(
                    Paragraph(
                        f"[{citation_id}] {title}",
                        body_style,
                    )
                )

                story.append(
                    Paragraph(
                        f"Type: {source_type}",
                        body_style,
                    )
                )

                if url:
                    story.append(
                        Paragraph(
                            f"URL: {url}",
                            body_style,
                        )
                    )

                story.append(
                    Spacer(
                        1,
                        6,
                    )
                )

        else:
            story.append(
                Paragraph(
                    "No sources available.",
                    body_style,
                )
            )

        document.build(story)

        return str(file_path)


def get_research_pdf_export_service():
    return ResearchPDFExportService()