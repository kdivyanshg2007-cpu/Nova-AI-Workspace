from dataclasses import dataclass, field
from typing import Any


@dataclass
class AgentResult:
    """
    Standard output format for all Nova agents.
    """

    success: bool
    agent_name: str

    answer: str = ""

    data: dict[str, Any] = field(
        default_factory=dict
    )

    sources: list[dict[str, Any]] = field(
        default_factory=list
    )

    error: str | None = None

    confidence: float = 0.0

    def to_dict(self):
        return {
            "success": self.success,
            "agent_name": self.agent_name,
            "answer": self.answer,
            "data": self.data,
            "sources": self.sources,
            "error": self.error,
            "confidence": self.confidence,
        }

    @classmethod
    def success_result(
        cls,
        agent_name: str,
        answer: str,
        data: dict[str, Any] | None = None,
        sources: list[dict[str, Any]] | None = None,
        confidence: float = 1.0,
    ):
        return cls(
            success=True,
            agent_name=agent_name,
            answer=answer,
            data=data or {},
            sources=sources or [],
            confidence=confidence,
        )

    @classmethod
    def failure_result(
        cls,
        agent_name: str,
        error: str,
    ):
        return cls(
            success=False,
            agent_name=agent_name,
            error=error,
            confidence=0.0,
        )