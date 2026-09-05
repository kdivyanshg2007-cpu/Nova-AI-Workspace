from dataclasses import dataclass


@dataclass
class AgentRoute:
    """
    Describes which agent should handle a request.
    """

    agent_name: str
    reason: str
    confidence: float


class AgentRouter:
    """
    Basic rule-based router for Nova AI agents.

    Later this can be upgraded to an LLM-based router.
    """

    def __init__(self):
        self.routes = {
            "research": {
                "search",
                "research",
                "sources",
                "citation",
                "web",
                "article",
                "information",
            },
            "coding": {
                "code",
                "coding",
                "program",
                "programming",
                "debug",
                "debugging",
                "python",
                "javascript",
                "cpp",
                "c++",
                "java",
                "bug",
                "algorithm",
            },
            "study": {
                "study",
                "learn",
                "learning",
                "quiz",
                "mcq",
                "exam",
                "revision",
                "notes",
                "chapter",
                "question",
            },
            "document": {
                "document",
                "pdf",
                "file",
                "summarize",
                "summary",
                "extract",
                "explain",
                "document",
                "page",
            },
        }

    def _tokenize(self, text: str):
        return set(
            text.lower()
            .replace(",", " ")
            .replace(".", " ")
            .replace("?", " ")
            .replace("!", " ")
            .split()
        )

    def route(self, query: str) -> AgentRoute:
        """
        Select the best agent for a user query.
        """

        query = query.strip()

        if not query:
            return AgentRoute(
                agent_name="general",
                reason="Empty query",
                confidence=0.0,
            )

        query_words = self._tokenize(query)

        scores = {}

        for agent_name, keywords in self.routes.items():

            matched = query_words.intersection(
                keywords
            )

            scores[agent_name] = len(matched)

        best_agent = max(
            scores,
            key=scores.get,
        )

        best_score = scores[best_agent]

        if best_score == 0:
            return AgentRoute(
                agent_name="general",
                reason="No specialist agent matched",
                confidence=0.0,
            )

        total_words = max(
            len(query_words),
            1,
        )

        confidence = min(
            best_score / total_words * 2,
            1.0,
        )

        matched_keywords = query_words.intersection(
            self.routes[best_agent]
        )

        reason = (
            f"Matched keywords: "
            f"{', '.join(sorted(matched_keywords))}"
        )

        return AgentRoute(
            agent_name=best_agent,
            reason=reason,
            confidence=round(
                confidence,
                2,
            ),
        )


def get_agent_router():
    """
    Return a reusable AgentRouter instance.
    """
    return AgentRouter()