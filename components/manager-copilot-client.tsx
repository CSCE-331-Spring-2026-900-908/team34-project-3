"use client";

import { useEffect, useState, type ChangeEvent } from "react";
import {
  Bot,
  ChevronRight,
  Loader2,
  MessagesSquare,
  Plus,
  SendHorizonal,
  Sparkles,
  Upload,
  X
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type ToolTraceEntry = {
  name: string;
  arguments: Record<string, unknown>;
};

type KnowledgeSource = {
  id: string;
  title: string;
  category: string;
  snippet: string;
  score: number;
};

type ChartResult = {
  title: string;
  type: "bar" | "line";
  url: string;
};

type ArtifactResult = {
  type: "brief" | "comparison" | "html_demo";
  title: string;
  subtitle?: string;
  highlights?: string[];
  sections?: Array<{
    title: string;
    body: string;
  }>;
  metrics?: Array<{
    label: string;
    value: string;
  }>;
  html?: string;
} | null;

type Message = {
  id?: string;
  role: "user" | "assistant";
  content: string;
  reasoningSummary?: string | null;
  toolTrace?: ToolTraceEntry[];
  knowledgeSources?: KnowledgeSource[];
  chart?: ChartResult | null;
  artifact?: ArtifactResult;
};

type StoredDocument = {
  id: string;
  title: string;
  category: string;
  snippet: string;
  content: string;
  source: "manual" | "upload";
  canEdit: boolean;
  createdAt: string;
  updatedAt: string;
};

type StoredChat = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
};

const quickPrompts = [
  "What should I restock today?",
  "What are the top selling items today?",
  "Create a shift brief for today's manager handoff.",
  "Give me a chart of the last month's sales by item."
];

const documentCategories = ["Instruction", "Manager Note", "SOP", "Vendor", "Promotion"];

const initialAssistantMessage: Message = {
  role: "assistant",
  content:
    "Copilot is ready. Ask about sales trends, item performance, inventory risk, data analytics, or charts and I will ground the answer in live manager data.",
  reasoningSummary:
    "This assistant can call manager data tools, run guarded read-only SQL, retrieve embedded manager documents, and attach chart images or structured artifacts when useful."
};

async function extractDocumentText(file: File) {
  const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);

  if (!isPdf) {
    return file.text();
  }

  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjs.getDocument({ data }).promise;
  const pages: string[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    if (pageText) {
      pages.push(pageText);
    }
  }

  return pages.join("\n\n").trim();
}

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}

