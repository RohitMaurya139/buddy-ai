import { useState, useRef, useEffect } from "react";
import { ArrowUp, Sparkles, MessageSquare } from "lucide-react";
import axios from 'axios'
function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const base_url= import.meta.env.VITE_API_URL;
 const [threadId] = useState(() => {
   const saved = sessionStorage.getItem("threadId");
   if (saved) return saved;

   const newId =
     Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
   sessionStorage.setItem("threadId", newId);
   return newId;
 });


  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userInput = input;
    setMessages((prev) => [...prev, { role: "user", text: userInput }]);
    setInput("");
    setIsTyping(true);

    try {
      const response = await axios.post(
        `${base_url}/api/buddy-ai`,
        { input: userInput,threadId },
        { withCredentials: true }
      );

      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: response.data.message || response.data },
      ]);
    } catch (err) {
      console.error(err);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: "❌ Server error. Try again." },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="w-screen h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white flex flex-col">
      {/* NAVBAR */}
      <nav className="backdrop-blur-xl bg-slate-900/50 border-b border-slate-800/50 px-6 py-4 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <div className="bg-gradient-to-br from-violet-500 to-fuchsia-500 p-2 rounded-xl shadow-lg shadow-violet-500/20">
            <Sparkles className="w-5 h-5" />
          </div>
          <span className="text-xl font-bold bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
            Buddy AI
          </span>
        </div>
      </nav>

      {/* CHAT AREA */}
      <div className="flex-1 overflow-y-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-6">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center py-20">
              <div className="bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 p-6 rounded-3xl mb-6 backdrop-blur-sm border border-violet-500/30">
                <MessageSquare className="w-12 h-12 text-violet-400 mx-auto" />
              </div>
              <h2 className="text-3xl font-bold mb-3 bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
                How can I help you today?
              </h2>
              <p className="text-slate-400 text-sm max-w-md">
                Ask me anything and I'll do my best to assist you
              </p>
            </div>
          )}

          {messages.map((msg, index) => (
            <div
              key={index}
              className={`flex items-start gap-3 animate-in fade-in slide-in-from-bottom-4 duration-500 ${
                msg.role === "user" ? "flex-row-reverse" : ""
              }`}
            >
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  msg.role === "user"
                    ? "bg-gradient-to-br from-blue-500 to-cyan-500 shadow-lg shadow-blue-500/30"
                    : "bg-gradient-to-br from-violet-500 to-fuchsia-500 shadow-lg shadow-violet-500/30"
                }`}
              >
                {msg.role === "user" ? (
                  <span className="text-sm font-bold">U</span>
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
              </div>

              <div
                className={`px-5 py-3 rounded-2xl max-w-[75%] text-sm leading-relaxed backdrop-blur-sm ${
                  msg.role === "user"
                    ? "bg-gradient-to-br from-blue-600/90 to-cyan-600/90 shadow-lg shadow-blue-500/20 border border-blue-400/30"
                    : "bg-slate-800/80 shadow-lg border border-slate-700/50"
                }`}
              >
                {msg.text}
              </div>
            </div>
          ))}

          {isTyping && (
            <div className="flex items-start gap-3 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 shadow-lg shadow-violet-500/30 flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="px-5 py-3 rounded-2xl bg-slate-800/80 backdrop-blur-sm border border-slate-700/50">
                <div className="flex gap-1.5">
                  <div
                    className="w-2 h-2 bg-violet-400 rounded-full animate-bounce"
                    style={{ animationDelay: "0ms" }}
                  ></div>
                  <div
                    className="w-2 h-2 bg-violet-400 rounded-full animate-bounce"
                    style={{ animationDelay: "150ms" }}
                  ></div>
                  <div
                    className="w-2 h-2 bg-violet-400 rounded-full animate-bounce"
                    style={{ animationDelay: "300ms" }}
                  ></div>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* INPUT AREA */}
      <div className="p-4 pb-6">
        <div className="max-w-4xl mx-auto">
          <div className="relative group">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-violet-500 to-fuchsia-500 rounded-2xl opacity-30 group-hover:opacity-50 blur transition duration-300"></div>
            <div className="relative flex items-start gap-3  bg-slate-800/95 backdrop-blur-xl rounded-2xl p-4 border border-slate-700/50 shadow-2xl">
              <textarea
                ref={textareaRef}
                className="flex-1 bg-transparent outline-none resize-none text-sm placeholder-slate-400 max-h-32 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent"
                rows="1"
                placeholder="Type your message... (Shift+Enter for new line)"
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  e.target.style.height = "auto";
                  e.target.style.height = e.target.scrollHeight + "px";
                }}
                onKeyDown={handleKeyDown}
              />

              <button
                onClick={handleSend}
                disabled={!input.trim() || isTyping}
                className="bg-gradient-to-br from-violet-500 to-fuchsia-500 hover:from-violet-600 hover:to-fuchsia-600 disabled:from-slate-700 disabled:to-slate-700 disabled:cursor-not-allowed transition-all duration-300 p-2.5 rounded-xl text-sm font-medium flex items-center justify-center shadow-lg shadow-violet-500/30 hover:shadow-violet-500/50 hover:scale-105 active:scale-95"
              >
                <ArrowUp className="w-5 h-5" />
              </button>
            </div>
          </div>
          <p className="text-xs text-slate-500 text-center mt-3">
            Buddy AI can make mistakes. Consider checking important information.
          </p>
          <p className="text-xs text-slate-500 text-center mt-3 flex items-center justify-center gap-2">
            Made with ❤ by{" "}
            <a
              href="https://rm-portfolio-zeta.vercel.app/"
              className="text-blue-500"
            >
              Rohit Maurya
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

export default App;
