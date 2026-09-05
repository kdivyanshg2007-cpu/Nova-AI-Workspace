from typing import Any


class WorkflowApprovalManager:
    """
    Handles approval decisions for workflow steps.

    Decisions:
    - approve
    - reject
    - edit
    """

    VALID_DECISIONS = {
        "approve",
        "reject",
        "edit",
    }

    def __init__(self):
        self.decisions: dict[int, dict[str, Any]] = {}

    def request_approval(
        self,
        step_id: int,
        reason: str = "",
    ) -> dict[str, Any]:
        """
        Create an approval request.
        """

        request = {
            "step_id": step_id,
            "reason": reason,
            "status": "pending",
        }

        self.decisions[step_id] = request

        return request

    def approve(
        self,
        step_id: int,
    ) -> dict[str, Any]:

        request = self.decisions.get(step_id)

        if request is None:
            raise ValueError(
                f"No approval request for step {step_id}."
            )

        request["status"] = "approved"

        return request

    def reject(
        self,
        step_id: int,
        reason: str = "",
    ) -> dict[str, Any]:

        request = self.decisions.get(step_id)

        if request is None:
            raise ValueError(
                f"No approval request for step {step_id}."
            )

        request["status"] = "rejected"
        request["rejection_reason"] = reason

        return request

    def edit(
        self,
        step_id: int,
        changes: dict[str, Any],
    ) -> dict[str, Any]:

        request = self.decisions.get(step_id)

        if request is None:
            raise ValueError(
                f"No approval request for step {step_id}."
            )

        request["status"] = "edited"
        request["changes"] = changes

        return request

    def get_status(
        self,
        step_id: int,
    ) -> str:

        request = self.decisions.get(step_id)

        if request is None:
            return "not_requested"

        return request["status"]


def get_workflow_approval_manager():
    return WorkflowApprovalManager()