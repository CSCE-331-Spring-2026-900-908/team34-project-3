const embeddingModel = process.env.MANAGER_COPILOT_EMBEDDING_MODEL ?? "text-embedding-3-small";

type EmbeddingsResponse = {
  data?: Array<{
    embedding?: number[];
  }>;
};

export async function embedManagerText(input: string) {
  if (!process.env.OPENAI_API_KEY) {
    return null;
  }

  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: embeddingModel,
      input: input.slice(0, 8000)
    })
  });

  const data = (await response.json().catch(() => null)) as EmbeddingsResponse | null;

  if (!response.ok) {
    return null;
  }

  const embedding = data?.data?.[0]?.embedding;
  return Array.isArray(embedding) ? embedding : null;
}

export function cosineSimilarity(left: number[], right: number[]) {
  if (left.length === 0 || right.length === 0 || left.length !== right.length) {
    return 0;
  }

  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;

  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index];
    leftMagnitude += left[index] * left[index];
    rightMagnitude += right[index] * right[index];
  }

  if (leftMagnitude === 0 || rightMagnitude === 0) {
    return 0;
  }

  return dot / (Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude));
}
