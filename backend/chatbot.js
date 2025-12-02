// Import Groq SDK for interacting with Groq LLM APIs
import Groq from "groq-sdk";

// Import dotenv to load environment variables (API keys)
import dotenv from "dotenv";

// Import Tavily client for realtime web searches
import { tavily } from "@tavily/core";

import NodeCache from "node-cache";

// Load environment variables from .env into process.env
dotenv.config();

// Initialize Tavily search client using API key from environment variables
const tvly = tavily({ apiKey: process.env.TAVILY_API_KEY });

// Initialize Groq LLM client using Groq API key
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const cache = new NodeCache({ stdTTL: 60 * 60 * 24 });//24 hours


// ---------------------------------------------
// MAIN FUNCTION — Handles complete interactive chat flow
// ---------------------------------------------
export async function generate(userMessage,threadId) {
  // Create a readline interface for CLI chat

  // Initial system + conversation setup
  const baseMessages = [
    {
      role: "system",
      content: `You are a smart personal assistant.

 -If you know the answer to a question, answer it directly in plain English.

 -If the answer requires real-time, local, or up-to-date information, or if you don't know the answer, use the available tools to find it

You have access to the following tool:
-webSearch(query: string): Use this to search the internet for current or unknown information.
 -Decide when to use your own knowledge and when to use the tool.
 -Do not mention the tool unless needed.

 Example:

 Q: What is the capital of France?
 A: The capital of France is Paris.


Q: What's the weather in Mumbai right now?
A:(use the search tool to find the latest weather)

Q: who is prime minister of india?
A: the current prime minister of india is Narendra Modi((use the search tool to find the current prime minister)

Q:Tell me latest IT news:
A: (use the search tool to get the latest news)

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

     if (!threadId) threadId = "default-thread";

     let messages = cache.get(threadId);

     if (!messages) {
       messages = JSON.parse(JSON.stringify(baseMessages));
     }
  // Push user message to history
  messages.push({
    role: "user",
    content: userMessage,
  });

  const MODEL_LIST = [
    "meta-llama/llama-4-maverick-17b-128e-instruct", // main model
    "llama-3.1-70b-versatile",
    "meta-llama/llama-4-scout-17b-16e-instruct", // fallback #1
    "llama-3.1-8b-instant", // fallback #2 (fast)
  ];
  async function tryModelFallback(models, messages, groq) {
    let lastError = null;

    for (const model of models) {
      try {
        //   console.log(`🔥 Trying model: ${model}`);

        const completions = await groq.chat.completions.create({
          messages,
          model,
          temperature: 0,
          tool_choice: "auto",
          tools: [
            {
              type: "function",
              function: {
                name: "webSearch",
                description: "Search latest realtime internet data",
                parameters: {
                  type: "object",
                  properties: {
                    query: { type: "string" },
                  },
                  required: ["query"],
                },
              },
            },
          ],
        });

        // console.log(`✅ Success with model: ${model}`);
        return completions;
      } catch (err) {
        console.log(`❌ Model failed (${model}):`, err?.message);
        lastError = err;
      }
    }

    // If ALL models fail → stop and throw
    throw new Error("All models failed. Last error: " + lastError?.message);
  }

  const MAX_RETRIES = 10;
  let count = 0;
  // Inner loop: handles tool calling until the model finishes response
  while (true) {
    if (count > MAX_RETRIES) {
      return 'I could not find the result, please try again'
    }
    count++
    // 1️⃣ SEND MESSAGE WITH MULTIPLE MODEL FALLBACK
    const completions = await tryModelFallback(MODEL_LIST, messages, groq);

    // Save model response to messages
    messages.push(completions.choices[0].message);

    const toolCalls = completions.choices[0].message.tool_calls;

    // 2️⃣ NO TOOL CALL → return final answer
      if (!toolCalls) {
          cache.set(threadId, messages)
          console.log(cache.data);
          
      return completions.choices[0].message.content;
    }

    // 3️⃣ HANDLE TOOL CALL(S)
    for (const tool of toolCalls) {
      const functionName = tool.function.name;
      const functionParamsRaw = tool.function.arguments.trim();

      let parsedParams;
      try {
        parsedParams = JSON.parse(functionParamsRaw);
      } catch (err) {
        console.error("❌ Model returned invalid JSON:", functionParamsRaw);
        throw err;
      }

      if (functionName === "webSearch") {
        const toolResult = await webSearch(parsedParams);

        messages.push({
          tool_call_id: tool.id,
          role: "tool",
          name: functionName,
          content: JSON.stringify(toolResult),
        });
      }
    }
  }
}

// ---------------------------------------------
// TOOL FUNCTION IMPLEMENTATION (webSearch)
// ---------------------------------------------
async function webSearch({ query }) {
  // Debug log for developers
//   console.log("Calling web search with query:", query);

  // Perform Tavily realtime internet search
  const response = await tvly.search(query);

  // Extract only text content from all results
  const finalResponse = response.results.map((res) => res.content);

  // Join all text blocks into a single response
  return finalResponse.join("\n\n");
}
