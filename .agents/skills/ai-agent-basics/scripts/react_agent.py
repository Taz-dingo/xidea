#!/usr/bin/env python3
"""
Production ReAct Agent Implementation
=====================================

A complete ReAct (Reasoning + Acting) agent using LangGraph.
Demonstrates thought-action-observation loop with tool use.

Requirements:
    pip install langgraph langchain-anthropic

Usage:
    python react_agent.py "What is the weather in Tokyo?"
"""

import sys
from typing import Annotated, TypedDict, Literal
from langgraph.graph import StateGraph, END
from langgraph.graph.message import add_messages
from langchain_core.messages import HumanMessage, AIMessage, ToolMessage


# =============================================================================
# STATE DEFINITION
# =============================================================================

class AgentState(TypedDict):
    """State container for ReAct agent."""
    messages: Annotated[list, add_messages]
    current_step: str
    iteration_count: int
    max_iterations: int


# =============================================================================
# TOOLS
# =============================================================================

TOOLS = [
    {
        "name": "search",
        "description": "Search the web for current information",
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Search query"}
            },
            "required": ["query"]
        }
    },
    {
        "name": "calculator",
        "description": "Perform mathematical calculations",
        "input_schema": {
            "type": "object",
            "properties": {
                "expression": {"type": "string", "description": "Math expression"}
            },
            "required": ["expression"]
        }
    }
]


def execute_tool(tool_name: str, tool_input: dict) -> str:
    """Execute a tool and return result."""
    if tool_name == "search":
        # Simulated search - replace with real API
        return f"Search results for '{tool_input['query']}': [simulated results]"
    elif tool_name == "calculator":
        try:
            # Safe eval for math only
            result = eval(tool_input["expression"], {"__builtins__": {}}, {})
            return f"Result: {result}"
        except Exception as e:
            return f"Error: {e}"
    return f"Unknown tool: {tool_name}"


# =============================================================================
# AGENT NODES
# =============================================================================

def reason_node(state: AgentState) -> AgentState:
    """
    Reasoning node - LLM decides next action.

    This is where the agent thinks about what to do next.
    """
    from langchain_anthropic import ChatAnthropic

    llm = ChatAnthropic(
        model="claude-sonnet-4-20250514",
        max_tokens=1024
    )

    # Create messages with tool definitions
    response = llm.invoke(
        state["messages"],
        tools=TOOLS
    )

    return {
        **state,
        "messages": [response],
        "current_step": "act" if response.tool_calls else "respond",
        "iteration_count": state["iteration_count"] + 1
    }


def act_node(state: AgentState) -> AgentState:
    """
    Action node - Execute tool calls.

    Processes tool calls from the reasoning step.
    """
    last_message = state["messages"][-1]
    tool_messages = []

    for tool_call in last_message.tool_calls:
        result = execute_tool(
            tool_call["name"],
            tool_call["args"]
        )
        tool_messages.append(
            ToolMessage(
                content=result,
                tool_call_id=tool_call["id"]
            )
        )

    return {
        **state,
        "messages": tool_messages,
        "current_step": "reason"
    }


def respond_node(state: AgentState) -> AgentState:
    """
    Response node - Generate final answer.

    Called when no more tools are needed.
    """
    return {
        **state,
        "current_step": "end"
    }


# =============================================================================
# ROUTING
# =============================================================================

def route_after_reason(state: AgentState) -> Literal["act", "respond", "end"]:
    """Route based on reasoning output."""
    # Check iteration limit
    if state["iteration_count"] >= state["max_iterations"]:
        return "respond"

    return state["current_step"]


# =============================================================================
# GRAPH CONSTRUCTION
# =============================================================================

def build_react_agent() -> StateGraph:
    """Build the ReAct agent graph."""

    # Create graph
    graph = StateGraph(AgentState)

    # Add nodes
    graph.add_node("reason", reason_node)
    graph.add_node("act", act_node)
    graph.add_node("respond", respond_node)

    # Set entry point
    graph.set_entry_point("reason")

    # Add edges
    graph.add_conditional_edges(
        "reason",
        route_after_reason,
        {
            "act": "act",
            "respond": "respond",
            "end": END
        }
    )
    graph.add_edge("act", "reason")
    graph.add_edge("respond", END)

    return graph.compile()


# =============================================================================
# MAIN
# =============================================================================

def main():
    """Run the ReAct agent."""
    if len(sys.argv) < 2:
        print("Usage: python react_agent.py '<query>'")
        sys.exit(1)

    query = sys.argv[1]

    # Build agent
    agent = build_react_agent()

    # Initial state
    initial_state = {
        "messages": [HumanMessage(content=query)],
        "current_step": "reason",
        "iteration_count": 0,
        "max_iterations": 5
    }

    # Run agent
    print(f"\n🤖 ReAct Agent")
    print(f"📝 Query: {query}\n")
    print("-" * 50)

    for event in agent.stream(initial_state):
        for node, state in event.items():
            print(f"\n[{node.upper()}]")
            if state.get("messages"):
                last_msg = state["messages"][-1]
                if hasattr(last_msg, "content"):
                    print(f"  {last_msg.content[:200]}...")

    print("\n" + "-" * 50)
    print("✅ Agent completed")


if __name__ == "__main__":
    main()
