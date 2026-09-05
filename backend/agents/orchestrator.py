from typing import Any

from agents.agent_state import AgentState
from agents.agent_tools import AgentTool, ToolRegistry
from agents.agent_router import AgentRouter
from agents.agent_result import AgentResult

from agents.research_agent import ResearchAgent
from agents.coding_agent import CodingAgent
from agents.study_agent import StudyAgent
from agents.document_agent import DocumentAgent


class AgentOrchestrator:
    """
    Nova AI Agent Orchestrator.

    Responsibilities:
    - manage tools
    - route user requests to specialist agents
    - manage agent state
    - execute tools with retries
    - return structured agent results
    - record execution traces
    """

    def __init__(self):
        self.tool_registry = ToolRegistry()
        self.router = AgentRouter()

        self.agents = {
            "research": ResearchAgent(),
            "coding": CodingAgent(),
            "study": StudyAgent(),
            "document": DocumentAgent(),
        }

    # --------------------------------------------------
    # TOOL MANAGEMENT
    # --------------------------------------------------

    def register_tool(self, tool: AgentTool):
        self.tool_registry.register(tool)

    def get_available_tools(self):
        return self.tool_registry.list_tools()

    # --------------------------------------------------
    # TOOL EXECUTION
    # --------------------------------------------------

    def execute_tool(
        self,
        tool_name: str,
        state: AgentState,
        parameters: dict[str, Any] | None = None,
    ):
        parameters = parameters or {}

        state.add_trace(
            "tool_execution_started",
            {
                "tool": tool_name,
                "parameters": parameters,
            },
        )

        while True:

            try:
                state.start()

                result = self.tool_registry.run_tool(
                    tool_name,
                    **parameters,
                )

                state.output_data[tool_name] = result

                state.add_trace(
                    "tool_execution_completed",
                    {
                        "tool": tool_name,
                    },
                )

                return result

            except Exception as error:

                state.increment_retry()

                state.add_trace(
                    "tool_execution_failed",
                    {
                        "tool": tool_name,
                        "error": str(error),
                        "retry_count": state.retry_count,
                    },
                )

                if not state.can_retry():

                    state.add_error(
                        f"Tool '{tool_name}' failed: {error}"
                    )

                    raise

    # --------------------------------------------------
    # AGENT ROUTING
    # --------------------------------------------------

    def route_query(self, user_query: str):
        """
        Decide which specialist agent should handle
        the user's query.
        """

        return self.router.route(user_query)

    # --------------------------------------------------
    # AGENT EXECUTION
    # --------------------------------------------------

    def run_agent(
        self,
        user_query: str,
        workspace_id: int | None = None,
        user_id: int | None = None,
        **kwargs,
    ) -> AgentResult:
        """
        Route the query and execute the selected specialist agent.
        """

        user_query = user_query.strip()

        if not user_query:
            return AgentResult.failure_result(
                agent_name="general",
                error="User query cannot be empty.",
            )

        # ----------------------------------------------
        # Route
        # ----------------------------------------------

        route = self.router.route(user_query)

        agent_name = route.agent_name

        # ----------------------------------------------
        # General fallback
        # ----------------------------------------------

        if agent_name == "general":
            return AgentResult.failure_result(
                agent_name="general",
                error=(
                    "No specialist agent matched "
                    "this query."
                ),
            )

        # ----------------------------------------------
        # Get specialist agent
        # ----------------------------------------------

        agent = self.agents.get(agent_name)

        if agent is None:
            return AgentResult.failure_result(
                agent_name=agent_name,
                error=(
                    f"Agent '{agent_name}' "
                    "is not available."
                ),
            )

        # ----------------------------------------------
        # Create orchestration state
        # ----------------------------------------------

        state = AgentState(
            user_id=user_id,
            workspace_id=workspace_id,
            user_query=user_query,
            agent_name=agent_name,
        )

        state.start()

        state.add_trace(
            "agent_routed",
            {
                "agent": agent_name,
                "reason": route.reason,
                "confidence": route.confidence,
            },
        )

        # ----------------------------------------------
        # Execute specialist agent
        # ----------------------------------------------

        try:

            if agent_name == "research":

                result = agent.run(
                    query=user_query,
                    workspace_id=workspace_id,
                    user_id=user_id,
                    **kwargs,
                )

            elif agent_name == "coding":

                result = agent.run(
                    task=user_query,
                    workspace_id=workspace_id,
                    user_id=user_id,
                    **kwargs,
                )

            elif agent_name == "study":

                result = agent.run(
                    task=user_query,
                    workspace_id=workspace_id,
                    user_id=user_id,
                    **kwargs,
                )

            elif agent_name == "document":

                result = agent.run(
                    task=user_query,
                    workspace_id=workspace_id,
                    user_id=user_id,
                    **kwargs,
                )

            else:

                return AgentResult.failure_result(
                    agent_name=agent_name,
                    error="Unsupported agent type.",
                )

            # ------------------------------------------
            # Record orchestration result
            # ------------------------------------------

            state.output_data = {
                "agent": agent_name,
                "route_reason": route.reason,
                "route_confidence": route.confidence,
            }

            state.add_trace(
                "agent_execution_completed",
                {
                    "agent": agent_name,
                    "success": result.success,
                },
            )

            if result.success:
                state.complete()

            return result

        except Exception as error:

            state.add_error(str(error))

            state.add_trace(
                "agent_execution_failed",
                {
                    "agent": agent_name,
                    "error": str(error),
                },
            )

            return AgentResult.failure_result(
                agent_name=agent_name,
                error=str(error),
            )

    # --------------------------------------------------
    # BASIC STATE CREATION
    # --------------------------------------------------

    def run(
        self,
        user_query: str,
        workspace_id: int | None = None,
        user_id: int | None = None,
    ):
        """
        Create a basic orchestration state.

        Kept for backward compatibility with the
        earlier Day 16 architecture.
        """

        state = AgentState(
            user_query=user_query,
            workspace_id=workspace_id,
            user_id=user_id,
        )

        state.add_trace(
            "agent_execution_started",
            {
                "query": user_query,
            },
        )

        return state