"use client";

import { useState } from "react";

// The critical chatbot functionality using AI API to provide maximum user support
export default function Chatbot()
{
  const [messages, setMessages] = useState<{ from: "user" | "bot"; text: string }[]>([]);
  const [input, setInput] = useState("");

  async function sendMessage() {
    if (!input.trim()) return;

    const userMessage = input;
    setMessages((m) => [...m, { from: "user", text: userMessage }]);
    setInput("");

    const res = await fetch("/api/chat", {
      method: "POST",
      body: JSON.stringify({ message: userMessage }),
    });

    const data = await res.json();
    setMessages((m) => [...m, { from: "bot", text: data.reply }]);
  }

  return (
    <div className="border rounded-lg p-3 flex flex-col gap-2 bg-white shadow">
      <div className="h-40 overflow-y-auto border p-2 rounded bg-gray-50">
        {messages.map((m, i) => (
          <div
            key={i}
            className={m.from === "user" ? "text-right text-blue-600" : "text-left text-green-700"}
          >
            {m.text}
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <input
          className="flex-1 border rounded p-2"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask something…"
        />
        <button
          onClick={sendMessage}
          className="bg-black text-white px-3 py-2 rounded"
        >
          Send
        </button>
      </div>
    </div>
  );
}


// There is blank space here in this file