from ai_service import generate_ai_response


SUPPORTED_CONTENT_TYPES = {
    "email",
    "report",
    "resume",
    "notes",
    "proposal",
    "blog",
}


CONTENT_TYPE_INSTRUCTIONS = {
    "email": (
        "Create a professional, clear and natural email. "
        "Include an appropriate subject line when useful."
    ),
    "report": (
        "Create a well-structured report with a clear title, "
        "headings, useful sections and concise professional language."
    ),
    "resume": (
        "Create strong, professional resume content using clear "
        "sections, concise wording and achievement-oriented language "
        "where appropriate. Do not invent personal facts."
    ),
    "notes": (
        "Create clean, organized notes using headings, subheadings "
        "and bullet points where helpful. Keep important information easy to revise."
    ),
    "proposal": (
        "Create a professional proposal with a clear objective, "
        "problem statement, proposed solution, scope, benefits and next steps "
        "when relevant."
    ),
    "blog": (
        "Create an engaging, well-structured blog article with a suitable "
        "title, introduction, sections and conclusion."
    ),
}


def generate_content(
    content_type: str,
    prompt: str,
    user_id: int,
    workspace_id: int,
) -> str:
    """
    Generate structured content using Nova's existing AI service.
    """

    content_type = str(
        content_type or ""
    ).strip().lower()

    prompt = str(
        prompt or ""
    ).strip()

    if content_type not in SUPPORTED_CONTENT_TYPES:
        raise ValueError(
            "Unsupported content type."
        )

    if not prompt:
        raise ValueError(
            "Please provide a prompt."
        )

    if user_id <= 0:
        raise ValueError(
            "Invalid user."
        )

    if workspace_id <= 0:
        raise ValueError(
            "Invalid workspace."
        )

    instruction = CONTENT_TYPE_INSTRUCTIONS[
        content_type
    ]

    generation_prompt = f"""
You are generating content inside Nova AI Workspace.

Content type:
{content_type}

Instructions:
{instruction}

User request:
{prompt}

Important rules:
- Follow the requested content type.
- Keep the output useful and ready to edit or use.
- Do not add unnecessary explanations before the content.
- Do not invent personal details that the user did not provide.
- Return only the generated content.
"""

    return generate_ai_response(
        message=generation_prompt,
        conversation_history=[],
        file_path=None,
        user_id=user_id,
        workspace_id=workspace_id,
    )
