"use client";

import type { WheelEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Languages, Loader2 } from "lucide-react";
import { usePathname } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

type LanguageOption = {
  code: string;
  name: string;
};

type TranslatableNode = {
  node: Text;
  originalText: string;
};

type TranslationMode = "full" | "augment";
type TranslateElementDetail = {
  element?: HTMLElement | null;
};

const EXCLUDED_TAG_NAMES = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA", "INPUT", "SELECT", "OPTION"]);

function normalizeText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function collectTranslatableNodes(root: Node = document.body) {
  const nodes: TranslatableNode[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parentElement = node.parentElement;
      const text = normalizeText(node.textContent ?? "");

      if (!parentElement || !text) {
        return NodeFilter.FILTER_REJECT;
      }

      if (parentElement.closest("[data-no-translate='true']")) {
        return NodeFilter.FILTER_REJECT;
      }

      if (EXCLUDED_TAG_NAMES.has(parentElement.tagName)) {
        return NodeFilter.FILTER_REJECT;
      }

      return NodeFilter.FILTER_ACCEPT;
    }
  });

  let currentNode = walker.nextNode();

  while (currentNode) {
    if (currentNode instanceof Text) {
      nodes.push({
        node: currentNode,
        originalText: currentNode.textContent ?? ""
      });
    }

    currentNode = walker.nextNode();
  }

  return nodes;
}

async function fetchJson<T>(input: RequestInfo, init?: RequestInit) {
  const response = await fetch(input, init);
  const payload = (await response.json().catch(() => null)) as T | { error?: string } | null;

  if (!response.ok) {
    const message = payload && typeof payload === "object" && "error" in payload ? payload.error : "Request failed.";
    throw new Error(message ?? "Request failed.");
  }

  return payload as T;
}

