from agents.agent_result import AgentResult
from agents.agent_state import AgentState
from agents.agent_logger import AgentLogger
from agents.safety import AgentSafety

from agents.research_search import ResearchSearchAdapter
from agents.research_sources import extract_sources, rank_sources
from agents.research_utils import build_research_summary
from agents.research_report import ResearchReportGenerator


class ResearchAgent:
    """
    Nova AI Research Agent.

    Flow:
    User Query
        ↓
    Safety Check
        ↓
    Web Search
        ↓
    Source Extraction
        ↓
    Source Ranking
        ↓
    Research Summary
        ↓
    Research Report
        ↓
    Structured AgentResult
    """

    def __init__(self):
        self.search_adapter = ResearchSearchAdapter()
        self.safety = AgentSafety()
        self.logger = AgentLogger()
        self.report_generator = ResearchReportGenerator()

    def run(
        self,
        query: str,
        workspace_id: int | None = None,
        user_id: int | None = None,
    ):
        query = query.strip()

        state = AgentState(
            user_id=user_id,
            workspace_id=workspace_id,
            user_query=query,
            agent_name="research",
        )

        # -----------------------------------------
        # 1. Validate query
        # -----------------------------------------

        if not query:
            error_message = "Research query cannot be empty."

            state.add_error(error_message)

            self.logger.log(
                "research_blocked",
                "research",
                {
                    "reason": error_message
                },
            )

            return AgentResult.failure_result(
                agent_name="research",
                error=error_message,
            )

        # -----------------------------------------
        # 2. Safety check
        # -----------------------------------------

        safety_result = self.safety.check_query(query)

        if not safety_result["allowed"]:
            error_message = safety_result["reason"]

            state.add_error(error_message)

            self.logger.log(
                "research_blocked",
                "research",
                {
                    "reason": error_message
                },
            )

            return AgentResult.failure_result(
                agent_name="research",
                error=error_message,
            )

        # -----------------------------------------
        # 3. Start research
        # -----------------------------------------

        state.start()

        state.add_trace(
            "research_started",
            {
                "query": query,
            },
        )

        self.logger.log(
            "research_started",
            "research",
            {
                "query": query,
                "workspace_id": workspace_id,
                "user_id": user_id,
            },
        )

        try:
            # -------------------------------------
            # 4. Web search
            # -------------------------------------

            state.add_trace(
                "research_search_started",
                {
                    "query": query,
                },
            )

            search_result = self.search_adapter.search(
                query
            )

            answer = search_result.get(
                "answer",
                "",
            )

            response = search_result.get(
                "response"
            )

            if not answer:
                raise ValueError(
                    "Research search returned an empty answer."
                )

            # -------------------------------------
            # 5. Extract sources
            # -------------------------------------

            sources = extract_sources(
                response
            )

            state.add_trace(
                "sources_extracted",
                {
                    "source_count": len(sources),
                },
            )

            # -------------------------------------
            # 6. Rank sources
            # -------------------------------------

            sources = rank_sources(
                sources,
                query,
            )

            state.add_trace(
                "sources_ranked",
                {
                    "source_count": len(sources),
                },
            )

            # -------------------------------------
            # 7. Build research summary
            # -------------------------------------

            summary = build_research_summary(
                answer,
                sources,
            )

            # -------------------------------------
            # 8. Generate research report
            # -------------------------------------

            report = self.report_generator.generate(
                query=query,
                answer=summary["summary"],
                sources=summary["citations"],
            )

            state.add_trace(
                "research_report_generated",
                {
                    "source_count": report["source_count"],
                    "key_finding_count": len(
                        report["key_findings"]
                    ),
                },
            )

            # -------------------------------------
            # 9. Save state output
            # -------------------------------------

            state.output_data = {
                "query": query,
                "summary": summary["summary"],
                "citations": summary["citations"],
                "source_count": summary["source_count"],
                "report": report,
            }

            state.add_trace(
                "research_completed",
                {
                    "source_count": summary["source_count"],
                    "report_generated": True,
                },
            )

            # -------------------------------------
            # 10. Complete state
            # -------------------------------------

            state.complete()

            # -------------------------------------
            # 11. Final logging
            # -------------------------------------

            self.logger.log(
                "research_completed",
                "research",
                {
                    "success": True,
                    "source_count": summary[
                        "source_count"
                    ],
                    "report_generated": True,
                },
            )

            # -------------------------------------
            # 12. Return structured result
            # -------------------------------------

            return AgentResult.success_result(
                agent_name="research",
                answer=summary["summary"],
                data={
                    "query": query,
                    "source_count": summary[
                        "source_count"
                    ],
                    "report": report,
                },
                sources=summary["citations"],
                confidence=0.90,
            )

        except Exception as error:
            error_message = str(error)

            state.add_error(
                error_message
            )

            state.add_trace(
                "research_failed",
                {
                    "error": error_message,
                },
            )

            self.logger.log(
                "research_failed",
                "research",
                {
                    "error": error_message,
                    "query": query,
                },
            )

            return AgentResult.failure_result(
                agent_name="research",
                error=error_message,
            )


def get_research_agent():
    return ResearchAgent()