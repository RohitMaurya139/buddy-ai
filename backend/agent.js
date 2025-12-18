// Load environment variables from .env file
import dotenv from "dotenv";
dotenv.config();

// Groq-hosted LLM wrapper (OpenAI-compatible interface)
import { ChatGroq } from "@langchain/groq";

// Built-in web search tool (Tavily)
import { TavilySearch } from "@langchain/tavily";

// ToolNode → executes tool calls requested by the LLM
import { ToolNode } from "@langchain/langgraph/prebuilt";


// LangGraph utilities for building message-based agent graphs
import {
  MemorySaver, // Persists conversation state
  MessagesAnnotation, // Standard message state schema
  StateGraph, // Graph builder
} from "@langchain/langgraph";

// Standardized human message wrapper
import { HumanMessage, SystemMessage } from "@langchain/core/messages";




/* -------------------------------
   Memory Configuration
-------------------------------- */

// MemorySaver stores conversation history per thread_id
// Enables multi-turn conversations
const checkpointer = new MemorySaver();

/* -------------------------------
   1️⃣ LLM Configuration
-------------------------------- */

// Initialize Groq LLM
// temperature: 0 → deterministic responses (best for tools & reasoning)
const model = new ChatGroq({
  model: "openai/gpt-oss-120b",
  temperature: 0,
});

/* -------------------------------
   2️⃣ Tools Definition
-------------------------------- */

// Web search tool for factual / real-time queries
const search = new TavilySearch({
  maxResults: 3, // Limit results to reduce noise
  topic: "general", // General-purpose search
});

// Register all tools in a single array
const tools = [search];

/* -------------------------------
   3️⃣ Bind Tools to LLM
-------------------------------- */

// Enables the LLM to:
// 1. Decide when a tool is needed
// 2. Emit structured tool_calls
const modelWithTools = model.bindTools(tools);

/* -------------------------------
   4️⃣ Tool Execution Node
-------------------------------- */

// ToolNode automatically executes tool calls
// and appends tool results back into the message state
const toolNode = new ToolNode(tools);

/* -------------------------------
   5️⃣ LLM Node
-------------------------------- */

// This node:
// - Sends conversation history to the LLM
// - Receives assistant response (may include tool_calls)
async function callModel(state) {
  console.log("🤖 Calling LLM...");

  // Invoke the model with full message history
  const response = await modelWithTools.invoke(state.messages);

  // Return response to be merged into LangGraph state
  return { messages: [response] };
}

/* -------------------------------
   6️⃣ Routing Logic
-------------------------------- */

// Determines next step after LLM response
function shouldContinue(state) {
  // Get the most recent message
  const lastMessage = state.messages[state.messages.length - 1];

  // If LLM requested one or more tool calls → route to ToolNode
  if (lastMessage.tool_calls && lastMessage.tool_calls.length > 0) {
    return "Tools";
  }

  // Otherwise, stop execution
  return "__end__";
}

/* -------------------------------
   7️⃣ Build LangGraph
-------------------------------- */

// Create a message-driven state graph
const graph = new StateGraph(MessagesAnnotation)
  .addNode("LLMs", callModel) // LLM reasoning node
  .addNode("Tools", toolNode) // Tool execution node
  .addEdge("__start__", "LLMs") // Entry point
  .addEdge("Tools", "LLMs") // Loop back after tool execution
  .addConditionalEdges("LLMs", shouldContinue); // Dynamic routing

// Compile graph into a runnable agent
// checkpointer enables memory across invocations
const app = graph.compile({ checkpointer });

/* -------------------------------
   8️⃣ Chatbot Entry Function
-------------------------------- */
const SYSTEM_PROMPT = `
You are a smart personal assistant.

- If you know the answer, respond directly in plain English.
- If the answer requires real-time, local, or up-to-date information, use the available tools.
- Decide intelligently when to use tools.
- Never mention tools unless required.

Current datetime: ${new Date().toUTCString()}

TOOL CALLING RULES:
- Use ONLY standard Groq/OpenAI tool calling
- Arguments must be valid JSON
- No XML, HTML, or <function> tags
`;

// Exposed function used by backend / API
export async function chatbot(userMessage, threadId) {
  // thread_id ensures memory is scoped per user/session
  const config = {
    configurable: { thread_id: threadId },
  };

  // Invoke the agent with the user's message
  const result = await app.invoke(
    {
      messages: [
        new SystemMessage(SYSTEM_PROMPT),
        new HumanMessage(userMessage),
      ],
    },
    config
  );

  // Return the final assistant reply
  const messages = result.messages;
  return messages[messages.length - 1].content;
}
