const DAIRY_KEYWORDS = ["milk", "cream", "cheese", "butter", "whey", "lactose"];
const GLUTEN_KEYWORDS = ["flour", "wheat", "barley", "rye", "oat", "bread", "malt", "grain"];
const SUGAR_KEYWORDS = ["sugar", "syrup", "honey", "fructose", "sucrose", "glucose", "cane"];

export function getAllergenTags(ingredientNames: string[]): string[] {
  const lower = ingredientNames.map((n) => n.toLowerCase());
  const tags: string[] = [];
  if (!DAIRY_KEYWORDS.some((kw) => lower.some((n) => n.includes(kw)))) tags.push("dairy free");
  if (!GLUTEN_KEYWORDS.some((kw) => lower.some((n) => n.includes(kw)))) tags.push("gluten free");
  if (!SUGAR_KEYWORDS.some((kw) => lower.some((n) => n.includes(kw)))) tags.push("sugar free");
  return tags;
}
