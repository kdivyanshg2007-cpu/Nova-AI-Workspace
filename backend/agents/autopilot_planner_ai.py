from typing import Any

from google import genai

from settings import settings

from agents.agent_result import AgentResult
from agents.autopilot_planner import (
    AutopilotPlan,
    PlanStep,
)


class AIAutopilotPlanner:
    """
    Gemini-powered Autopilot Planner.

    Converts a high-level user goal into:
    - ordered steps
    - dependencies
    - expected outputs
    """

    def __init__(self):
        if not settings.GEMINI_API_KEY:
            raise ValueError(
                "Gemini API key is not configured."
            )

        self.client = genai.Client(
            api_key=settings.GEMINI_API_KEY
        )

    def _build_prompt(self, goal: str) -> str:
        return f"""
You are the planning engine for Nova AI Workspace.

User goal:
{goal}

Break this goal into 4 to 8 practical execution steps.

For every step provide:
- step_id
- title
- description
- dependencies
- expected_output

Rules:
- Steps must be ordered logically.
- Dependencies must reference earlier step IDs.
- Keep steps actionable.
- Do not invent unnecessary tasks.
- Return ONLY valid JSON.

JSON format:
{{
  "goal": "{goal}",
  "steps": [
    {{
      "step_id": 1,
      "title": "Step title",
      "description": "What to do",
      "dependencies": [],
      "expected_output": "Expected result"
    }}
  ]
}}
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

        prompt = self._build_prompt(goal)

        response = self.client.models.generate_content(
            model=settings.GEMINI_MODEL,
            contents=prompt,
        )

        text = (response.text or "").strip()

        if not text:
            raise ValueError(
                "AI planner returned an empty response."
            )

        try:
            import json

            data: dict[str, Any] = json.loads(text)

        except Exception as error:
            raise ValueError(
                f"AI planner returned invalid JSON: {error}"
            )

        raw_steps = data.get("steps", [])

        if not raw_steps:
            raise ValueError(
                "AI planner returned no steps."
            )

        steps = []

        for raw_step in raw_steps:

            step_id = int(
                raw_step["step_id"]
            )

            title = str(
                raw_step["title"]
            )

            description = str(
                raw_step["description"]
            )

            dependencies = [
                int(dep)
                for dep in raw_step.get(
                    "dependencies",
                    [],
                )
            ]

            expected_output = str(
                raw_step.get(
                    "expected_output",
                    "",
                )
            )

            steps.append(
                PlanStep(
                    step_id=step_id,
                    title=title,
                    description=description,
                    dependencies=dependencies,
                    expected_output=expected_output,
                )
            )

        return AutopilotPlan(
            goal=data.get("goal", goal),
            steps=steps,
        )

    def run(
        self,
        goal: str,
    ) -> AgentResult:

        try:
            plan = self.create_plan(goal)

            return AgentResult.success_result(
                agent_name="autopilot_planner",
                answer=(
                    "Autopilot plan created successfully."
                ),
                data=plan.to_dict(),
                confidence=0.90,
            )

        except Exception as error:

            return AgentResult.failure_result(
                agent_name="autopilot_planner",
                error=str(error),
            )


def get_ai_autopilot_planner():
    return AIAutopilotPlanner()