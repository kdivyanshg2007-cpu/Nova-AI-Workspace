from dataclasses import dataclass, field
from typing import Any


@dataclass
class AutopilotStepState:
    """
    Runtime state of one Autopilot step.
    """

    step_id: int
    status: str = "pending"
    output: Any = None
    error: str | None = None
    attempts: int = 0

    def start(self):
        self.status = "running"

    def complete(self, output: Any = None):
        self.status = "completed"
        self.output = output
        self.error = None

    def fail(self, error: str):
        self.status = "failed"
        self.error = error

    def retry(self):
        self.attempts += 1
        self.status = "pending"

    def to_dict(self):
        return {
            "step_id": self.step_id,
            "status": self.status,
            "output": self.output,
            "error": self.error,
            "attempts": self.attempts,
        }


@dataclass
class AutopilotExecutionState:
    """
    Stores runtime state for an entire Autopilot plan.
    """

    goal: str
    status: str = "pending"

    current_step_id: int | None = None

    steps: dict[int, AutopilotStepState] = field(
        default_factory=dict
    )

    trace: list[dict[str, Any]] = field(
        default_factory=list
    )

    def add_step(self, step_id: int):
        self.steps[step_id] = AutopilotStepState(
            step_id=step_id
        )

    def start(self):
        self.status = "running"
        self.add_trace(
            "autopilot_started",
            {
                "goal": self.goal,
            },
        )

    def start_step(self, step_id: int):
        if step_id not in self.steps:
            self.add_step(step_id)

        self.current_step_id = step_id
        self.steps[step_id].start()

        self.add_trace(
            "step_started",
            {
                "step_id": step_id,
            },
        )

    def complete_step(
        self,
        step_id: int,
        output: Any = None,
    ):
        if step_id not in self.steps:
            self.add_step(step_id)

        self.steps[step_id].complete(output)

        self.add_trace(
            "step_completed",
            {
                "step_id": step_id,
            },
        )

    def fail_step(
        self,
        step_id: int,
        error: str,
    ):
        if step_id not in self.steps:
            self.add_step(step_id)

        self.steps[step_id].fail(error)

        self.add_trace(
            "step_failed",
            {
                "step_id": step_id,
                "error": error,
            },
        )

    def complete(self):
        self.status = "completed"

        self.add_trace(
            "autopilot_completed",
            {},
        )

    def fail(self, error: str):
        self.status = "failed"

        self.add_trace(
            "autopilot_failed",
            {
                "error": error,
            },
        )

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

    def to_dict(self):
        return {
            "goal": self.goal,
            "status": self.status,
            "current_step_id": self.current_step_id,
            "steps": {
                step_id: step.to_dict()
                for step_id, step in self.steps.items()
            },
            "trace": self.trace,
        }


def create_execution_state(
    goal: str,
    step_ids: list[int],
):
    state = AutopilotExecutionState(
        goal=goal
    )

    for step_id in step_ids:
        state.add_step(step_id)

    return state