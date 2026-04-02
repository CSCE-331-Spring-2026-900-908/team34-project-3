import { NextRequest, NextResponse } from "next/server";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type CartItem = {
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

function formatMoney(amount: number) {
  return `$${amount.toFixed(2)}`;
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

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      message?: string;
      history?: ChatMessage[];
      cartItems?: CartItem[];
      menuItems?: MenuItem[];
    };

    const message = body.message?.trim();
    const history = Array.isArray(body.history) ? body.history.slice(-8) : [];
    const cartItems = Array.isArray(body.cartItems) ? body.cartItems : [];
    const menuItems = Array.isArray(body.menuItems) ? body.menuItems : [];

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

    const systemPrompt = [
      "You are Pearl, a friendly and knowledgeable boba shop employee helping inside a POS system.",
      "Only help with boba shop topics such as drinks, toppings, sweetness, ice, cart review, recommendations, upsells, and menu guidance.",
      "If the user asks for something unrelated to a boba shop, politely refuse and redirect to menu, drink, topping, or order questions.",
      "Use the current cart and menu context when answering.",
      "When the user asks for suggestions, recommend specific drinks or add-ons from the menu and explain why they fit.",
      "If the cart already has items, suggest complementary drinks, topping tweaks, or sweetness/ice adjustments.",
      "Do not invent unavailable products or claim to complete payment, modify inventory, or place orders yourself.",
      "Keep answers short, warm, and practical, like an employee helping a customer at the counter.",
      `Menu items: ${buildMenuSummary(menuItems)}`,
      `Current cart:\n${buildCartSummary(cartItems)}`
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
        max_tokens: 250,
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
          reply: `I’m having trouble reaching the boba assistant right now. ${apiError}`
        },
        { status: response.status }
      );
    }

    const reply = data.choices?.[0]?.message?.content?.trim();

    return NextResponse.json({
      reply:
        reply ??
        "I can help with drinks, toppings, cart questions, and boba suggestions. What would you like to order?"
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
