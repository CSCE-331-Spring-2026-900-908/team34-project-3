import { NextRequest, NextResponse } from "next/server";

import { buildGoogleTranslateUrl, getGoogleApiErrorMessage, getGoogleTranslateApiKey } from "@/lib/translation";

type TranslateRequestBody = {
  targetLanguage?: unknown;
  texts?: unknown;
};

type GoogleTranslateResponse = {
  data?: {
    translations?: Array<{
      translatedText?: string;
    }>;
  };
};

export async function POST(request: NextRequest) {
  const apiKey = getGoogleTranslateApiKey();

  if (!apiKey) {
    return NextResponse.json({ error: "Google Translate API is not configured." }, { status: 500 });
  }

  const body = (await request.json().catch(() => null)) as TranslateRequestBody | null;
  const targetLanguage = typeof body?.targetLanguage === "string" ? body.targetLanguage.trim() : "";
  const texts = Array.isArray(body?.texts)
    ? body.texts.filter((entry): entry is string => typeof entry === "string").map((entry) => entry.trim()).filter(Boolean)
    : [];

  if (!targetLanguage) {
    return NextResponse.json({ error: "A target language is required." }, { status: 400 });
  }

  if (!texts.length) {
    return NextResponse.json({ translations: [] });
  }

  try {
    const response = await fetch(`${buildGoogleTranslateUrl()}?key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        q: texts,
        target: targetLanguage,
        format: "text"
      }),
      cache: "no-store"
    });

    if (!response.ok) {
      const message = await getGoogleApiErrorMessage(response, "Unable to translate this page right now.");
      console.error("Google Translate request failed:", message);
      return NextResponse.json({ error: message }, { status: 502 });
    }

    const payload = (await response.json()) as GoogleTranslateResponse;
    const translations = (payload.data?.translations ?? []).map((entry) => entry.translatedText ?? "");

    return NextResponse.json({ translations });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Google Translate request threw:", message);
    return NextResponse.json({ error: `Unable to translate this page right now. ${message}` }, { status: 502 });
  }
}
