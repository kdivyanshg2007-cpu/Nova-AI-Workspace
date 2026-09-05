from agents.agent_result import AgentResult
from agents.autopilot_planner import AutopilotPlan
from agents.autopilot_planner_ai import AIAutopilotPlanner
from agents.autopilot_validator import AutopilotValidator


class AutopilotEngine:
    """
    Combines:
    - AI planning
    - plan validation
    - structured results

    Flow:
        Goal
          ↓
      AI Planner
          ↓
       Plan
          ↓
      Validator
          ↓
    Valid / Invalid
    """

    def __init__(self):
        self.planner = AIAutopilotPlanner()
        self.validator = AutopilotValidator()

    def create_plan(self, goal: str) -> AutopilotPlan:
        """
        Generate an AI plan and validate it.
        """

        plan = self.planner.create_plan(goal)

        validation = self.validator.validate(plan)

        if not validation["valid"]:
            raise ValueError(
                "Generated autopilot plan is invalid: "
                + "; ".join(validation["errors"])
            )

        return plan

    def run(self, goal: str) -> AgentResult:
        """
        Generate, validate and return a structured plan.
        """

        try:
            plan = self.create_plan(goal)

            return AgentResult.success_result(
                agent_name="autopilot_engine",
                answer=(
                    "Autopilot plan created and "
                    "validated successfully."
                ),
                data=plan.to_dict(),
                confidence=0.90,
            )

        except Exception as error:

            return AgentResult.failure_result(
                agent_name="autopilot_engine",
                error=str(error),
            )


def get_autopilot_engine():
    return AutopilotEngine()