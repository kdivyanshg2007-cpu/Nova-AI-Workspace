from typing import Any, Callable

from agents.autopilot_planner import AutopilotPlan
from agents.autopilot_state import AutopilotExecutionState


class WorkflowExecutor:
    """
    Executes an AutopilotPlan with:
    - dependency handling
    - step state
    - retries
    - result passing
    - execution trace
    """

    def __init__(self, max_retries: int = 3):
        self.max_retries = max_retries

        self.handlers: dict[
            int,
            Callable[..., Any]
        ] = {}

    def register_handler(
        self,
        step_id: int,
        handler: Callable[..., Any],
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

    def _collect_dependency_outputs(
        self,
        step,
        state: AutopilotExecutionState,
    ) -> dict[int, Any]:

        outputs = {}

        for dependency in step.dependencies:

            dependency_state = state.steps.get(
                dependency
            )

            if dependency_state:
                outputs[dependency] = (
                    dependency_state.output
                )

        return outputs

    def execute_step(
        self,
        step,
        state: AutopilotExecutionState,
    ):

        if not self._dependencies_completed(
            step,
            state,
        ):
            raise ValueError(
                f"Dependencies for step "
                f"{step.step_id} are not completed."
            )

        dependency_outputs = (
            self._collect_dependency_outputs(
                step,
                state,
            )
        )

        state.start_step(step.step_id)

        attempts = 0

        while attempts <= self.max_retries:

            attempts += 1

            try:

                handler = self.handlers.get(
                    step.step_id
                )

                if handler is None:

                    output = {
                        "message": (
                            f"Step {step.step_id} "
                            "executed successfully."
                        ),
                        "dependency_outputs": (
                            dependency_outputs
                        ),
                    }

                else:

                    output = handler(
                        step=step,
                        state=state,
                        dependency_outputs=dependency_outputs,
                    )

                state.steps[
                    step.step_id
                ].attempts = attempts

                state.complete_step(
                    step.step_id,
                    output,
                )

                state.add_trace(
                    "workflow_step_result",
                    {
                        "step_id": step.step_id,
                        "attempts": attempts,
                    },
                )

                return output

            except Exception as error:

                state.steps[
                    step.step_id
                ].attempts = attempts

                state.add_trace(
                    "workflow_step_retry",
                    {
                        "step_id": step.step_id,
                        "attempt": attempts,
                        "error": str(error),
                    },
                )

                if attempts > self.max_retries:
                    state.fail_step(
                        step.step_id,
                        str(error),
                    )

                    raise

        raise RuntimeError(
            f"Step {step.step_id} failed."
        )

    def execute_plan(
        self,
        plan: AutopilotPlan,
    ) -> AutopilotExecutionState:

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
                    "Workflow could not continue because "
                    "dependencies could not be resolved."
                )

                raise ValueError(
                    "Unresolved workflow dependencies."
                )

        state.complete()

        return state


def get_workflow_executor():
    return WorkflowExecutor()