import { useState, useRef, useEffect } from "react";
import { useAuthenticator } from "@aws-amplify/ui-react";
import Groq from "groq-sdk";
import "./ChatSidebar.css";

const SYSTEM_PROMPT = `You are an AI assistant for CoTune, a control systems education and experimentation platform.
You help students and researchers understand:
- Control theory: PID, LQR, MPC controllers and how to tune them
- Physical systems: inverted pendulum, Furuta pendulum, quadrotor (drone), suspension systems
- Parameter tuning and optimization strategies
- Real-time experiment data interpretation
- Mathematical concepts related to control systems (state space, transfer functions, stability)
- URDF integration for simulation
- Be very concise and to the point

Be clear, educational, concise, and brief. Use examples and equations "when helpful".`;

const WELCOME_MESSAGE = "Hi! I'm your CoTune AI assistant. Ask me anything about control systems, parameters tuning, experiments, or the platform!";

function ChatSidebar() {
  const { user } = useAuthenticator();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: "assistant", text: WELCOME_MESSAGE },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const historyRef = useRef([]);
  const groqRef = useRef(null);

  useEffect(() => {
    groqRef.current = new Groq({
      apiKey: process.env.REACT_APP_GROQ_API_KEY,
      dangerouslyAllowBrowser: true,
    });
  }, []);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isLoading, isOpen]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userText = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", text: userText }]);
    setIsLoading(true);

    historyRef.current = [...historyRef.current, { role: "user", content: userText }];

    try {
      const completion = await groqRef.current.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...historyRef.current,
        ],
        max_tokens: 1024,
      });

      const responseText = completion.choices[0].message.content;
      historyRef.current = [...historyRef.current, { role: "assistant", content: responseText }];
      setMessages((prev) => [...prev, { role: "assistant", text: responseText }]);
    } catch (err) {
      console.error("Groq error:", err);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: `Error: ${err.message || "Unknown error"}`,
          isError: true,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearChat = () => {
    setMessages([{ role: "assistant", text: WELCOME_MESSAGE }]);
    historyRef.current = [];
  };

  if (!user) return null;

  return (
    <>
      {/* Floating toggle button */}
      <button
        className={`chat-fab ${isOpen ? "open" : ""}`}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label="Toggle AI Assistant"
      >
        {isOpen ? "❌" : "🤖"}
      </button>

      {/* Backdrop (mobile only) */}
      {isOpen && <div className="chat-backdrop" onClick={() => setIsOpen(false)} />}

      {/* Sidebar panel */}
      <div className={`chat-sidebar ${isOpen ? "open" : ""}`}>
        <div className="chat-sidebar-header">
          <div className="chat-sidebar-header-left">
            <span className="chat-sidebar-icon">🤖</span>
            <div>
              <h3>AI Assistant</h3>
              <p>Powered by Groq AI</p>
            </div>
          </div>
          <div className="chat-sidebar-actions">
            <button className="chat-action-btn" onClick={clearChat} title="Clear Chat">
              🗑️
            </button>
            <button className="chat-action-btn" onClick={() => setIsOpen(false)} title="Close">
              ❌
            </button>
          </div>
        </div>

        <div className="chat-sidebar-messages">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`chat-bubble ${msg.role === "user" ? "user" : "ai"}${msg.isError ? " error" : ""}`}
            >
              {msg.role !== "user" && <div className="bubble-label">CoTune AI</div>}
              <div className="bubble-text">{msg.text}</div>
            </div>
          ))}

          {isLoading && (
            <div className="chat-bubble ai">
              <div className="bubble-label">CoTune AI</div>
              <div className="bubble-typing">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        <div className="chat-sidebar-input">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything... (Enter to send)"
            rows={1}
            disabled={isLoading}
          />
          <button
            className="chat-send-btn"
            onClick={sendMessage}
            disabled={isLoading || !input.trim()}
             title="Send"
          >
            ▶️
          </button>
        </div>
      </div>
    </>
  );
}

export default ChatSidebar;
