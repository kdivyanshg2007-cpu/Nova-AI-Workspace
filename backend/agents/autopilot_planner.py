from dataclasses import dataclass, field
from typing import Any


@dataclass
class PlanStep:
    """
    Represents one step in an autopilot plan.
    """

    step_id: int
    title: str
    description: str
    dependencies: list[int] = field(
        default_factory=list
    )
    expected_output: str = ""
    status: str = "pending"

    def to_dict(self) -> dict[str, Any]:
        return {
            "step_id": self.step_id,
            "title": self.title,
            "description": self.description,
            "dependencies": self.dependencies,
            "expected_output": self.expected_output,
            "status": self.status,
        }


@dataclass
class AutopilotPlan:
    """
    Structured plan generated from a user goal.
    """

    goal: str
    steps: list[PlanStep] = field(
        default_factory=list
    )

    def to_dict(self) -> dict[str, Any]:
        return {
            "goal": self.goal,
            "steps": [
                step.to_dict()
                for step in self.steps
            ],
        }


class AutopilotPlanner:
    """
    Basic rule-based Autopilot Planner.

    Converts a high-level user goal into:
    - ordered steps
    - dependencies
    - expected outputs
    """

    def create_plan(
        self,
        goal: str,
    ) -> AutopilotPlan:

        goal = goal.strip()

        if not goal:
            raise ValueError(
                "Autopilot goal cannot be empty."
            )

        steps = [
            PlanStep(
                step_id=1,
                title="Understand the goal",
                description=(
                    "Analyze the user's goal and "
                    "identify the required outcome."
                ),
                dependencies=[],
                expected_output=(
                    "Clear understanding of the goal."
                ),
            ),
            PlanStep(
                step_id=2,
                title="Break goal into tasks",
                description=(
                    "Divide the goal into manageable "
                    "execution tasks."
                ),
                dependencies=[1],
                expected_output=(
                    "Ordered list of execution tasks."
                ),
            ),
            PlanStep(
                step_id=3,
                title="Validate dependencies",
                description=(
                    "Check which tasks depend on "
                    "previous tasks."
                ),
                dependencies=[2],
                expected_output=(
                    "Dependency-aware task order."
                ),
            ),
            PlanStep(
                step_id=4,
                title="Define expected outputs",
                description=(
                    "Specify the expected output "
                    "from each task."
                ),
                dependencies=[3],
                expected_output=(
                    "Expected output for every task."
                ),
            ),
        ]

        return AutopilotPlan(
            goal=goal,
            steps=steps,
        )


def get_autopilot_planner():
    return AutopilotPlanner()