from typing import Any, Callable


class AgentTool:
    """
    Represents a tool that an AI agent can call.
    """

    def __init__(
        self,
        name: str,
        description: str,
        function: Callable[..., Any],
    ):
        self.name = name
        self.description = description
        self.function = function

    def run(self, **kwargs):
        return self.function(**kwargs)

    def to_dict(self):
        return {
            "name": self.name,
            "description": self.description,
        }


class ToolRegistry:
    """
    Registry for all tools available to agents.
    """

    def __init__(self):
        self.tools: dict[str, AgentTool] = {}

    def register(self, tool: AgentTool):
        self.tools[tool.name] = tool

    def get(self, tool_name: str) -> AgentTool | None:
        return self.tools.get(tool_name)

    def list_tools(self):
        return [
            tool.to_dict()
            for tool in self.tools.values()
        ]

    def run_tool(
        self,
        tool_name: str,
        **kwargs,
    ):
        tool = self.get(tool_name)

        if tool is None:
            raise ValueError(
                f"Tool not found: {tool_name}"
            )

        return tool.run(**kwargs)