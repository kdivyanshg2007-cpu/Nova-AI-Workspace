from google import genai

from settings import settings

from agents.agent_result import AgentResult
from agents.agent_state import AgentState
from agents.agent_logger import AgentLogger
from agents.safety import AgentSafety


class StudyAgent:
    """
    Nova AI Study Agent.

    Supports:
    - notes
    - quiz / MCQs
    - revision
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
        subject: str = "",
        topic: str = "",
        study_material: str = "",
    ) -> str:
        return f"""
You are Nova AI Study Agent.

Task:
{task}

Subject:
{subject or "Not specified"}

Topic:
{topic or "Not specified"}

Study Material:
{study_material or "No study material provided"}

Instructions:
- Explain concepts clearly and simply.
- For notes, create organized study notes.
- For quizzes, create useful questions with answers.
- For revision, create a concise revision plan or recap.
- Stay focused on the student's request.
- Do not invent information that is not supported by the provided material.
"""

    def run(
        self,
        task: str,
        subject: str = "",
        topic: str = "",
        study_material: str = "",
        operation: str = "notes",
        workspace_id: int | None = None,
        user_id: int | None = None,
    ):
        task = task.strip()

        state = AgentState(
            user_id=user_id,
            workspace_id=workspace_id,
            user_query=task,
            agent_name="study",
        )

        if not task:
            error_message = "Study task cannot be empty."

            state.add_error(error_message)

            self.logger.log(
                "study_blocked",
                "study",
                {
                    "reason": error_message
                },
            )

            return AgentResult.failure_result(
                agent_name="study",
                error=error_message,
            )

        safety_result = self.safety.check_query(task)

        if not safety_result["allowed"]:
            error_message = safety_result["reason"]

            state.add_error(error_message)

            self.logger.log(
                "study_blocked",
                "study",
                {
                    "reason": error_message
                },
            )

            return AgentResult.failure_result(
                agent_name="study",
                error=error_message,
            )

        state.start()

        self.logger.log(
            "study_started",
            "study",
            {
                "operation": operation,
                "subject": subject,
                "topic": topic,
            },
        )

        try:
            prompt = self._build_prompt(
                task=task,
                subject=subject,
                topic=topic,
                study_material=study_material,
            )

            response = self.client.models.generate_content(
                model=settings.GEMINI_MODEL,
                contents=prompt,
            )

            answer = (response.text or "").strip()

            if not answer:
                raise ValueError(
                    "Study agent returned an empty response."
                )

            state.output_data = {
                "operation": operation,
                "subject": subject,
                "topic": topic,
                "answer": answer,
            }

            state.add_trace(
                "study_completed",
                {
                    "operation": operation,
                },
            )

            state.complete()

            self.logger.log(
                "study_completed",
                "study",
                {
                    "success": True,
                    "operation": operation,
                },
            )

            return AgentResult.success_result(
                agent_name="study",
                answer=answer,
                data={
                    "operation": operation,
                    "subject": subject,
                    "topic": topic,
                },
                confidence=0.90,
            )

        except Exception as error:
            error_message = str(error)

            state.add_error(error_message)

            self.logger.log(
                "study_failed",
                "study",
                {
                    "error": error_message,
                    "operation": operation,
                },
            )

            return AgentResult.failure_result(
                agent_name="study",
                error=error_message,
            )


def get_study_agent():
    return StudyAgent()