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
        operation: str = "generate",
    ) -> str:
        operation = (
            operation.strip().lower()
            if operation
            else "generate"
        )

        operation_instruction = {
            "generate": """
Generate a complete, working solution for the requested task.
Provide the code clearly and explain important parts briefly.
""",
            "explain": """
Explain the EXISTING CODE that was provided.
Do not generate a new program unless a small corrected snippet
is necessary to clarify the explanation.

Explain:
- what the code does
- how the logic works
- important variables/functions
- step-by-step flow
- time complexity
- space complexity

Keep the explanation focused on the provided code.
""",
            "debug": """
Debug the EXISTING CODE that was provided.

You must:
- identify the actual bug(s)
- explain why each bug occurs
- provide the corrected version of the code
- clearly mention what was changed
- keep the original goal of the program
- do not unnecessarily rewrite unrelated parts
""",
            "optimize": """
Optimize the EXISTING CODE that was provided.

You must:
- identify important inefficiencies
- explain what can be improved
- provide an optimized version where useful
- preserve the intended functionality
- provide time and space complexity before and after optimization
""",
            "test_cases": """
Create meaningful test cases for the EXISTING CODE and its intended behavior.

Include:
- normal cases
- edge cases
- boundary cases where relevant
- expected outputs

Do not unnecessarily rewrite the complete program.
""",
        }

        selected_instruction = operation_instruction.get(
            operation,
            operation_instruction["generate"],
        )

        return f"""
You are Nova AI Coding Agent.

Task:
{task}

Operation:
{operation}

Programming Language:
{language or "Not specified"}

Existing Code:
{code or "No existing code provided"}

Operation Instructions:
{selected_instruction}

General Instructions:
- Give a clear and useful answer.
- Respect the requested programming language.
- Use the existing code when the operation is explain, debug,
  optimize, or test_cases.
- For debugging, identify real problems instead of inventing bugs.
- For explanation, explain the provided code rather than generating
  a replacement program.
- For optimization, preserve the original behavior.
- For test cases, give practical and meaningful inputs and outputs.
- Do not expose secrets, API keys, passwords, tokens, or private data.
- Use clear formatting.
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

        operation = (
            operation.strip().lower()
            if operation
            else "generate"
        )

        state = AgentState(
            user_id=user_id,
            workspace_id=workspace_id,
            user_query=task,
            agent_name="coding",
        )

        if not task and not code.strip():
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
                operation=operation,
            )

            # -------------------------------------------------
            # GEMINI REQUEST WITH FALLBACK
            # -------------------------------------------------

            fallback_models = [
                settings.GEMINI_MODEL,
                "gemini-3.8-flash",
                "gemini-3.7-flash",
                "gemini-3.5-flash-lite",
            ]

            models_to_try = []

            for model_name in fallback_models:
                if (
                    model_name
                    and model_name not in models_to_try
                ):
                    models_to_try.append(
                        model_name
                    )

            response = None
            last_error = None

            for current_model in models_to_try:
                try:
                    self.logger.log(
                        "coding_model_attempt",
                        "coding",
                        {
                            "model": current_model,
                            "operation": operation,
                        },
                    )

                    response = (
                        self.client.models.generate_content(
                            model=current_model,
                            contents=prompt,
                        )
                    )

                    self.logger.log(
                        "coding_model_success",
                        "coding",
                        {
                            "model": current_model,
                            "operation": operation,
                        },
                    )

                    break

                except Exception as generation_error:
                    last_error = generation_error

                    error_text = str(
                        generation_error
                    ).lower()

                    is_transient_error = (
                        "503" in error_text
                        or "service unavailable"
                        in error_text
                        or "high demand"
                        in error_text
                        or "currently experiencing high demand"
                        in error_text
                    )

                    if not is_transient_error:
                        raise

                    self.logger.log(
                        "coding_model_failed",
                        "coding",
                        {
                            "model": current_model,
                            "error": str(
                                generation_error
                            ),
                            "operation": operation,
                        },
                    )

                    continue

            if response is None:
                if last_error is not None:
                    raise last_error

                raise RuntimeError(
                    "Gemini returned no response."
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