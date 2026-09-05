from agents.autopilot_state import (
    AutopilotExecutionState,
)


class AutopilotSummary:
    """
    Creates a human-readable final workflow summary.
    """

    def create(
        self,
        state: AutopilotExecutionState,
    ) -> dict:

        completed = 0
        failed = 0
        pending = 0

        for step in state.steps.values():

            if step.status == "completed":
                completed += 1

            elif step.status == "failed":
                failed += 1

            else:
                pending += 1

        if state.status == "completed":
            message = "Workflow completed successfully."

        elif state.status == "cancelled":
            message = "Workflow was cancelled."

        elif state.status == "failed":
            message = "Workflow failed."

        else:
            message = "Workflow is still in progress."

        return {
            "goal": state.goal,
            "status": state.status,
            "message": message,
            "completed_steps": completed,
            "failed_steps": failed,
            "pending_steps": pending,
            "total_steps": len(state.steps),
        }


def get_autopilot_summary():
    return AutopilotSummary()