from copy import deepcopy
from typing import Any

from agents.autopilot_state import (
    AutopilotExecutionState,
)


class WorkflowRecoveryManager:
    """
    Handles workflow recovery operations:

    - retry failed steps
    - cancel workflow
    - resume from checkpoint/state
    """

    def retry_step(
        self,
        state: AutopilotExecutionState,
        step_id: int,
    ):
        step = state.steps.get(step_id)

        if step is None:
            raise ValueError(
                f"Step {step_id} not found."
            )

        step.retry()

        state.add_trace(
            "step_retry_requested",
            {
                "step_id": step_id,
            },
        )

        return step

    def cancel_workflow(
        self,
        state: AutopilotExecutionState,
        reason: str = "Cancelled by user",
    ):

        state.status = "cancelled"

        state.add_trace(
            "workflow_cancelled",
            {
                "reason": reason,
            },
        )

        return state

    def resume_workflow(
        self,
        state: AutopilotExecutionState,
    ):

        if state.status == "cancelled":
            state.status = "running"

            state.add_trace(
                "workflow_resumed",
                {},
            )

        elif state.status == "failed":
            state.status = "running"

            state.add_trace(
                "workflow_resumed",
                {},
            )

        return state

    def create_recovery_snapshot(
        self,
        state: AutopilotExecutionState,
    ) -> AutopilotExecutionState:

        return deepcopy(state)


def get_workflow_recovery_manager():
    return WorkflowRecoveryManager()