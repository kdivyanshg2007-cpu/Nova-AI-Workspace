from typing import Any

from google import genai

from settings import settings

from agents.agent_result import AgentResult
from agents.agent_state import AgentState
from agents.agent_logger import AgentLogger
from agents.safety import AgentSafety


class CodingAgent:
    """
    Nova AI Coding Agent.

    Supports:
    - code generation
    - code explanation
    - debugging
    - optimization
    - test case generation
    """

    def __init__(self):
        if not settings.GEMINI_API_KEY:
            raise ValueError(
                "Gemini API key is not configured."
            )

        self.client = genai.Client(
            api_key=settings.GEMINI_API_KEY
        )

        self.safety = AgentSafety()
        self.logger = AgentLogger()

    def _build_prompt(
        self,
        task: str,
        code: str = "",
        language: str = "",
    ) -> str:
        return f"""
You are Nova AI Coding Agent.

Task:
{task}

Programming Language:
{language or "Not specified"}

Existing Code:
{code or "No existing code provided"}

Instructions:
- Give a clear and useful answer.
- For code generation, provide working code.
- For debugging, identify the problem and provide the corrected code.
- For explanation, explain the code simply.
- For optimization, suggest improvements and provide optimized code where useful.
- For test cases, provide meaningful test cases.
- Do not expose secrets or API keys.
"""

    def run(
        self,
        task: str,
        code: str = "",
        language: str = "",
        operation: str = "generate",
        workspace_id: int | None = None,
        user_id: int | None = None,
    ):
        task = task.strip()

        state = AgentState(
            user_id=user_id,
            workspace_id=workspace_id,
            user_query=task,
            agent_name="coding",
        )

        if not task:
            error_message = (
                "Coding task cannot be empty."
            )

            state.add_error(error_message)

            return AgentResult.failure_result(
                agent_name="coding",
                error=error_message,
            )

        # Safety check
        safety_result = self.safety.check_query(task)

        if not safety_result["allowed"]:
            error_message = safety_result["reason"]

            state.add_error(error_message)

            self.logger.log(
                "coding_blocked",
                "coding",
                {
                    "reason": error_message
                },
            )

            return AgentResult.failure_result(
                agent_name="coding",
                error=error_message,
            )

        state.start()

        self.logger.log(
            "coding_started",
            "coding",
            {
                "operation": operation,
                "language": language,
            },
        )

        try:
            prompt = self._build_prompt(
                task=task,
                code=code,
                language=language,
            )

            response = self.client.models.generate_content(
                model=settings.GEMINI_MODEL,
                contents=prompt,
            )

            answer = (
                response.text or ""
            ).strip()

            if not answer:
                raise ValueError(
                    "Coding agent returned an empty response."
                )

            state.output_data = {
                "operation": operation,
                "language": language,
                "answer": answer,
            }

            state.add_trace(
                "coding_completed",
                {
                    "operation": operation,
                },
            )

            state.complete()

            self.logger.log(
                "coding_completed",
                "coding",
                {
                    "success": True,
                    "operation": operation,
                },
            )

            return AgentResult.success_result(
                agent_name="coding",
                answer=answer,
                data={
                    "operation": operation,
                    "language": language,
                },
                confidence=0.90,
            )

        except Exception as error:
            error_message = str(error)

            state.add_error(
                error_message
            )

            self.logger.log(
                "coding_failed",
                "coding",
                {
                    "error": error_message,
                    "operation": operation,
                },
            )

            return AgentResult.failure_result(
                agent_name="coding",
                error=error_message,
            )


def get_coding_agent():
    return CodingAgent()