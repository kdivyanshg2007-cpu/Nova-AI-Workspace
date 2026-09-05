from typing import Any

from agents.autopilot_planner import AutopilotPlan


class AutopilotValidator:
    """
    Validates an AutopilotPlan before execution.
    """

    def validate(
        self,
        plan: AutopilotPlan,
    ) -> dict[str, Any]:
        errors = []

        if not plan.goal.strip():
            errors.append(
                "Plan goal cannot be empty."
            )

        steps = plan.steps

        if not steps:
            errors.append(
                "Plan must contain at least one step."
            )

        step_ids = [
            step.step_id
            for step in steps
        ]

        # Duplicate step IDs
        if len(step_ids) != len(set(step_ids)):
            errors.append(
                "Step IDs must be unique."
            )

        step_id_set = set(step_ids)

        for step in steps:

            # Empty title
            if not step.title.strip():
                errors.append(
                    f"Step {step.step_id} has an empty title."
                )

            # Empty description
            if not step.description.strip():
                errors.append(
                    f"Step {step.step_id} has an empty description."
                )

            # Missing expected output
            if not step.expected_output.strip():
                errors.append(
                    f"Step {step.step_id} "
                    "has no expected output."
                )

            # Dependencies must exist
            for dependency in step.dependencies:

                if dependency not in step_id_set:
                    errors.append(
                        f"Step {step.step_id} has invalid "
                        f"dependency: {dependency}"
                    )

                # Dependency must be an earlier step
                if dependency >= step.step_id:
                    errors.append(
                        f"Step {step.step_id} must depend "
                        f"only on earlier steps."
                    )

        # Check step ordering
        if step_ids != sorted(step_ids):
            errors.append(
                "Steps must be ordered by step_id."
            )

        # Check for circular/self dependency
        for step in steps:
            if step.step_id in step.dependencies:
                errors.append(
                    f"Step {step.step_id} cannot depend "
                    "on itself."
                )

        return {
            "valid": len(errors) == 0,
            "errors": errors,
        }


def validate_autopilot_plan(
    plan: AutopilotPlan,
) -> dict[str, Any]:
    validator = AutopilotValidator()
    return validator.validate(plan)