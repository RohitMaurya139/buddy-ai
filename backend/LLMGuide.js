// Import Groq SDK for interacting with Groq LLM APIs
import Groq from "groq-sdk";

// Import readline for interactive command-line input
import readline from "node:readline/promises";

// Import dotenv to load environment variables (API keys)
import dotenv from "dotenv";

// Import Tavily client for realtime web searches
import { tavily } from "@tavily/core";

// Load environment variables from .env into process.env
dotenv.config();

// Initialize Tavily search client using API key from environment variables
const tvly = tavily({ apiKey: process.env.TAVILY_API_KEY });

// Initialize Groq LLM client using Groq API key
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// ---------------------------------------------
// MAIN FUNCTION — Handles complete interactive chat flow
// ---------------------------------------------
export async function main() {
  // Create a readline interface for CLI chat
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  // Initial system + conversation setup
  const messages = [
    {
      role: "system",
      content: `
You are Rocky Maurya, a smart personal assistant.

TOOLS AVAILABLE:
- webSearch: Search the latest realtime information.
- current datetime: ${new Date().toUTCString()}

TOOL CALLING RULES:
- Use ONLY standard Groq/OpenAI tool calling.
- NEVER write <function>...</function>.
- NEVER write XML or HTML.
- NEVER write code examples.
- When calling a tool, arguments must ALWAYS be valid JSON like:
  {"query": "something"}
- The arguments field MUST be pure JSON only.
- Do NOT wrap arguments in parentheses.
- Do NOT add text before or after JSON.
`,
    },
  ];

  // Outer loop: keeps taking new user input
  while (true) {
    const question = await rl.question("You: ");

    // Exit command
    if (question === "bye") break;

    // Push user message to history
    messages.push({
      role: "user",
      content: question,
    });

    // Inner loop: handles tool calling until the model finishes response
    while (true) {
      // ---------------------------------------------
      // 1️⃣ SEND MESSAGE TO LLM
      // ---------------------------------------------
      const completions = await groq.chat.completions.create({
        messages, // entire conversation history
        model: "llama-3.3-70b-versatile",
        temperature: 0, // deterministic result
        tool_choice: "auto", // allow model to decide tool usage

        // Define available tools for LLM
        tools: [
          {
            type: "function",
            function: {
              name: "webSearch",
              description: "Search latest realtime internet data",
              parameters: {
                type: "object",
                properties: {
                  query: { type: "string" }, // The search query string
                },
                required: ["query"],
              },
            },
          },
        ],
      });

      // Save model output message to conversation history
      messages.push(completions.choices[0].message);

      // Extract toolCalls if the model decided to use a tool
      const toolCalls = completions.choices[0].message.tool_calls;

      // ---------------------------------------------
      // 2️⃣ IF NO TOOL CALL — MODEL IS ANSWERING DIRECTLY
      // ---------------------------------------------
      if (!toolCalls) {
        console.log("Assistant:", completions.choices[0].message.content);
        break; // Exit inner loop, go back to user input
      }

      // ---------------------------------------------
      // 3️⃣ HANDLE TOOL CALL(S)
      // ---------------------------------------------
      for (const tool of toolCalls) {
        // Extract tool name (example: "webSearch")
        const functionName = tool.function.name;

        // Raw argument string returned by model
        const functionParamsRaw = tool.function.arguments.trim();

        // Convert raw arguments to valid JSON
        let parsedParams;
        try {
          parsedParams = JSON.parse(functionParamsRaw);
        } catch (err) {
          console.error("❌ Model returned invalid JSON:", functionParamsRaw);
          throw err; // Stop execution on invalid JSON
        }

        // ---------------------------------------------
        // Execute our tool implementation
        // ---------------------------------------------
        if (functionName === "webSearch") {
          const toolResult = await webSearch(parsedParams);

          // Push tool result back into conversation so LLM can use it
          messages.push({
            tool_call_id: tool.id, // MUST match ID provided by LLM
            role: "tool", // Required role
            name: functionName, // Same tool name
            content: JSON.stringify(toolResult), // Tool result must be a string
          });
        }
      }
    }
  }

  // Close CLI input
  rl.close();
}

// Run main() automatically when this file is executed
main();

// ---------------------------------------------
// TOOL FUNCTION IMPLEMENTATION (webSearch)
// ---------------------------------------------
async function webSearch({ query }) {
  // Debug log for developers
  console.log("Calling web search with query:", query);

  // Perform Tavily realtime internet search
  const response = await tvly.search(query);

  // Extract only text content from all results
  const finalResponse = response.results.map((res) => res.content);

  // Join all text blocks into a single response
  return finalResponse.join("\n\n");
}
