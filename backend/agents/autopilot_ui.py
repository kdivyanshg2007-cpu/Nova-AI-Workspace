from typing import Any

from agents.autopilot_state import AutopilotExecutionState


class AutopilotUIFormatter:
    """
    Formats workflow execution state for the frontend.
    """

    def format_step(self, step) -> dict[str, Any]:
        return {
            "step_id": step.step_id,
            "status": step.status,
            "output": step.output,
            "error": step.error,
            "attempts": step.attempts,
        }

    def format_state(
        self,
        state: AutopilotExecutionState,
    ) -> dict[str, Any]:

        steps = [
            self.format_step(step)
            for step in state.steps.values()
        ]

        completed = sum(
            1
            for step in state.steps.values()
            if step.status == "completed"
        )

        total = len(state.steps)

        progress = (
            round((completed / total) * 100)
            if total
            else 0
        )

        return {
            "goal": state.goal,
            "status": state.status,
            "current_step_id": state.current_step_id,
            "progress": progress,
            "completed_steps": completed,
            "total_steps": total,
            "steps": steps,
            "trace": state.trace,
        }


def get_autopilot_ui_formatter():
    return AutopilotUIFormatter()