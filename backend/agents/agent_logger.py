from datetime import datetime
from typing import Any


class AgentLogger:
    """
    Simple logger for Nova AI agent execution.
    """

    def __init__(self):
        self.events: list[dict[str, Any]] = []

    def log(
        self,
        event: str,
        agent_name: str | None = None,
        details: dict[str, Any] | None = None,
    ):
        entry = {
            "timestamp": datetime.utcnow().isoformat(),
            "event": event,
            "agent_name": agent_name,
            "details": details or {},
        }

        self.events.append(entry)

        print(
            f"[AGENT] {event}"
            f" | agent={agent_name}"
        )

    def get_events(self):
        return self.events.copy()

    def clear(self):
        self.events.clear()


def get_agent_logger():
    return AgentLogger()