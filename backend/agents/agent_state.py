from dataclasses import dataclass, field
from typing import Any


@dataclass
class AgentState:
    """
    Stores the current state of an agent execution.
    """

    user_id: int | None = None
    workspace_id: int | None = None

    user_query: str = ""

    agent_name: str | None = None
    status: str = "pending"

    input_data: dict[str, Any] = field(default_factory=dict)
    output_data: dict[str, Any] = field(default_factory=dict)

    errors: list[str] = field(default_factory=list)
    trace: list[dict[str, Any]] = field(default_factory=list)

    retry_count: int = 0
    max_retries: int = 3

    def add_trace(
        self,
        event: str,
        details: dict[str, Any] | None = None,
    ):
        self.trace.append(
            {
                "event": event,
                "details": details or {},
            }
        )

    def add_error(self, message: str):
        self.errors.append(message)
        self.status = "failed"

    def is_failed(self) -> bool:
        return self.status == "failed"

    def is_completed(self) -> bool:
        return self.status == "completed"

    def can_retry(self) -> bool:
        return self.retry_count < self.max_retries

    def increment_retry(self):
        self.retry_count += 1

    def complete(self):
        self.status = "completed"

    def start(self):
        self.status = "running"