function recoverAssistantMessage(message: Message): Message {
  if (message.role !== "assistant" || message.artifact || !/^\s*\{/.test(message.content)) {
    return message;
  }

  try {
    const parsed = JSON.parse(message.content) as {
      reply?: string;
      reasoningSummary?: string;
      artifact?: ArtifactResult;
    };

    return {
      ...message,
      content: parsed.reply ?? "I generated an interactive manager artifact.",
      reasoningSummary: message.reasoningSummary ?? parsed.reasoningSummary,
      artifact: parsed.artifact ?? null
    };
  } catch {
    return message;
  }
}

function ArtifactCard({ artifact }: { artifact: Exclude<ArtifactResult, null> }) {
  if (artifact.type === "html_demo") {
    return (
      <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-white">
        <div className="border-b border-border bg-[rgb(var(--surface-alt))] px-4 py-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-stone-500">
            Interactive HTML Demo
          </p>
          <h3 className="mt-1 text-lg font-semibold tracking-tight text-foreground">{artifact.title}</h3>
          {artifact.subtitle ? <p className="mt-1 text-sm text-stone-600">{artifact.subtitle}</p> : null}
        </div>
        <iframe
          title={artifact.title}
          srcDoc={artifact.html}
          sandbox="allow-scripts"
          className="h-[620px] w-full bg-white"
        />
      </div>
    );
  }

  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-white">
      <div className="border-b border-border bg-[rgb(var(--surface-alt))] px-4 py-3">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-stone-500">
          {artifact.type === "comparison" ? "Comparison Artifact" : "Manager Brief"}
        </p>
        <h3 className="mt-1 text-lg font-semibold tracking-tight text-foreground">{artifact.title}</h3>
        {artifact.subtitle ? <p className="mt-1 text-sm text-stone-600">{artifact.subtitle}</p> : null}
      </div>

      <div className="space-y-4 p-4">
        {artifact.metrics && artifact.metrics.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-3">
            {artifact.metrics.map((metric) => (
              <div key={`${metric.label}-${metric.value}`} className="rounded-xl border border-border bg-[rgb(var(--surface-alt))] p-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-stone-500">{metric.label}</p>
                <p className="mt-2 text-lg font-semibold text-foreground">{metric.value}</p>
              </div>
            ))}
          </div>
        ) : null}

        {artifact.highlights && artifact.highlights.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {artifact.highlights.map((highlight) => (
              <Badge key={highlight} className="border-border bg-[rgb(var(--surface-alt))] text-stone-700">
                {highlight}
              </Badge>
            ))}
          </div>
        ) : null}

        {artifact.sections && artifact.sections.length > 0 ? (
          <div className="grid gap-3">
            {artifact.sections.map((section) => (
              <div key={section.title} className="rounded-xl border border-border bg-[rgb(var(--surface-alt))] p-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-stone-500">{section.title}</p>
                <p className="mt-2 text-sm leading-6 text-stone-700">{section.body}</p>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function ManagerCopilotClient() {
  const [sidebarTab, setSidebarTab] = useState<"docs" | "chats">("docs");
  const [expandedMessageIndex, setExpandedMessageIndex] = useState<number | null>(null);
  const [expandedChart, setExpandedChart] = useState<ChartResult | null>(null);
  const [messages, setMessages] = useState<Message[]>([initialAssistantMessage]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [documents, setDocuments] = useState<StoredDocument[]>([]);
  const [chats, setChats] = useState<StoredChat[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isLoadingSidebar, setIsLoadingSidebar] = useState(true);
  const [isSavingDocument, setIsSavingDocument] = useState(false);
  const [deletingDocumentId, setDeletingDocumentId] = useState<string | null>(null);
  const [deletingChatId, setDeletingChatId] = useState<string | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [editingDocumentId, setEditingDocumentId] = useState<string | null>(null);
  const [selectedDocument, setSelectedDocument] = useState<StoredDocument | null>(null);
  const [documentTitle, setDocumentTitle] = useState("");
  const [documentCategory, setDocumentCategory] = useState<(typeof documentCategories)[number]>("Instruction");
  const [documentContent, setDocumentContent] = useState("");
  const [documentSource, setDocumentSource] = useState<"manual" | "upload">("manual");

  const isDocumentEditing = editingDocumentId !== null;

  function resetDocumentForm() {
    setEditingDocumentId(null);
    setDocumentTitle("");
    setDocumentContent("");
    setDocumentCategory("Instruction");
    setDocumentSource("manual");
  }

  function openNewDocumentModal() {
    resetDocumentForm();
    setSelectedDocument(null);
    setIsUploadModalOpen(true);
  }

  function openDocument(document: StoredDocument) {
    setSelectedDocument(document);
    setIsUploadModalOpen(false);
  }

  function beginEditingDocument(document: StoredDocument) {
    setSelectedDocument(null);
    setEditingDocumentId(document.id);
    setDocumentTitle(document.title);
    setDocumentCategory(document.category as (typeof documentCategories)[number]);
    setDocumentContent(document.content);
    setDocumentSource(document.source);
    setSidebarTab("docs");
    setIsUploadModalOpen(true);
  }

  async function loadSidebarData() {
    setIsLoadingSidebar(true);

    try {
      const [docsResponse, chatsResponse] = await Promise.all([
        fetch("/api/manager/copilot/docs"),
        fetch("/api/manager/copilot/chats")
      ]);

      const docsPayload = (await docsResponse.json().catch(() => null)) as
        | { documents?: StoredDocument[] }
        | null;
      const chatsPayload = (await chatsResponse.json().catch(() => null)) as
        | { chats?: StoredChat[] }
        | null;

      if (docsResponse.ok) {
        setDocuments(docsPayload?.documents ?? []);
      }

      if (chatsResponse.ok) {
        setChats(chatsPayload?.chats ?? []);
      }
    } finally {
      setIsLoadingSidebar(false);
    }
  }

  useEffect(() => {
    void loadSidebarData();
  }, []);

  async function loadChat(chatId: string) {
    try {
      const response = await fetch(`/api/manager/copilot/chats/${chatId}`);
      const payload = (await response.json().catch(() => null)) as
        | { messages?: Array<Message> }
        | { error?: string }
        | null;

      if (!response.ok) {
        toast.error((payload as { error?: string } | null)?.error ?? "Unable to load that saved chat.");
        return;
      }

      const loadedMessages =
        (payload as { messages?: Array<Message> } | null)?.messages?.map((message) =>
          recoverAssistantMessage({
            ...message,
            toolTrace: Array.isArray(message.toolTrace) ? message.toolTrace : [],
            knowledgeSources: Array.isArray(message.knowledgeSources) ? message.knowledgeSources : [],
            artifact: (message.artifact ?? null) as ArtifactResult
          })
        ) ?? [];

      setCurrentChatId(chatId);
      setMessages(loadedMessages.length > 0 ? loadedMessages : [initialAssistantMessage]);
      setExpandedMessageIndex(null);
      setSidebarTab("chats");
    } catch {
      toast.error("Unable to load that saved chat.");
    }
  }

  async function saveDocument() {
    const title = documentTitle.trim();
    const content = documentContent.trim();

    if (!title || !content) {
      toast.error("Add a title and content before saving a manager document.");
      return;
    }

    setIsSavingDocument(true);

    try {
      const response = await fetch("/api/manager/copilot/docs", {
        method: editingDocumentId ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          id: editingDocumentId,
          title,
          category: documentCategory,
          content,
          source: documentSource
        })
      });

      const payload = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        toast.error(payload?.error ?? "Unable to save that document.");
        return;
      }

      toast.success(
        editingDocumentId
          ? "Manager document updated."
          : "Manager document saved and embedded for future copilot calls."
      );
      resetDocumentForm();
      setIsUploadModalOpen(false);
      await loadSidebarData();
    } catch {
      toast.error("Unable to save that document.");
    } finally {
      setIsSavingDocument(false);
    }
  }

  async function handleFileUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    try {
      const content = await extractDocumentText(file);

      if (!content.trim()) {
        toast.error("That file did not contain extractable text.");
        return;
      }

      setDocumentTitle(file.name.replace(/\.[^.]+$/, ""));
      setDocumentContent(content);
      setDocumentSource("upload");
      setEditingDocumentId(null);
      setSelectedDocument(null);
      setSidebarTab("docs");
      setIsUploadModalOpen(true);
      toast.success("Document loaded into the upload form.");
    } catch {
      toast.error("That file could not be read. Try a PDF or a text-based file such as .txt, .md, .json, .csv, or .html.");
    } finally {
      event.target.value = "";
    }
  }

  async function handleDeleteDocument(documentId: string) {
    setDeletingDocumentId(documentId);

    try {
      const response = await fetch(`/api/manager/copilot/docs?id=${encodeURIComponent(documentId)}`, {
        method: "DELETE"
      });

      const payload = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        toast.error(payload?.error ?? "Unable to delete that manager document.");
        return;
      }

      setDocuments((current) => current.filter((document) => document.id !== documentId));
      toast.success("Manager document deleted.");
    } catch {
      toast.error("Unable to delete that manager document.");
    } finally {
      setDeletingDocumentId(null);
    }
  }

  async function handleDeleteChat(chatId: string) {
    setDeletingChatId(chatId);

    try {
      const response = await fetch(`/api/manager/copilot/chats/${chatId}`, {
        method: "DELETE"
      });

      const payload = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        toast.error(payload?.error ?? "Unable to delete that saved chat.");
        return;
      }

      setChats((current) => current.filter((chat) => chat.id !== chatId));

      if (currentChatId === chatId) {
        setCurrentChatId(null);
        setMessages([initialAssistantMessage]);
        setExpandedMessageIndex(null);
      }

      toast.success("Saved chat deleted.");
    } catch {
      toast.error("Unable to delete that saved chat.");
    } finally {
      setDeletingChatId(null);
    }
  }

  async function sendMessage(prefilled?: string) {
    const nextMessage = (prefilled ?? input).trim();

    if (!nextMessage || isSending) {
      return;
    }

    const nextHistory = [...messages, { role: "user" as const, content: nextMessage }];

    setMessages((current) => [...current, { role: "user", content: nextMessage }]);
    setInput("");
    setIsSending(true);

    try {
      const response = await fetch("/api/manager/copilot", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          chatId: currentChatId,
          message: nextMessage,
          history: nextHistory.map((entry) => ({
            role: entry.role,
            content: entry.content
          }))
        })
      });

      const payload = (await response.json().catch(() => null)) as
        | {
            chatId?: string;
            reply?: string;
            reasoningSummary?: string;
            toolTrace?: ToolTraceEntry[];
            knowledgeSources?: KnowledgeSource[];
            chart?: ChartResult | null;
            artifact?: ArtifactResult;
            error?: string;
          }
        | null;

      if (!response.ok) {
        toast.error(payload?.error ?? "Manager Copilot could not answer right now.");
        return;
      }

      if (payload?.chatId) {
        setCurrentChatId(payload.chatId);
      }

      setMessages((current) => [
        ...current,
        recoverAssistantMessage({
          role: "assistant",
          content:
            payload?.reply ??
            "I can help with sales performance, item trends, and inventory risk.",
          reasoningSummary: payload?.reasoningSummary,
          toolTrace: payload?.toolTrace ?? [],
          knowledgeSources: payload?.knowledgeSources ?? [],
          chart: payload?.chart ?? null,
          artifact: payload?.artifact ?? null
        })
      ]);

      await loadSidebarData();
    } catch {
      toast.error("Manager Copilot could not answer right now.");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <>
      <Card className="grid h-[calc(100vh-12rem)] min-h-[760px] w-full grid-cols-[320px_minmax(0,1fr)] overflow-hidden rounded-2xl">
        <div className="flex min-h-0 flex-col border-r border-border bg-[rgb(var(--surface-alt))]">
          <div className="border-b border-border px-4 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-white">
                <Bot className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Store Advisor</p>
                <p className="text-xs text-stone-500">Reference documents and saved manager chats</p>
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setSidebarTab("docs")}
                className={cn(
                  "flex-1 rounded-xl px-3 py-2 text-sm font-medium transition",
                  sidebarTab === "docs" ? "bg-white text-foreground shadow-sm" : "text-stone-500 hover:text-foreground"
                )}
              >
                Documents
              </button>
              <button
                type="button"
                onClick={() => setSidebarTab("chats")}
                className={cn(
                  "flex-1 rounded-xl px-3 py-2 text-sm font-medium transition",
                  sidebarTab === "chats" ? "bg-white text-foreground shadow-sm" : "text-stone-500 hover:text-foreground"
                )}
              >
                Saved Chats
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
            {isLoadingSidebar ? (
              <div className="flex items-center gap-2 text-sm text-stone-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading manager copilot workspace...
              </div>
            ) : null}

            {!isLoadingSidebar && sidebarTab === "docs" ? (
              <div className="space-y-4">
                <div className="rounded-2xl border border-border bg-white p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground">Reference Documents</p>
                    </div>
                    <Button type="button" className="shrink-0" onClick={openNewDocumentModal}>
                      <Upload className="mr-2 h-4 w-4" />
                      Add Document
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  {documents.map((document) => (
                    <div key={document.id} className="relative rounded-2xl border border-border bg-white p-3 pr-12">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-2 top-2 h-7 w-7 rounded-full text-stone-400 hover:bg-[rgb(var(--surface-alt))] hover:text-foreground"
                        onClick={() => void handleDeleteDocument(document.id)}
                        disabled={deletingDocumentId === document.id}
                        aria-label={`Delete ${document.title}`}
                      >
                        {deletingDocumentId === document.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <X className="h-3.5 w-3.5" />
                        )}
                      </Button>
                      <button
                        type="button"
                        onClick={() => openDocument(document)}
                        className="block w-full text-left"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-foreground">{document.title}</p>
                            <p className="mt-1 text-xs text-stone-500">
                              {formatTimestamp(document.createdAt)}
                              {document.updatedAt !== document.createdAt
                                ? ` | Edited ${formatTimestamp(document.updatedAt)}`
                                : ""}
                            </p>
                          </div>
                          <Badge className="border-border bg-[rgb(var(--surface-alt))] text-stone-700">
                            {document.category}
                          </Badge>
                        </div>
                      </button>
                    </div>
                  ))}

                  {documents.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-border bg-white px-4 py-6 text-sm text-stone-500">
                      No manager documents yet. Add instructions, SOPs, notes, or vendor references here.
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}

            {!isLoadingSidebar && sidebarTab === "chats" ? (
              <div className="space-y-3">
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => {
                    setCurrentChatId(null);
                    setMessages([initialAssistantMessage]);
                    setExpandedMessageIndex(null);
                  }}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  New Chat
                </Button>

                {chats.map((chat) => (
                  <div
                    key={chat.id}
                    className={cn(
                      "relative rounded-2xl border bg-white transition",
                      currentChatId === chat.id
                        ? "border-foreground"
                        : "border-border hover:border-stone-300"
                    )}
                  >
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-2 top-2 z-10 h-7 w-7 rounded-full text-stone-400 hover:bg-[rgb(var(--surface-alt))] hover:text-foreground"
                      onClick={() => void handleDeleteChat(chat.id)}
                      disabled={deletingChatId === chat.id}
                      aria-label={`Delete chat ${chat.title}`}
                    >
                      {deletingChatId === chat.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <X className="h-3.5 w-3.5" />
                      )}
                    </Button>
                    <button
                      type="button"
                      onClick={() => void loadChat(chat.id)}
                      className="block w-full px-3 py-3 pr-12 text-left"
                    >
                      <div className="flex items-start gap-3">
                        <MessagesSquare className="mt-0.5 h-4 w-4 text-stone-500" />
                        <div className="min-w-0">
                          <p className="wrap text-sm font-semibold text-foreground">{chat.title}</p>
                          <p className="mt-1 text-xs text-stone-500">Updated {formatTimestamp(chat.updatedAt)}</p>
                        </div>
                      </div>
                    </button>
                  </div>
                ))}

                {chats.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border bg-white px-4 py-6 text-sm text-stone-500">
                    No saved chats yet. Once you ask a question, this workspace will save the conversation automatically.
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex min-h-0 flex-col bg-[rgb(var(--surface))]">
          <div className="border-b border-border px-6 py-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-stone-500">Manager Copilot</p>
                <h2 className="mt-1 text-xl font-semibold tracking-tight text-foreground">
                  Analytics, Briefs, Charts, and Advice
                </h2>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {quickPrompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => {
                    setInput(prompt);
                    void sendMessage(prompt);
                  }}
                  className="rounded-full border border-border bg-[rgb(var(--surface-alt))] px-3 py-1.5 text-xs font-medium text-stone-600 transition hover:bg-white hover:text-foreground"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-6">
            {messages.map((message, index) => (
              <div
                key={`${message.id ?? "message"}-${message.role}-${index}`}
                className={cn("flex", message.role === "user" ? "justify-end" : "justify-start")}
              >
                <div
                  className={cn(
                    "max-w-[88%] rounded-3xl px-5 py-4 text-sm leading-6 shadow-sm xl:max-w-[78%]",
                    message.role === "user"
                      ? "rounded-br-md bg-foreground text-white"
                      : "rounded-bl-md border border-border bg-[rgb(var(--surface-alt))] text-foreground"
                  )}
                >
                  <p className="whitespace-pre-wrap">{message.content}</p>

                  {message.artifact ? <ArtifactCard artifact={message.artifact} /> : null}

                  {message.chart ? (
                    <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-white">
                      <button
                        type="button"
                        onClick={() => setExpandedChart(message.chart ?? null)}
                        className="block w-full text-left"
                      >
                        <img src={message.chart.url} alt={message.chart.title} className="h-auto w-full" />
                        <div className="border-t border-border bg-[rgb(var(--surface-alt))] px-3 py-2 text-xs font-medium uppercase tracking-[0.14em] text-stone-500">
                          Click to expand chart
                        </div>
                      </button>
                    </div>
                  ) : null}

                  {message.role === "assistant" &&
                  (message.reasoningSummary ||
                    (message.toolTrace && message.toolTrace.length > 0) ||
                    (message.knowledgeSources && message.knowledgeSources.length > 0)) ? (
                    <div className="mt-4 border-t border-border/80 pt-3">
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedMessageIndex((current) => (current === index ? null : index))
                        }
                        className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-stone-500 transition hover:text-foreground"
                      >
                        <ChevronRight
                          className={cn(
                            "h-4 w-4 transition-transform",
                            expandedMessageIndex === index && "rotate-90"
                          )}
                        />
                        Show Details
                      </button>

                      {expandedMessageIndex === index ? (
                        <div className="mt-3 space-y-4 rounded-2xl border border-border bg-white p-3 text-foreground">
                          {message.reasoningSummary ? (
                            <div>
                              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-stone-500">
                                Reasoning Summary
                              </p>
                              <p className="mt-2 text-sm leading-6 text-stone-600">{message.reasoningSummary}</p>
                            </div>
                          ) : null}

                          {message.toolTrace && message.toolTrace.length > 0 ? (
                            <div>
                              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-stone-500">
                                Agent Tools
                              </p>
                              <div className="mt-2 space-y-2">
                                {message.toolTrace.map((tool, toolIndex) => (
                                  <div
                                    key={`${tool.name}-${toolIndex}`}
                                    className="rounded-xl border border-border bg-[rgb(var(--surface-alt))] p-3"
                                  >
                                    <div className="flex items-center gap-2">
                                      <Sparkles className="h-3.5 w-3.5 text-stone-500" />
                                      <span className="text-sm font-medium text-foreground">{tool.name}</span>
                                    </div>
                                    {Object.keys(tool.arguments).length > 0 ? (
                                      <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words text-xs text-stone-500">
                                        {JSON.stringify(tool.arguments, null, 2)}
                                      </pre>
                                    ) : null}
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : null}

                          {message.knowledgeSources && message.knowledgeSources.length > 0 ? (
                            <div>
                              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-stone-500">
                                RAG Sources Accessed
                              </p>
                              <div className="mt-2 space-y-2">
                                {message.knowledgeSources.map((source) => (
                                  <div
                                    key={source.id}
                                    className="rounded-xl border border-border bg-[rgb(var(--surface-alt))] p-3"
                                  >
                                    <div className="flex items-center justify-between gap-3">
                                      <span className="text-sm font-medium text-foreground">{source.title}</span>
                                      <Badge className="border-border bg-white text-stone-600">
                                        {source.category}
                                      </Badge>
                                    </div>
                                    <p className="mt-2 text-sm text-stone-600">{source.snippet}</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
            ))}

            {isSending ? (
              <div className="flex justify-start">
                <div className="max-w-[88%] rounded-3xl rounded-bl-md border border-border bg-[rgb(var(--surface-alt))] px-5 py-4 text-sm text-stone-500 shadow-sm xl:max-w-[78%]">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Thinking through the manager data, saved notes, and embedded documents...
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <div className="border-t border-border px-6 py-4">
            <div className="rounded-3xl border border-border bg-[rgb(var(--surface-alt))] p-2">
              <div className="flex items-end gap-2">
                <textarea
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      void sendMessage();
                    }
                  }}
                  placeholder="Ask about sales, item performance, inventory risk, SQL-backed analytics, manager notes, or charts..."
                  className="max-h-32 min-h-[56px] flex-1 resize-none bg-transparent px-3 py-2 text-sm text-foreground outline-none placeholder:text-stone-400"
                />
                <Button
                  size="icon"
                  className="h-11 w-11 rounded-2xl"
                  onClick={() => void sendMessage()}
                  disabled={isSending || !input.trim()}
                >
                  <SendHorizonal className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {expandedChart ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-6">
          <div className="w-full max-w-6xl overflow-hidden rounded-[2rem] border border-border bg-[rgb(var(--surface))] shadow-2xl">
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-stone-500">Expanded Chart</p>
                <h2 className="mt-1 text-xl font-semibold tracking-tight text-foreground">{expandedChart.title}</h2>
              </div>
              <Button variant="outline" size="icon" onClick={() => setExpandedChart(null)} aria-label="Close chart">
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="bg-white p-4">
              <img src={expandedChart.url} alt={expandedChart.title} className="h-auto w-full rounded-2xl" />
            </div>
          </div>
        </div>
      ) : null}

      {isUploadModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-6">
          <div className="w-full max-w-2xl rounded-[2rem] border border-border bg-[rgb(var(--surface))] shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-5">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-stone-500">Reference Documents</p>
                <h2 className="mt-1 text-xl font-semibold tracking-tight text-foreground">Add document</h2>
                <p className="mt-2 text-sm text-stone-500">
                  Upload manager rules, SOPs, notes, vendor details, or PDF references. You can paste content directly or upload a file to embed it for future copilot calls.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setIsUploadModalOpen(false)}
                aria-label="Close upload dialog"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-4 px-6 py-5">
              <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
                <input
                  value={documentTitle}
                  onChange={(event) => setDocumentTitle(event.target.value)}
                  placeholder="Document title"
                  className="w-full rounded-xl border border-border bg-[rgb(var(--surface-alt))] px-3 py-2 text-sm outline-none placeholder:text-stone-400"
                />

                <select
                  value={documentCategory}
                  onChange={(event) => setDocumentCategory(event.target.value as (typeof documentCategories)[number])}
                  className="w-full rounded-xl border border-border bg-[rgb(var(--surface-alt))] px-3 py-2 text-sm outline-none"
                >
                  {documentCategories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>

              <textarea
                value={documentContent}
                onChange={(event) => setDocumentContent(event.target.value)}
                placeholder="Paste manager rules, SOP notes, observations, vendor details, or shift guidance..."
                className="min-h-[240px] w-full rounded-2xl border border-border bg-[rgb(var(--surface-alt))] px-4 py-3 text-sm outline-none placeholder:text-stone-400"
              />

              <div className="flex flex-col gap-3 rounded-2xl border border-dashed border-border bg-white p-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">Upload file</p>
                  <p className="mt-1 text-sm text-stone-500">Supports `.pdf`, `.txt`, `.md`, `.json`, `.csv`, `.html`, and `.log`.</p>
                </div>
                <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-medium text-stone-700 transition hover:bg-[rgb(var(--surface-alt))]">
                  <Upload className="h-4 w-4" />
                  Choose file
                  <input
                    type="file"
                    accept=".pdf,.txt,.md,.json,.csv,.html,.log"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-border px-6 py-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsUploadModalOpen(false);
                  resetDocumentForm();
                }}
              >
                Cancel
              </Button>
              <Button type="button" onClick={() => void saveDocument()} disabled={isSavingDocument}>
                {isSavingDocument ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {isDocumentEditing ? "Save Changes" : "Save And Embed"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {selectedDocument ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-6">
          <div className="w-full max-w-3xl rounded-[2rem] border border-border bg-[rgb(var(--surface))] shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-5">
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-stone-500">Reference Document</p>
                <h2 className="mt-1 truncate text-xl font-semibold tracking-tight text-foreground">
                  {selectedDocument.title}
                </h2>
                <p className="mt-2 text-sm text-stone-500">
                  {selectedDocument.category} | Added {formatTimestamp(selectedDocument.createdAt)}
                  {selectedDocument.updatedAt !== selectedDocument.createdAt
                    ? ` | Edited ${formatTimestamp(selectedDocument.updatedAt)}`
                    : ""}
                </p>
              </div>
              <Button type="button" variant="outline" size="icon" onClick={() => setSelectedDocument(null)} aria-label="Close document">
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-4 px-6 py-5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="border-border bg-[rgb(var(--surface-alt))] text-stone-700">
                  {selectedDocument.category}
                </Badge>
                <Badge className="border-border bg-white text-stone-600">
                  {selectedDocument.source === "manual" ? "Written in editor" : "Uploaded from file"}
                </Badge>
                {!selectedDocument.canEdit ? (
                  <p className="text-sm text-stone-500">
                    This document can be opened here, but only manually written documents you created can be edited.
                  </p>
                ) : null}
              </div>

              <div className="max-h-[50vh] overflow-y-auto whitespace-pre-wrap rounded-2xl border border-border bg-[rgb(var(--surface-alt))] px-4 py-3 text-sm leading-6 text-foreground">
                {selectedDocument.content}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-border px-6 py-4">
              <Button type="button" variant="outline" onClick={() => setSelectedDocument(null)}>
                Close
              </Button>
              {selectedDocument.canEdit ? (
                <Button
                  type="button"
                  onClick={() => beginEditingDocument(selectedDocument)}
                >
                  Edit Document
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
