import { NextResponse } from "next/server";

import { buildGoogleTranslateUrl, getGoogleTranslateApiKey } from "@/lib/translation";

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

  if (!apiKey) {
    return NextResponse.json({ error: "Google Translate API is not configured." }, { status: 500 });
  }

  const params = new URLSearchParams({
    key: apiKey,
    target: "en"
  });

  const response = await fetch(`${buildGoogleTranslateUrl("/languages")}?${params.toString()}`, {
    cache: "no-store"
  });

  if (!response.ok) {
    return NextResponse.json({ error: "Unable to load translation languages." }, { status: 502 });
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
}
