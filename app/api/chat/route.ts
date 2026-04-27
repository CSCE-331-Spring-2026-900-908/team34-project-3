import { NextRequest, NextResponse } from "next/server";

import { getChatTrendSummary } from "@/lib/db/chat-insights";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type CartItem = {
  cartIndex?: number;
  itemName: string;
  quantity: number;
  sweetness: number;
  ice: number;
  cost: number;
  ingredientChoices: Array<{
    name: string;
    quantity: number;
  }>;
};

type MenuItem = {
  name: string;
  cost: number;
};

type Ingredient = {
  name: string;
  addCost: number;
};

type WeatherContext = {
  locationName?: string;
  description?: string;
  temperatureF?: number | null;
  feelsLikeF?: number | null;
  humidity?: number | null;
  windMph?: number | null;
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

const validSweetnessLevels = [0, 25, 50, 75, 100, 125] as const;
const validIceLevels = [0, 1, 2, 3] as const;

function formatMoney(amount: number) {
  return `$${amount.toFixed(2)}`;
}

function userSpecifiedSweetness(message: string) {
  return /\b(sweet|sweetness|sugar)\b/i.test(message);
}

function userSpecifiedIce(message: string) {
  return /\bice\b/i.test(message);
}

function normalizeAction(action: ChatAction | undefined, message: string): ChatAction {
  if (!action || action.type === "none") {
    return { type: "none" };
  }

  if (action.type === "edit_cart_item") {
    return action;
  }

  const sweetnessSource = userSpecifiedSweetness(message) ? action.sweetness : 100;
  const normalizedSweetness = validSweetnessLevels.includes(sweetnessSource as (typeof validSweetnessLevels)[number])
    ? sweetnessSource
    : 100;

  const iceSource = userSpecifiedIce(message) ? action.ice : 2;
  const normalizedIce = validIceLevels.includes(iceSource as (typeof validIceLevels)[number]) ? iceSource : 2;

  return {
    ...action,
    sweetness: normalizedSweetness,
    ice: normalizedIce
  };
}

function describeIceLevel(ice: number) {
  switch (ice) {
    case 0:
      return "No Ice";
    case 1:
      return "Light Ice";
    case 2:
      return "Regular Ice";
    case 3:
      return "Extra Ice";
    default:
      return `Ice Level ${ice}`;
  }
}

function buildMenuSummary(menuItems: MenuItem[]) {
  if (menuItems.length === 0) {
    return "No menu items were provided.";
  }

  return menuItems.map((item) => `${item.name} (${formatMoney(item.cost)})`).join(", ");
}

function buildCartSummary(cartItems: CartItem[]) {
  if (cartItems.length === 0) {
    return "The cart is currently empty.";
  }

  const lines = cartItems.map((item) => {
    const extras =
      item.ingredientChoices.length > 0
        ? item.ingredientChoices.map((choice) => `${choice.name} x${choice.quantity}`).join(", ")
        : "no extras";

    return [
      `cart line ${item.cartIndex ?? 0}`,
      `${item.quantity}x ${item.itemName}`,
      `sweetness ${item.sweetness}%`,
      describeIceLevel(item.ice),
      extras,
      `line total ${formatMoney(item.cost)}`
    ].join(" | ");
  });

  const total = cartItems.reduce((sum, item) => sum + item.cost, 0);
  return `${lines.join("\n")}\nCart total: ${formatMoney(total)}`;
}

function buildIngredientSummary(ingredients: Ingredient[]) {
  if (ingredients.length === 0) {
    return "No extra ingredients were provided.";
  }

  return ingredients.map((ingredient) => `${ingredient.name} (${formatMoney(ingredient.addCost)})`).join(", ");
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      message?: string;
      history?: ChatMessage[];
      cartItems?: CartItem[];
      menuItems?: MenuItem[];
      ingredients?: Ingredient[];
      weather?: WeatherContext | null;
    };

    const message = body.message?.trim();
    const history = Array.isArray(body.history) ? body.history.slice(-8) : [];
    const cartItems = Array.isArray(body.cartItems) ? body.cartItems : [];
    const menuItems = Array.isArray(body.menuItems) ? body.menuItems : [];
    const ingredients = Array.isArray(body.ingredients) ? body.ingredients : [];
    const weather = body.weather && typeof body.weather === "object" ? body.weather : null;

    if (!message) {
      return NextResponse.json({ reply: "Please type a boba shop question first." }, { status: 400 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        {
          reply: "The chatbot is not configured yet because `OPENAI_API_KEY` is missing."
        },
        { status: 500 }
      );
    }

    let trendSummary = "Consumer trend data is currently unavailable.";

    try {
      trendSummary = await getChatTrendSummary(cartItems.map((item) => item.itemName));
    } catch {
      // If trend retrieval fails, continue with core chat functionality.
    }

    const systemPrompt = [
      "You are Pearl, a friendly and knowledgeable boba shop employee helping inside a POS system.",
      "Only help with boba shop topics such as drinks, toppings, sweetness, ice, cart review, recommendations, upsells, and menu guidance.",
      "If the user asks for something unrelated to a boba shop, politely refuse and redirect to menu, drink, topping, or order questions.",
      "Use the current cart and menu context when answering.",
      "When the user asks for suggestions, recommend specific drinks or add-ons from the menu and explain why they fit.",
      "Use the provided consumer trend snapshot from the live database to ground recommendation answers.",
      "Treat trend data as a preference signal, then tailor to the user's request and weather.",
      "If the user asks for a generic recommendation and weather context is available, tailor the recommendation to the current weather.",
      "On hot weather, prefer refreshing, lighter, or icy drinks first. On cooler weather, prefer richer, creamier, or comforting drinks first.",
      "If the cart already has items, suggest complementary drinks, topping tweaks, or sweetness/ice adjustments.",
      "You may help add drinks to the cart by returning an add_to_cart action only when the user clearly asks to add an item.",
      "You may help edit an existing cart drink by returning an edit_cart_item action when the user clearly asks to change a drink already in the cart.",
      "Use the provided cart line number to target the correct existing drink.",
      "Only use exact menu item names and exact extra ingredient names from the provided lists.",
      "When creating add_to_cart actions, assume sweetness 100 and ice 2 (regular ice) unless the user explicitly asks for different sweetness or ice.",
      "If details like quantity or extras are not specified, use sensible defaults: quantity 1 and extras [].",
      "If the user is ambiguous about which drink to add, ask a follow-up question instead of creating an action.",
      "If the user is ambiguous about which cart item to edit, ask a follow-up question instead of creating an action.",
      "Do not invent unavailable products or claim to complete payment, modify inventory, or place orders yourself.",
      "Keep answers short, warm, and practical, like an employee helping a customer at the counter.",
      'Return valid JSON with this shape: {"reply":"string","action":{"type":"none"}}, {"reply":"string","action":{"type":"add_to_cart","itemName":"string","quantity":1,"sweetness":100,"ice":2,"extras":[{"name":"Boba","quantity":1}]}} or {"reply":"string","action":{"type":"edit_cart_item","cartIndex":1,"itemName":"Taro Milk Tea","quantity":2,"sweetness":50,"ice":1,"extras":[{"name":"Boba","quantity":1}]}}.',
      `Menu items: ${buildMenuSummary(menuItems)}`,
      `Available extra ingredients: ${buildIngredientSummary(ingredients)}`,
      `Current cart:\n${buildCartSummary(cartItems)}`,
      `Consumer trend snapshot (retrieved from order history):\n${trendSummary}`,
      weather
        ? `Current local weather: ${weather.locationName ?? "Unknown location"} | ${weather.description ?? "Unknown conditions"} | temperature ${weather.temperatureF ?? "unknown"}F | feels like ${weather.feelsLikeF ?? "unknown"}F | humidity ${weather.humidity ?? "unknown"}% | wind ${weather.windMph ?? "unknown"} mph`
        : "Current local weather: unavailable."
    ].join("\n");

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.7,
        max_tokens: 350,
        response_format: {
          type: "json_object"
        },
        messages: [
          { role: "system", content: systemPrompt },
          ...history.map((entry) => ({
            role: entry.role,
            content: entry.content
          })),
          { role: "user", content: message }
        ]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      const apiError =
        typeof data?.error?.message === "string"
          ? data.error.message
          : "The AI service could not answer right now.";

      return NextResponse.json(
        {
          reply: `I'm having trouble reaching the boba assistant right now. ${apiError}`
        },
        { status: response.status }
      );
    }

    const content = data.choices?.[0]?.message?.content;
    let parsed: { reply?: string; action?: ChatAction } | null = null;

    if (typeof content === "string") {
      try {
        parsed = JSON.parse(content) as { reply?: string; action?: ChatAction };
      } catch {
        parsed = { reply: content, action: { type: "none" } };
      }
    }

    const reply = parsed?.reply?.trim();
    const action = normalizeAction(parsed?.action, message);

    return NextResponse.json({
      reply:
        reply ??
        "I can help with drinks, toppings, cart questions, and boba suggestions. What would you like to order?",
      action
    });
  } catch {
    return NextResponse.json(
      {
        reply: "Something went wrong while handling that chat request. Please try again."
      },
      { status: 500 }
    );
  }
}
