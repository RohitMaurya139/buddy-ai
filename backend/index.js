import express from "express";
import cors from "cors";
import { generate } from "./chatbot.js";
import { chatbot } from "./agent.js";

const app = express();
const port = 3000;

const allowedOrigins = [
  "https://buddy-ai-frontend.vercel.app",
  "https://kajal-buddy-ai.vercel.app",
  "http://localhost:5173",
  "http://localhost:5174",
];

// CORS FIX
app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);

app.use(express.json());

// API ROUTE
app.post("/api/buddy-ai", async (req, res) => {
  try {
    const { input, threadId } = req.body;

    // ❗ FIX 1 — Input validation MUST return
    if (!input || !threadId) {
      return res
        .status(400)
        .json({ message: "input and threadId are required" });
    }

    console.log("User input:", input, "| threadId:", threadId);

    // Process AI
    const aiResponse = await chatbot(input, threadId);

    // ❗ FIX 2 — Return response ONCE
    return res.json({ message: aiResponse });
  } catch (error) {
    console.error("AI Error:", error);

    // ❗ FIX 3 — Prevent "headers already sent"
    if (!res.headersSent) {
      return res
        .status(500)
        .json({ message: "Server error", error: error.message });
    }
  }
});

// START SERVER
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