export function PageTranslator() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [loadingLanguages, setLoadingLanguages] = useState(true);
  const [translating, setTranslating] = useState(false);
  const [languageInput, setLanguageInput] = useState("English");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [inputError, setInputError] = useState("");
  const [activeLanguage, setActiveLanguage] = useState("en");
  const [languages, setLanguages] = useState<LanguageOption[]>([{ code: "en", name: "English" }]);
  const currentNodesRef = useRef<TranslatableNode[]>([]);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const previousInputRef = useRef("English");
  const clearedOnFocusRef = useRef(false);
  const latestInputRef = useRef("English");
  const isApplyingTranslationRef = useRef(false);
  const retranslateTimeoutRef = useRef<number | null>(null);

  const filteredLanguages = useMemo(() => {
    const query = languageInput.trim().toLowerCase();
    return languages.filter((language) =>
      !query ||
      language.name.toLowerCase().includes(query) ||
      language.code.toLowerCase().includes(query)
    );
  }, [languageInput, languages]);

  const activeLanguageName = languages.find((language) => language.code === activeLanguage)?.name ?? activeLanguage;

  useEffect(() => {
    latestInputRef.current = languageInput;
  }, [languageInput]);

  useEffect(() => {
    localStorage.setItem("page-translator-language", activeLanguage);
    window.dispatchEvent(
      new CustomEvent("page-translator:language-changed", {
        detail: {
          language: activeLanguage
        }
      })
    );
  }, [activeLanguage]);

  useEffect(() => {
    return () => {
      if (retranslateTimeoutRef.current !== null) {
        window.clearTimeout(retranslateTimeoutRef.current);
      }
    };
  }, []);

  function findLanguage(value: string) {
    const normalizedValue = value.trim().toLowerCase();

    if (!normalizedValue) {
      return null;
    }

    return (
      languages.find((language) => language.name.toLowerCase() === normalizedValue) ??
      languages.find((language) => language.code.toLowerCase() === normalizedValue) ??
      null
    );
  }

  useEffect(() => {
    let cancelled = false;

    async function loadLanguages() {
      try {
        const payload = await fetchJson<{ languages: LanguageOption[] }>("/api/translate/languages");

        if (cancelled) {
          return;
        }

        const merged = [{ code: "en", name: "English" }, ...payload.languages.filter((language) => language.code !== "en")];
        setLanguages(merged);
        setLanguageInput("English");
      } catch (error) {
        if (!cancelled) {
          toast.error(error instanceof Error ? error.message : "Unable to load languages.");
        }
      } finally {
        if (!cancelled) {
          setLoadingLanguages(false);
        }
      }
    }

    loadLanguages();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    currentNodesRef.current = [];

    if (activeLanguage !== "en") {
      const timeout = window.setTimeout(() => {
        void handleTranslate(activeLanguage, false);
      }, 150);

      return () => window.clearTimeout(timeout);
    }

    return undefined;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useEffect(() => {
    if (!open) {
      setShowSuggestions(false);
      setInputError("");
      setLanguageInput(languages.find((language) => language.code === activeLanguage)?.name ?? "English");
    }
  }, [activeLanguage, languages, open]);

  useEffect(() => {
    function handleTranslatorRefresh() {
      if (activeLanguage === "en") {
        return;
      }

      window.setTimeout(() => {
        void handleTranslate(activeLanguage, false, "augment");
      }, 60);
    }

    function handleTranslateElement(event: Event) {
      if (activeLanguage === "en") {
        return;
      }

      const detail = (event as CustomEvent<TranslateElementDetail>).detail;
      const element = detail?.element;

      if (!element) {
        return;
      }

      window.setTimeout(() => {
        void handleTranslate(activeLanguage, false, "augment", element);
      }, 20);
    }

    window.addEventListener("page-translator:refresh", handleTranslatorRefresh);
    window.addEventListener("page-translator:translate-element", handleTranslateElement);

    return () => {
      window.removeEventListener("page-translator:refresh", handleTranslatorRefresh);
      window.removeEventListener("page-translator:translate-element", handleTranslateElement);
    };
  }, [activeLanguage]);

  function restoreOriginalText() {
    currentNodesRef.current.forEach(({ node, originalText }) => {
      node.textContent = originalText;
    });
  }

  function selectLanguage(language: LanguageOption) {
    setLanguageInput(language.name);
    setInputError("");
    setShowSuggestions(false);
    previousInputRef.current = language.name;
    clearedOnFocusRef.current = false;
    window.setTimeout(() => {
      inputRef.current?.blur();
    }, 0);
  }

  function handleSuggestionWheel(event: WheelEvent<HTMLDivElement>) {
    const element = event.currentTarget;
    element.scrollTop += event.deltaY;
    event.preventDefault();
    event.stopPropagation();
  }

  async function translateNodes(nodes: TranslatableNode[], targetLanguage: string) {
    const texts = nodes.map((entry) => entry.originalText);

    if (!texts.length) {
      return;
    }

    const payload = await fetchJson<{ translations: string[] }>("/api/translate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        targetLanguage,
        texts
      })
    });

    nodes.forEach((entry, index) => {
      entry.node.textContent = payload.translations[index] ?? entry.originalText;
    });
  }

  function scheduleRetranslate() {
    if (activeLanguage === "en" || isApplyingTranslationRef.current) {
      return;
    }

    if (retranslateTimeoutRef.current !== null) {
      window.clearTimeout(retranslateTimeoutRef.current);
    }

    retranslateTimeoutRef.current = window.setTimeout(() => {
      void handleTranslate(activeLanguage, false, "augment");
    }, 120);
  }

  useEffect(() => {
    if (activeLanguage === "en") {
      return undefined;
    }

    const observer = new MutationObserver((mutations) => {
      if (isApplyingTranslationRef.current) {
        return;
      }

      const shouldRetranslate = mutations.some((mutation) => {
        if (mutation.type === "characterData") {
          return false;
        }

        return Array.from(mutation.addedNodes).some((node) => {
          if (!(node instanceof HTMLElement) && !(node instanceof Text)) {
            return false;
          }

          const parentElement = node instanceof HTMLElement ? node : node.parentElement;
          return !parentElement?.closest("[data-no-translate='true']");
        });
      });

      if (shouldRetranslate) {
        scheduleRetranslate();
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: false
    });

    return () => {
      observer.disconnect();
    };
  }, [activeLanguage]);

  async function handleTranslate(
    targetLanguage: string,
    announce = true,
    mode: TranslationMode = "full",
    root: Node = document.body
  ) {
    setTranslating(true);
    isApplyingTranslationRef.current = true;

    try {
      if (targetLanguage === "en") {
        restoreOriginalText();
        currentNodesRef.current = [];
        setActiveLanguage("en");
        return;
      }

      if (mode === "full") {
        restoreOriginalText();
        const nodes = collectTranslatableNodes(document.body);

        if (!nodes.length) {
          currentNodesRef.current = [];
          setActiveLanguage(targetLanguage);
          return;
        }

        await translateNodes(nodes, targetLanguage);
        currentNodesRef.current = nodes;
        setActiveLanguage(targetLanguage);
        return;
      }

      const knownNodes = new Set(currentNodesRef.current.map((entry) => entry.node));
      const newNodes = collectTranslatableNodes(root).filter((entry) => !knownNodes.has(entry.node));

      if (!newNodes.length) {
        setActiveLanguage(targetLanguage);
        return;
      }

      await translateNodes(newNodes, targetLanguage);
      currentNodesRef.current = [...currentNodesRef.current, ...newNodes];
      setActiveLanguage(targetLanguage);
    } catch (error) {
      if (mode === "full") {
        restoreOriginalText();
        currentNodesRef.current = [];
      }

      if (announce) {
        toast.error(error instanceof Error ? error.message : "Unable to translate this page.");
      }
    } finally {
      isApplyingTranslationRef.current = false;
      setTranslating(false);
    }
  }

  async function applyTranslation() {
    const matchedLanguage = findLanguage(languageInput);

    if (!matchedLanguage) {
      const message = "Enter a valid language name or code, then choose one of the suggestions.";
      setInputError(message);
      toast.error(message);
      return;
    }

    setLanguageInput(matchedLanguage.name);
    setInputError("");
    setShowSuggestions(false);
    previousInputRef.current = matchedLanguage.name;
    clearedOnFocusRef.current = false;
    await handleTranslate(matchedLanguage.code);
  }

  return (
    <div data-no-translate="true" className="pointer-events-none fixed right-4 top-4 z-50">
      {open ? (
        <button
          type="button"
          aria-label="Close translator"
          className="pointer-events-auto fixed inset-0 cursor-default bg-transparent"
          onClick={() => {
            setOpen(false);
            setShowSuggestions(false);
          }}
        />
      ) : null}

      <div className="pointer-events-auto relative z-10 flex flex-col items-end gap-3">
        <Button
          type="button"
          variant="outline"
          className="gap-2 bg-white/95 shadow-sm backdrop-blur"
          onClick={() => setOpen((current) => !current)}
        >
          <Languages className="h-4 w-4" />
          Translate
        </Button>

        {open ? (
          <div className="w-[20rem] rounded-[1.5rem] border border-border bg-white p-4 shadow-xl">
            <div className="space-y-3">
              <div>
                <p className="text-sm font-semibold text-foreground">Translate this page</p>
                <p className="text-xs text-stone-500">Pick a language and translate the visible content.</p>
              </div>

              <div className="relative">
                <input
                  ref={inputRef}
                  type="text"
                  value={languageInput}
                  onChange={(event) => {
                    const value = event.target.value;
                    setLanguageInput(value);
                    setInputError("");
                    setShowSuggestions(true);
                    clearedOnFocusRef.current = false;
                  }}
                  onFocus={() => {
                    previousInputRef.current = languageInput;
                    setLanguageInput("");
                    setInputError("");
                    setShowSuggestions(true);
                    clearedOnFocusRef.current = true;
                  }}
                  onBlur={() => {
                    window.setTimeout(() => {
                      if (clearedOnFocusRef.current && !latestInputRef.current.trim()) {
                        setLanguageInput(previousInputRef.current);
                      }

                      clearedOnFocusRef.current = false;
                    }, 0);
                  }}
                  placeholder="Type a language"
                  disabled={loadingLanguages || translating}
                  className="min-h-11 w-full rounded-2xl border border-border bg-white px-3 py-2 text-sm text-foreground"
                />

                {showSuggestions && filteredLanguages.length ? (
                  <div
                    className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-10 max-h-64 overflow-y-auto overscroll-contain rounded-2xl border border-border bg-white shadow-lg"
                    onWheel={handleSuggestionWheel}
                  >
                    {filteredLanguages.map((language) => (
                      <button
                        key={language.code}
                        type="button"
                        className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-foreground transition hover:bg-[rgb(var(--muted))]"
                        onPointerDown={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          selectLanguage(language);
                        }}
                      >
                        <span>{language.name}</span>
                        <span className="text-xs uppercase text-stone-500">{language.code}</span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              <p className="text-xs text-stone-500">
                Press Apply to translate using exactly what is currently typed in the box.
              </p>

              {inputError ? <p className="text-xs text-danger">{inputError}</p> : null}

              <div className="flex">
                <Button
                  type="button"
                  className="flex-1 gap-2"
                  disabled={loadingLanguages || translating}
                  onClick={() => void applyTranslation()}
                >
                  {translating ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {translating ? `Translating ${languageInput || "language"}...` : "Apply"}
                </Button>
              </div>

              <p className="text-xs text-stone-500">
                Active language: {activeLanguageName}
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
