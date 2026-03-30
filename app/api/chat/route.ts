import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { message } = await req.json();

  // Call OpenAI API
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a helpful assistant for a boba shop POS." },
        { role: "user", content: message },
      ],
    }),
  });

  const data = await response.json();
  const reply = data.choices?.[0]?.message?.content ?? "Sorry, I didn't understand.";

  return NextResponse.json({ reply });
}