"use client";

import { useState } from "react";

import type { MenuItemRecord, OrderItemInput } from "@/lib/types";

type ChatbotProps = {
  cartItems: OrderItemInput[];
  menuItems: MenuItemRecord[];
};

export default function Chatbot({ cartItems, menuItems }: ChatbotProps) {
  const [messages, setMessages] = useState<{ from: "user" | "bot"; text: string }[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);

  async function sendMessage() {
    if (!input.trim() || isSending) return;

    const userMessage = input.trim();
    const nextMessages = [...messages, { from: "user" as const, text: userMessage }];

    setIsSending(true);
    setMessages((m) => [...m, { from: "user", text: userMessage }]);
    setInput("");

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          message: userMessage,
          history: nextMessages.slice(-8).map((message) => ({
            role: message.from === "user" ? "user" : "assistant",
            content: message.text
          })),
          cartItems,
          menuItems: menuItems.map((item) => ({
            name: item.name,
            cost: item.cost
          }))
        })
      });

      const data = (await res.json()) as { reply?: string };
      setMessages((m) => [
        ...m,
        {
          from: "bot",
          text: data.reply ?? "I can help with boba drinks, toppings, and cart suggestions."
        }
      ]);
    } catch {
      setMessages((m) => [
        ...m,
        {
          from: "bot",
          text: "I’m having trouble answering right now, but I can still help with boba menu questions in a moment."
        }
      ]);
    } finally {
      setIsSending(false);
    }
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
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              void sendMessage();
            }
          }}
          placeholder="Ask something…"
        />
        <button
          onClick={() => void sendMessage()}
          disabled={isSending}
          className="bg-black text-white px-3 py-2 rounded disabled:opacity-60"
        >
          {isSending ? "..." : "Send"}
        </button>
      </div>
    </div>
  );
}
