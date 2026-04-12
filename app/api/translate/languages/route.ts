import { NextResponse } from "next/server";

import {
  buildGoogleTranslateUrl,
  getFallbackTranslationLanguages,
  getGoogleApiErrorMessage,
  getGoogleTranslateApiKey
} from "@/lib/translation";

type GoogleLanguagesResponse = {
  data?: {
    languages?: Array<{
      language: string;
      name?: string;
    }>;
  };
};

export async function GET() {
  const apiKey = getGoogleTranslateApiKey();
  const fallbackLanguages = getFallbackTranslationLanguages();

  if (!apiKey) {
    return NextResponse.json(
      {
        error: "Google Translate API is not configured. Showing fallback language list.",
        languages: fallbackLanguages,
        fallback: true
      },
      { status: 200 }
    );
  }

  const params = new URLSearchParams({
    key: apiKey,
    target: "en"
  });

  try {
    const response = await fetch(`${buildGoogleTranslateUrl("/languages")}?${params.toString()}`, {
      cache: "no-store"
    });

    if (!response.ok) {
      const message = await getGoogleApiErrorMessage(response, "Unable to load translation languages from Google.");
      console.error("Google Translate languages request failed:", message);

      return NextResponse.json(
        {
          error: message,
          languages: fallbackLanguages,
          fallback: true
        },
        { status: 200 }
      );
    }

    const payload = (await response.json()) as GoogleLanguagesResponse;
    const languages = (payload.data?.languages ?? [])
      .filter((entry) => entry.language && entry.name)
      .map((entry) => ({
        code: entry.language,
        name: entry.name ?? entry.language
      }))
      .sort((left, right) => left.name.localeCompare(right.name));

    return NextResponse.json({ languages });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Google Translate languages request threw:", message);

    return NextResponse.json(
      {
        error: `Unable to load translation languages from Google. ${message}`,
        languages: fallbackLanguages,
        fallback: true
      },
      { status: 200 }
    );
  }
}
