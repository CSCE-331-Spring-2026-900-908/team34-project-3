"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { TouchscreenInput } from "@/components/touchscreen-input";
import { useOrderStore } from "@/lib/stores/order-store";
import type { IngredientRecord, MenuItemRecord, OrderItemInput } from "@/lib/types";

type ChatbotProps = {
  cartItems: OrderItemInput[];
  ingredients: IngredientRecord[];
  menuItems: MenuItemRecord[];
  onKeyboardOpenChange?: (open: boolean) => void;
};

type WeatherContext = {
  locationName: string;
  description: string;
  temperatureF: number | null;
  feelsLikeF: number | null;
  humidity: number | null;
  windMph: number | null;
};

type ChatAction =
  | {
      type: "none";
    }
  | {
      type: "add_to_cart";
      itemName: string;
      quantity?: number;
      sweetness?: number;
      ice?: number;
      extras?: Array<{
        name: string;
        quantity?: number;
      }>;
    }
  | {
      type: "edit_cart_item";
      cartIndex: number;
      itemName?: string;
      quantity?: number;
      sweetness?: number;
      ice?: number;
      extras?: Array<{
        name: string;
        quantity?: number;
      }>;
    };

function normalizeName(value: string) {
  return value.trim().toLowerCase();
}

export default function Chatbot({ cartItems, ingredients, menuItems, onKeyboardOpenChange }: ChatbotProps) {
  const addItem = useOrderStore((state) => state.addItem);
  const updateItem = useOrderStore((state) => state.updateItem);
  const [messages, setMessages] = useState<{ from: "user" | "bot"; text: string }[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [weather, setWeather] = useState<WeatherContext | null>(null);

  useEffect(() => {
    if (!("geolocation" in navigator)) {
      return;
    }

    let cancelled = false;

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const params = new URLSearchParams({
            lat: String(position.coords.latitude),
            lon: String(position.coords.longitude)
          });

          const response = await fetch(`/api/weather/current?${params.toString()}`, {
            cache: "no-store"
          });

          const payload = (await response.json().catch(() => null)) as WeatherContext | { error?: string } | null;

          if (!response.ok || !payload || typeof payload !== "object" || !("locationName" in payload)) {
            return;
          }

          if (!cancelled) {
            setWeather(payload as WeatherContext);
          }
        } catch {
          // Weather context is optional for chat recommendations.
        }
      },
      () => {
        // Geolocation is optional for chat recommendations.
      },
      {
        enableHighAccuracy: false,
        timeout: 10000,
        maximumAge: 5 * 60 * 1000
      }
    );

    return () => {
      cancelled = true;
    };
  }, []);

  function buildIngredientChoices(extras: Array<{ name: string; quantity?: number }>) {
    return extras
      .map((extra) => {
        const ingredient = ingredients.find((item) => normalizeName(item.name) === normalizeName(extra.name));

        if (!ingredient) {
          return null;
        }

        return {
          ingredientId: ingredient.id,
          quantity: Math.max(1, Math.min(10, Math.round(extra.quantity ?? 1))),
          addCost: ingredient.addCost,
          name: ingredient.name
        };
      })
      .filter((choice): choice is NonNullable<typeof choice> => choice !== null);
  }

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
          cartItems: cartItems.map((item, index) => ({
            cartIndex: index + 1,
            ...item
          })),
          ingredients: ingredients.map((ingredient) => ({
            name: ingredient.name,
            addCost: ingredient.addCost
          })),
          menuItems: menuItems.map((item) => ({
            name: item.name,
            cost: item.cost
          })),
          weather
        })
      });

      const data = (await res.json()) as { reply?: string; action?: ChatAction };
      setMessages((m) => [
        ...m,
        {
          from: "bot",
          text: data.reply ?? "I can help with boba drinks, toppings, and cart suggestions."
        }
      ]);
      const action = data.action;

      if (action?.type === "add_to_cart") {
        const menuItem = menuItems.find((item) => normalizeName(item.name) === normalizeName(action.itemName));

        if (!menuItem) {
          setMessages((m) => [
            ...m,
            {
              from: "bot",
              text: `I couldn't add "${action.itemName}" because it isn't on the current menu.`
            }
          ]);
          return;
        }

        const quantity = Math.max(1, Math.min(20, Math.round(action.quantity ?? 1)));
        const sweetness = [0, 25, 50, 75, 100, 125].includes(action.sweetness ?? 100)
          ? (action.sweetness ?? 100)
          : 100;
        const ice = [0, 1, 2, 3].includes(action.ice ?? 2) ? (action.ice ?? 2) : 2;

        const ingredientChoices = buildIngredientChoices(action.extras ?? []);

        const addOnCost = ingredientChoices.reduce((sum, choice) => sum + choice.addCost * choice.quantity, 0);

        addItem({
          itemId: menuItem.id,
          itemName: menuItem.name,
          quantity,
          sweetness,
          ice,
          size: 0,
          ingredientChoices,
          cost: (menuItem.cost + addOnCost) * quantity
        });

        toast.success(`${menuItem.name} added to cart from chat.`);
      }

      if (action?.type === "edit_cart_item") {
        const itemIndex = action.cartIndex - 1;
        const existingItem = cartItems[itemIndex];

        if (!existingItem) {
          setMessages((m) => [
            ...m,
            {
              from: "bot",
              text: `I couldn't find cart line ${action.cartIndex} to update.`
            }
          ]);
          return;
        }

        const nextItemName = action.itemName ?? existingItem.itemName;
        const menuItem = menuItems.find((item) => normalizeName(item.name) === normalizeName(nextItemName));

        if (!menuItem) {
          setMessages((m) => [
            ...m,
            {
              from: "bot",
              text: `I couldn't update that drink because "${nextItemName}" isn't on the current menu.`
            }
          ]);
          return;
        }

        const quantity = Math.max(1, Math.min(20, Math.round(action.quantity ?? existingItem.quantity)));
        const sweetnessSource = action.sweetness ?? existingItem.sweetness;
        const sweetness = [0, 25, 50, 75, 100, 125].includes(sweetnessSource) ? sweetnessSource : existingItem.sweetness;
        const iceSource = action.ice ?? existingItem.ice;
        const ice = [0, 1, 2, 3].includes(iceSource) ? iceSource : existingItem.ice;

        const ingredientChoices =
          action.extras !== undefined
            ? buildIngredientChoices(action.extras)
            : existingItem.ingredientChoices;

        const addOnCost = ingredientChoices.reduce((sum, choice) => sum + choice.addCost * choice.quantity, 0);

        updateItem(itemIndex, {
          itemId: menuItem.id,
          itemName: menuItem.name,
          quantity,
          sweetness,
          ice,
          size: existingItem.size,
          ingredientChoices,
          cost: (menuItem.cost + addOnCost) * quantity
        });

        toast.success(`Cart line ${action.cartIndex} updated from chat.`);
      }
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
      <div className="h-40 overflow-y-auto rounded border bg-gray-50 p-2">
        {messages.map((m, i) => (
          <div key={i} className={`mb-2 flex ${m.from === "user" ? "justify-end" : "justify-start"}`}>
            <p
              className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                m.from === "user" ? "border border-stone-200 bg-white text-black" : "bg-black text-white"
              }`}
            >
              {m.text}
            </p>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <TouchscreenInput
          className="flex-1 border rounded p-2"
          value={input}
          onValueChange={setInput}
          onKeyboardOpenChange={onKeyboardOpenChange}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              void sendMessage();
            }
          }}
          placeholder="Ask something..."
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
