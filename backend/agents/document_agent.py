from google import genai

from settings import settings

from agents.agent_result import AgentResult
from agents.agent_state import AgentState
from agents.agent_logger import AgentLogger
from agents.safety import AgentSafety


class DocumentAgent:
    """
    Nova AI Document Agent.

    Supports:
    - summarize
    - extract
    - transform
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
        operation: str = "summarize",
        document_text: str = "",
    ) -> str:
        return f"""
You are Nova AI Document Agent.

Operation:
{operation}

Task:
{task}

Document Content:
{document_text or "No document content provided"}

Instructions:
- For summarize: create a clear and concise summary.
- For extract: extract the information requested by the user.
- For transform: rewrite or transform the document according to the request.
- Preserve important facts from the provided document.
- Do not invent information.
- Keep the output organized and useful.
"""

    def run(
        self,
        task: str,
        document_text: str = "",
        operation: str = "summarize",
        workspace_id: int | None = None,
        user_id: int | None = None,
    ):
        task = task.strip()

        state = AgentState(
            user_id=user_id,
            workspace_id=workspace_id,
            user_query=task,
            agent_name="document",
        )

        # -----------------------------------------
        # 1. Validate task
        # -----------------------------------------

        if not task:
            error_message = (
                "Document task cannot be empty."
            )

            state.add_error(error_message)

            self.logger.log(
                "document_blocked",
                "document",
                {
                    "reason": error_message
                },
            )

            return AgentResult.failure_result(
                agent_name="document",
                error=error_message,
            )

        # -----------------------------------------
        # 2. Safety check
        # -----------------------------------------

        safety_result = self.safety.check_query(task)

        if not safety_result["allowed"]:
            error_message = safety_result["reason"]

            state.add_error(error_message)

            self.logger.log(
                "document_blocked",
                "document",
                {
                    "reason": error_message
                },
            )

            return AgentResult.failure_result(
                agent_name="document",
                error=error_message,
            )

        # -----------------------------------------
        # 3. Start agent
        # -----------------------------------------

        state.start()

        self.logger.log(
            "document_started",
            "document",
            {
                "operation": operation
            },
        )

        try:
            # -------------------------------------
            # 4. Build prompt
            # -------------------------------------

            prompt = self._build_prompt(
                task=task,
                operation=operation,
                document_text=document_text,
            )

            # -------------------------------------
            # 5. Generate response
            # -------------------------------------

            response = self.client.models.generate_content(
                model=settings.GEMINI_MODEL,
                contents=prompt,
            )

            answer = (
                response.text or ""
            ).strip()

            if not answer:
                raise ValueError(
                    "Document agent returned an empty response."
                )

            # -------------------------------------
            # 6. Save output
            # -------------------------------------

            state.output_data = {
                "operation": operation,
                "answer": answer,
            }

            state.add_trace(
                "document_completed",
                {
                    "operation": operation
                },
            )

            state.complete()

            # -------------------------------------
            # 7. Log completion
            # -------------------------------------

            self.logger.log(
                "document_completed",
                "document",
                {
                    "success": True,
                    "operation": operation,
                },
            )

            # -------------------------------------
            # 8. Structured result
            # -------------------------------------

            return AgentResult.success_result(
                agent_name="document",
                answer=answer,
                data={
                    "operation": operation,
                },
                confidence=0.90,
            )

        except Exception as error:
            error_message = str(error)

            state.add_error(
                error_message
            )

            self.logger.log(
                "document_failed",
                "document",
                {
                    "error": error_message,
                    "operation": operation,
                },
            )

            return AgentResult.failure_result(
                agent_name="document",
                error=error_message,
            )


def get_document_agent():
    return DocumentAgent()