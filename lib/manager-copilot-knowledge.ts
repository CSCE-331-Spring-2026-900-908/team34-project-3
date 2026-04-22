import { listInstructionDocuments, listKnowledgeDocuments } from "@/lib/db/manager-copilot-store";
import { cosineSimilarity, embedManagerText } from "@/lib/manager-copilot-embeddings";

export type KnowledgeDocument = {
  id: string;
  title: string;
  category: "SOP" | "Vendor" | "Promotion" | "Manager Note" | "Instruction";
  snippet: string;
  content: string;
};

export type KnowledgeSearchResult = {
  id: string;
  title: string;
  category: KnowledgeDocument["category"];
  snippet: string;
  score: number;
};

const knowledgeDocuments: KnowledgeDocument[] = [
  {
    id: "sop-tapioca-weekend",
    title: "Weekend Tapioca Prep SOP",
    category: "SOP",
    snippet: "Prepare an extra batch by 3 PM when afternoon demand stays above baseline.",
    content:
      "Weekend tapioca prep should be checked at 2 PM and again at 4 PM. If afternoon demand is elevated, prepare an extra batch by 3 PM so pearls do not run out during the 5 PM to 7 PM rush. Tapioca quality drops if held too long, so staggered prep is preferred over one large batch."
  },
  {
    id: "vendor-pearls-lead-time",
    title: "Pearl Supplier Lead Time",
    category: "Vendor",
    snippet: "Primary supplier usually fulfills tapioca pearl orders within two business days.",
    content:
      "The primary pearl supplier usually fulfills standard tapioca pearl orders within two business days. Rush orders may cost more. Brown sugar syrup can typically be added to the same order with no additional delay."
  },
  {
    id: "promo-friday-bogo-note",
    title: "Friday BOGO Promotion Note",
    category: "Promotion",
    snippet: "The BOGO offer increased order count but pulled average ticket lower.",
    content:
      "A prior Friday BOGO promotion increased drink volume and traffic, but average ticket size fell because customers bought fewer add-ons. Managers should compare order count and average ticket together when evaluating soft revenue days."
  },
  {
    id: "manager-note-warm-weather",
    title: "Warm Weather Sales Pattern",
    category: "Manager Note",
    snippet: "Fruit teas and lighter drinks pick up first when temperatures rise.",
    content:
      "On warmer afternoons, fruit teas and lighter menu items tend to accelerate before milk teas. Promotions tied to mango, peach, or lychee products usually perform better than heavier drinks when the weather is hot."
  }
];

function scoreDocument(query: string, document: KnowledgeDocument) {
  const queryTerms = query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

  const haystack = `${document.title} ${document.category} ${document.snippet} ${document.content}`.toLowerCase();

  return queryTerms.reduce((score, term) => {
    if (haystack.includes(term)) {
      return score + 1;
    }

    return score;
  }, 0);
}

export async function searchManagerKnowledge(query: string, limit = 3): Promise<KnowledgeSearchResult[]> {
  const safeLimit = Math.max(1, Math.min(5, Math.round(limit)));
  const uploadedDocuments = await listKnowledgeDocuments(50).catch(() => []);
  const queryEmbedding = await embedManagerText(query);

  const combinedDocuments: KnowledgeDocument[] = [
    ...knowledgeDocuments,
    ...uploadedDocuments.map((document) => ({
      id: document.id,
      title: document.title,
      category: document.category as KnowledgeDocument["category"],
      snippet: document.snippet,
      content: document.content
    }))
  ];

  return combinedDocuments
    .map((document) => {
      const lexicalScore = scoreDocument(query, document);
      const uploadedDocument = uploadedDocuments.find((entry) => entry.id === document.id);
      const embeddingScore =
        queryEmbedding && uploadedDocument?.embedding
          ? cosineSimilarity(queryEmbedding, uploadedDocument.embedding)
          : 0;

      return {
        id: document.id,
        title: document.title,
        category: document.category,
        snippet: document.snippet,
        score: lexicalScore + embeddingScore * 4
      };
    })
    .filter((document) => document.score > 0.2)
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
    .slice(0, safeLimit);
}

export async function getManagerInstructionContext() {
  const documents = await listInstructionDocuments().catch(() => []);

  return documents
    .slice(0, 5)
    .map((document) => `${document.title}: ${document.content}`)
    .join("\n\n");
}
