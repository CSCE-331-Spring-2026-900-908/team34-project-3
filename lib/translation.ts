const GOOGLE_TRANSLATE_BASE_URL = "https://translation.googleapis.com/language/translate/v2";

export function getGoogleTranslateApiKey() {
  return process.env.GOOGLE_TRANSLATE_API_KEY;
}

export function buildGoogleTranslateUrl(path = "") {
  return `${GOOGLE_TRANSLATE_BASE_URL}${path}`;
}
