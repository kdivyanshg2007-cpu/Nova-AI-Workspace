from typing import Any


class AutopilotWorkspaceStore:
    """
    Temporary workspace output store.

    Later this can be connected to the real
    PostgreSQL workspace/output tables.
    """

    def __init__(self):
        self.outputs: dict[int, list[dict[str, Any]]] = {}

    def save(
        self,
        workspace_id: int,
        goal: str,
        summary: dict[str, Any],
    ):

        record = {
            "goal": goal,
            "summary": summary,
        }

        self.outputs.setdefault(
            workspace_id,
            [],
        ).append(record)

        return record

    def list_outputs(
        self,
        workspace_id: int,
    ):

        return self.outputs.get(
            workspace_id,
            [],
        ).copy()


def get_workspace_store():
    return AutopilotWorkspaceStore()