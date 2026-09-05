from copy import deepcopy

from agents.autopilot_state import (
    AutopilotExecutionState,
)


class WorkflowCheckpointManager:
    """
    Creates and restores workflow checkpoints.
    """

    def __init__(self):
        self.checkpoints = {}

    def save_checkpoint(
        self,
        state: AutopilotExecutionState,
        name: str = "default",
    ):
        self.checkpoints[name] = deepcopy(state)

        state.add_trace(
            "checkpoint_saved",
            {
                "name": name,
            },
        )

        return self.checkpoints[name]

    def restore_checkpoint(
        self,
        name: str = "default",
    ) -> AutopilotExecutionState:

        checkpoint = self.checkpoints.get(name)

        if checkpoint is None:
            raise ValueError(
                f"Checkpoint not found: {name}"
            )

        return deepcopy(checkpoint)

    def has_checkpoint(
        self,
        name: str = "default",
    ) -> bool:

        return name in self.checkpoints

    def delete_checkpoint(
        self,
        name: str = "default",
    ):

        self.checkpoints.pop(
            name,
            None,
        )

    def list_checkpoints(self):
        return list(
            self.checkpoints.keys()
        )


def get_checkpoint_manager():
    return WorkflowCheckpointManager()