from typing import Any, Callable

from agents.autopilot_planner import AutopilotPlan
from agents.autopilot_state import AutopilotExecutionState


class AutopilotExecutor:
    """
    Executes an AutopilotPlan in dependency order.

    Each step must wait until all of its dependencies
    are completed.
    """

    def __init__(self):
        self.handlers: dict[
            int,
            Callable[[Any], Any]
        ] = {}

    def register_handler(
        self,
        step_id: int,
        handler: Callable[[Any], Any],
    ):
        self.handlers[step_id] = handler

    def _dependencies_completed(
        self,
        step,
        state: AutopilotExecutionState,
    ) -> bool:
        for dependency in step.dependencies:

            dependency_state = state.steps.get(
                dependency
            )

            if dependency_state is None:
                return False

            if dependency_state.status != "completed":
                return False

        return True

    def execute_step(
        self,
        step,
        state: AutopilotExecutionState,
    ):
        """
        Execute one plan step.
        """

        if not self._dependencies_completed(
            step,
            state,
        ):
            raise ValueError(
                f"Dependencies for step "
                f"{step.step_id} are not completed."
            )

        state.start_step(step.step_id)

        try:
            handler = self.handlers.get(
                step.step_id
            )

            if handler is None:
                output = (
                    f"Step {step.step_id} "
                    "executed successfully."
                )
            else:
                output = handler(
                    state
                )

            state.complete_step(
                step.step_id,
                output,
            )

            return output

        except Exception as error:
            state.fail_step(
                step.step_id,
                str(error),
            )

            raise

    def execute_plan(
        self,
        plan: AutopilotPlan,
    ) -> AutopilotExecutionState:
        """
        Execute all steps of a plan in dependency order.
        """

        state = AutopilotExecutionState(
            goal=plan.goal
        )

        for step in plan.steps:
            state.add_step(step.step_id)

        state.start()

        remaining = {
            step.step_id: step
            for step in plan.steps
        }

        while remaining:

            progress = False

            for step_id, step in list(
                remaining.items()
            ):

                if not self._dependencies_completed(
                    step,
                    state,
                ):
                    continue

                self.execute_step(
                    step,
                    state,
                )

                del remaining[step_id]

                progress = True

            if not progress:
                state.fail(
                    "Unable to continue execution. "
                    "Dependency cycle or unresolved dependency detected."
                )

                raise ValueError(
                    "Autopilot plan cannot be executed "
                    "because dependencies cannot be resolved."
                )

        state.complete()

        return state


def get_autopilot_executor():
    return AutopilotExecutor()