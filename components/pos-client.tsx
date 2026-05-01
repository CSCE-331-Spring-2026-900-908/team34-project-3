"use client";

import { X, Minus, Plus, ShoppingCart, CupSoda, LogOut, Receipt } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MAIN_CONTENT_ID, SkipLink } from "@/components/skip-link";
import type { IngredientRecord, MenuItemRecord, SessionEmployee } from "@/lib/types";
import { useOrderStore } from "@/lib/stores/order-store";
import { cn, formatCurrency } from "@/lib/utils";

type PosClientProps = {
  employee: SessionEmployee;
  menuItems: MenuItemRecord[];
  ingredients: IngredientRecord[];
};

type ModalTranslations = {
  customizeDrink: string;
  itemName: string;
  description: string;
  basePrice: string;
  quantity: string;
  sweetness: string;
  ice: string;
  iceOptions: string[];
  extraIngredients: string;
  extraIngredientsDescription: string;
  ingredientNames: string[];
  ingredientCosts: string[];
  remove: string;
  add: string;
  itemTotal: string;
  cancel: string;
  addToCart: string;
};

const sweetnessOptions = [0, 25, 50, 75, 100, 125] as const;
const iceOptions = [
  { label: "No Ice", value: 0 },
  { label: "Light", value: 1 },
  { label: "Regular", value: 2 },
  { label: "Extra", value: 3 }
] as const;
const sizeOptions = [
  { value: 0, label: "Small" },
  { value: 1, label: "Medium" },
  { value: 2, label: "Large" }
] as const;
type DrinkSize = (typeof sizeOptions)[number]["value"];
const SIZE_MULTIPLIER: Record<DrinkSize, number> = { 0: 1, 1: 1.2, 2: 1.4 };

type SelectedIngredientState = Record<number, number>;

function lineTotal(item: MenuItemRecord, quantity: number, selectedIngredients: SelectedIngredientState, ingredients: IngredientRecord[], size: DrinkSize) {
  const addOnTotal = ingredients.reduce((sum, ingredient) => {
    const ingredientQuantity = selectedIngredients[ingredient.id] ?? 0;
    return sum + ingredient.addCost * ingredientQuantity;
  }, 0);

  return (item.cost + addOnTotal) * quantity * SIZE_MULTIPLIER[size];
}

export function PosClient({ employee, menuItems, ingredients }: PosClientProps) {
  const router = useRouter();
  const items = useOrderStore((state) => state.items);
  const addItem = useOrderStore((state) => state.addItem);
  const removeItem = useOrderStore((state) => state.removeItem);
  const updateItem = useOrderStore((state) => state.updateItem);
  const clear = useOrderStore((state) => state.clear);

  const [selectedItem, setSelectedItem] = useState<MenuItemRecord | null>(null);
  const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [sweetness, setSweetness] = useState<(typeof sweetnessOptions)[number]>(100);
  const [ice, setIce] = useState<0 | 1 | 2 | 3>(2);
  const [isHot, setIsHot] = useState(false);
  const [size, setSize] = useState<DrinkSize>(0);
  const [selectedIngredients, setSelectedIngredients] = useState<SelectedIngredientState>({});
  const [checkoutPending, setCheckoutPending] = useState(false);
  const [translatorLanguage, setTranslatorLanguage] = useState("en");
  const [modalTranslations, setModalTranslations] = useState<ModalTranslations | null>(null);
  const modalContentRef = useRef<HTMLDivElement | null>(null);
  const paidIngredients = useMemo(() => ingredients.filter((ingredient) => ingredient.addCost > 0), [ingredients]);

  useEffect(() => {
    setTranslatorLanguage(localStorage.getItem("page-translator-language") ?? "en");

    function handleLanguageChanged(event: Event) {
      const detail = (event as CustomEvent<{ language?: string }>).detail;
      setTranslatorLanguage(detail?.language ?? "en");
    }

    window.addEventListener("page-translator:language-changed", handleLanguageChanged);

    return () => {
      window.removeEventListener("page-translator:language-changed", handleLanguageChanged);
    };
  }, []);

  useEffect(() => {
    if (!selectedItem) {
      setQuantity(1);
      setSweetness(100);
      setIce(2);
      setIsHot(false);
      setSize(0);
      setSelectedIngredients({});
      setModalTranslations(null);
      return;
    }

    window.setTimeout(() => {
      window.dispatchEvent(new Event("page-translator:refresh"));
      window.dispatchEvent(
        new CustomEvent("page-translator:translate-element", {
          detail: {
            element: modalContentRef.current
          }
        })
      );
    }, 50);
  }, [selectedItem]);

  useEffect(() => {
    let cancelled = false;

    async function translateModalCopy() {
      if (!selectedItem) {
        return;
      }

      if (translatorLanguage === "en") {
        setModalTranslations(null);
        return;
      }

      const ingredientCostTexts = paidIngredients.map((ingredient) => `+${formatCurrency(ingredient.addCost)} each`);
      const texts = [
        "Customize Drink",
        selectedItem.name,
        "Pick sweetness, ice, and any extra ingredients before adding to the cart.",
        "Base price",
        "Quantity",
        "Sweetness",
        "Ice",
        ...iceOptions.map((option) => option.label),
        "Extra Ingredients",
        "Choose any extras you want to add to this drink.",
        ...paidIngredients.map((ingredient) => ingredient.name),
        ...ingredientCostTexts,
        "Remove",
        "Add",
        "Item total",
        "Cancel",
        "Add to Cart"
      ];

      const response = await fetch("/api/translate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          targetLanguage: translatorLanguage,
          texts
        })
      });

      if (!response.ok) {
        return;
      }

      const payload = (await response.json()) as { translations?: string[] };
      const translated = payload.translations ?? [];

      if (cancelled || translated.length < texts.length) {
        return;
      }

      let index = 0;

      setModalTranslations({
        customizeDrink: translated[index++] ?? "Customize Drink",
        itemName: translated[index++] ?? selectedItem.name,
        description: translated[index++] ?? "Pick sweetness, ice, and any extra ingredients before adding to the cart.",
        basePrice: translated[index++] ?? "Base price",
        quantity: translated[index++] ?? "Quantity",
        sweetness: translated[index++] ?? "Sweetness",
        ice: translated[index++] ?? "Ice",
        iceOptions: iceOptions.map(() => translated[index++] ?? ""),
        extraIngredients: translated[index++] ?? "Extra Ingredients",
        extraIngredientsDescription: translated[index++] ?? "Choose any extras you want to add to this drink.",
        ingredientNames: paidIngredients.map(() => translated[index++] ?? ""),
        ingredientCosts: paidIngredients.map(() => translated[index++] ?? ""),
        remove: translated[index++] ?? "Remove",
        add: translated[index++] ?? "Add",
        itemTotal: translated[index++] ?? "Item total",
        cancel: translated[index++] ?? "Cancel",
        addToCart: translated[index++] ?? "Add to Cart"
      });
    }

    void translateModalCopy();

    return () => {
      cancelled = true;
    };
  }, [paidIngredients, selectedItem, translatorLanguage]);

  const cartTotal = useMemo(() => items.reduce((sum, item) => sum + item.cost, 0), [items]);

  function closeModal() {
    setSelectedItem(null);
    setEditingItemIndex(null);
  }

  function openAddItemModal(item: MenuItemRecord) {
    setEditingItemIndex(null);
    setSelectedItem(item);
  }

  function openEditItemModal(index: number) {
    const cartItem = items[index];

    if (!cartItem) {
      return;
    }

    const menuItem = menuItems.find((item) => item.id === cartItem.itemId);

    if (!menuItem) {
      toast.error("This menu item is no longer available to edit.");
      return;
    }

    setEditingItemIndex(index);
    setSelectedItem(menuItem);
    setQuantity(cartItem.quantity);
    setSweetness(
      sweetnessOptions.includes(cartItem.sweetness as (typeof sweetnessOptions)[number])
        ? (cartItem.sweetness as (typeof sweetnessOptions)[number])
        : 100
    );
    setIce([0, 1, 2, 3].includes(cartItem.ice) ? (cartItem.ice as 0 | 1 | 2 | 3) : 2);
    setIsHot(cartItem.isHot ?? false);
    setSize([0, 1, 2].includes(cartItem.size) ? (cartItem.size as DrinkSize) : 0);
    setSelectedIngredients(
      cartItem.ingredientChoices.reduce<SelectedIngredientState>((accumulator, choice) => {
        accumulator[choice.ingredientId] = choice.quantity;
        return accumulator;
      }, {})
    );
  }

  function updateIngredient(id: number, delta: number) {
    setSelectedIngredients((current) => {
      const next = Math.max(0, (current[id] ?? 0) + delta);

      if (next === 0) {
        const { [id]: _removed, ...rest } = current;
        return rest;
      }

      return {
        ...current,
        [id]: next
      };
    });
  }

  function addSelectedItem() {
    if (!selectedItem) {
      return;
    }

    const nextItem = {
      itemId: selectedItem.id,
      itemName: selectedItem.name,
      quantity,
      sweetness,
      ice,
      isHot,
      size,
      ingredientChoices: ingredients
        .filter((ingredient) => (selectedIngredients[ingredient.id] ?? 0) > 0)
        .map((ingredient) => ({
          ingredientId: ingredient.id,
          quantity: selectedIngredients[ingredient.id] ?? 0,
          addCost: ingredient.addCost,
          name: ingredient.name
        })),
      cost: lineTotal(selectedItem, quantity, selectedIngredients, paidIngredients, size)
    };

    if (editingItemIndex !== null) {
      updateItem(editingItemIndex, nextItem);
      toast.success(`${selectedItem.name} updated.`);
    } else {
      addItem(nextItem);
      toast.success(`${selectedItem.name} added to cart.`);
    }

    closeModal();
  }

  async function handleCheckout() {
    if (items.length === 0) {
      toast.error("Add at least one item before checkout.");
      return;
    }

    setCheckoutPending(true);

    const response = await fetch("/api/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ items })
    });

    setCheckoutPending(false);

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      toast.error(payload?.error ?? "Checkout failed.");
      return;
    }

    clear();
    toast.success("Order completed.");
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    clear();
    router.replace("/login");
    router.refresh();
  }

  return (
    <>
      <SkipLink />
      <main id={MAIN_CONTENT_ID} tabIndex={-1} className="min-h-screen bg-[rgb(var(--background))]">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="mb-6 flex flex-wrap items-center gap-4 rounded-2xl border border-border bg-[rgb(var(--surface))] p-5">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-border bg-[rgb(var(--surface-alt))] text-foreground">
              <CupSoda className="h-7 w-7" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-stone-500">Point of Sale</p>
              <h1 className="text-2xl font-semibold tracking-tight">{employee.fullName}</h1>
              <p className="text-sm text-stone-500">Manage orders and checkout.</p>
            </div>

            <Button variant="outline" onClick={logout} className="gap-2">
              <LogOut className="h-4 w-4" />
              Logout
            </Button>
          </div>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_380px]">
            <Card>
              <CardHeader>
                <CardTitle>Menu</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {menuItems.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => openAddItemModal(item)}
                      className="rounded-xl border border-border bg-[rgb(var(--surface-alt))] p-5 text-left transition hover:bg-white"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-lg font-semibold leading-tight">{item.name}</div>
                          <div className="mt-2 text-sm text-stone-500">{formatCurrency(item.cost)}</div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="h-fit xl:sticky xl:top-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5" />
                  Cart
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="max-h-[420px] space-y-3 overflow-y-auto pr-1">
                  {items.length === 0 ? (
                    <div className="rounded-[1.5rem] border border-dashed border-border bg-[rgb(var(--surface-alt))] px-5 py-8 text-center text-sm text-stone-500">
                      Click a drink to customize it and add it to the cart.
                    </div>
                  ) : (
                    items.map((item, index) => (
                      <button
                        key={`${item.itemId}-${index}`}
                        type="button"
                        onClick={() => openEditItemModal(index)}
                        className="w-full rounded-xl border border-border bg-[rgb(var(--surface-alt))] p-4 text-left transition hover:bg-white"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="font-semibold">{item.itemName}</div>
                            <div className="mt-1 text-sm text-stone-600">
                              Qty {item.quantity} | {sizeOptions.find((o) => o.value === item.size)?.label ?? "Small"} | Sweet {item.sweetness}%{item.isHot ? " | Hot" : ` | Ice ${item.ice}`}
                            </div>
                            <div className="mt-1 text-sm text-stone-500">
                              {item.ingredientChoices.length > 0
                                ? item.ingredientChoices.map((choice) => `${choice.name} x${choice.quantity}`).join(", ")
                                : "No extra ingredients"}
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <div className="rounded-lg border border-border bg-white px-3 py-2 text-sm font-semibold">
                              {formatCurrency(item.cost)}
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(event) => {
                                event.stopPropagation();
                                removeItem(index);
                              }}
                            >
                              Remove
                            </Button>
                          </div>
                        </div>
                      </button>
                    ))
                  )}
                </div>

                <div className="rounded-xl border border-border bg-[rgb(var(--surface-alt))] p-5">
                  <div className="flex items-center justify-between text-sm text-stone-500">
                    <span>Items in order</span>
                    <span>{items.length}</span>
                  </div>
                  <div className="mt-4 flex items-end justify-between gap-4">
                    <span className="font-medium">Total</span>
                    <span className="text-3xl font-semibold tracking-tight">{formatCurrency(cartTotal)}</span>
                  </div>
                </div>

                <Button className="w-full gap-2" size="lg" onClick={handleCheckout} disabled={checkoutPending}>
                  <Receipt className="h-4 w-4" />
                  {checkoutPending ? "Completing order..." : "Complete Order"}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>

        {selectedItem ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div
              ref={modalContentRef}
              className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-border bg-[rgb(var(--surface))]"
            >
              <div className="sticky top-0 flex items-start justify-between gap-4 border-b border-border bg-[rgb(var(--surface))] p-6">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.24em] text-stone-500">
                    {modalTranslations?.customizeDrink ?? "Customize Drink"}
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight">
                    {modalTranslations?.itemName ?? selectedItem.name}
                  </h2>
                  <p className="mt-2 text-sm text-stone-500">
                    {modalTranslations?.description ?? "Pick sweetness, ice, and any extra ingredients before adding to the cart."}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-lg border border-border bg-white p-2 text-stone-500 transition hover:bg-[rgb(var(--muted))]"
                  aria-label="Close ingredient modal"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-6 p-6">
                <div className="rounded-xl border border-border bg-[rgb(var(--surface-alt))] p-5">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium">{modalTranslations?.basePrice ?? "Base price"}</span>
                    <span className="text-lg font-semibold">{formatCurrency(selectedItem.cost)}</span>
                  </div>
                </div>

                <section className="space-y-3">
                  <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-stone-500">
                    {modalTranslations?.quantity ?? "Quantity"}
                  </h3>
                  <div className="flex items-center gap-3">
                    <Button variant="outline" size="icon" onClick={() => setQuantity((current) => Math.max(1, current - 1))}>
                      <Minus className="h-4 w-4" />
                    </Button>
                    <div className="min-w-[5rem] rounded-lg border border-border bg-[rgb(var(--surface-alt))] px-4 py-3 text-center text-lg font-semibold">
                      {quantity}
                    </div>
                    <Button variant="outline" size="icon" onClick={() => setQuantity((current) => Math.min(20, current + 1))}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </section>

                <section className="space-y-3">
                  <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-stone-500">Size</h3>
                  <div className="flex flex-wrap gap-2">
                    {sizeOptions.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setSize(option.value)}
                        className={cn(
                          "rounded-2xl border px-4 py-2.5 text-sm font-medium transition",
                          size === option.value
                            ? "border-foreground bg-foreground text-white"
                            : "border-border bg-white text-foreground hover:bg-[rgb(var(--muted))]"
                        )}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </section>

                <section className="space-y-3">
                  <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-stone-500">
                    {modalTranslations?.sweetness ?? "Sweetness"}
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {sweetnessOptions.map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => setSweetness(option)}
                        className={cn(
                          "rounded-2xl border px-4 py-2.5 text-sm font-medium transition",
                          sweetness === option
                            ? "border-foreground bg-foreground text-white"
                            : "border-border bg-white text-foreground hover:bg-[rgb(var(--muted))]"
                        )}
                      >
                        {option}%
                      </button>
                    ))}
                  </div>
                </section>

                <section className="space-y-3">
                  <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-stone-500">
                    Temperature
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {(["Iced", "Hot"] as const).map((option) => {
                      const selected = option === "Hot" ? isHot : !isHot;
                      return (
                        <button
                          key={option}
                          type="button"
                          onClick={() => setIsHot(option === "Hot")}
                          className={cn(
                            "rounded-2xl border px-4 py-2.5 text-sm font-medium transition",
                            selected
                              ? "border-foreground bg-foreground text-white"
                              : "border-border bg-white text-foreground hover:bg-[rgb(var(--muted))]"
                          )}
                        >
                          {option}
                        </button>
                      );
                    })}
                  </div>
                </section>

                {!isHot && (
                <section className="space-y-3">
                  <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-stone-500">
                    {modalTranslations?.ice ?? "Ice"}
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {iceOptions.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setIce(option.value)}
                        className={cn(
                          "rounded-2xl border px-4 py-2.5 text-sm font-medium transition",
                          ice === option.value
                            ? "border-foreground bg-foreground text-white"
                            : "border-border bg-white text-foreground hover:bg-[rgb(var(--muted))]"
                        )}
                      >
                        {modalTranslations?.iceOptions[option.value] ?? option.label}
                      </button>
                    ))}
                  </div>
                </section>
                )}

                <section className="space-y-4">
                  <div>
                    <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-stone-500">
                      {modalTranslations?.extraIngredients ?? "Extra Ingredients"}
                    </h3>
                    <p className="mt-1 text-sm text-stone-500">
                      {modalTranslations?.extraIngredientsDescription ?? "Choose any extras you want to add to this drink."}
                    </p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {paidIngredients.map((ingredient, index) => {
                      const selectedQuantity = selectedIngredients[ingredient.id] ?? 0;

                      return (
                        <div key={ingredient.id} className="rounded-xl border border-border bg-[rgb(var(--surface-alt))] p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="font-semibold">{modalTranslations?.ingredientNames[index] ?? ingredient.name}</div>
                              <div className="mt-1 text-sm text-stone-500">
                                {modalTranslations?.ingredientCosts[index] ?? `+${formatCurrency(ingredient.addCost)} each`}
                              </div>
                            </div>
                            <div className="rounded-lg border border-border bg-white px-3 py-2 text-sm font-semibold">{selectedQuantity}</div>
                          </div>
                          <div className="mt-4 flex gap-2">
                            <Button variant="outline" size="sm" onClick={() => updateIngredient(ingredient.id, -1)} className="flex-1">
                              {modalTranslations?.remove ?? "Remove"}
                            </Button>
                            <Button size="sm" onClick={() => updateIngredient(ingredient.id, 1)} className="flex-1">
                              {modalTranslations?.add ?? "Add"}
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>

                <div className="rounded-xl border border-border bg-[rgb(var(--surface-alt))] p-5">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{modalTranslations?.itemTotal ?? "Item total"}</span>
                    <span className="text-2xl font-semibold">
                      {formatCurrency(lineTotal(selectedItem, quantity, selectedIngredients, paidIngredients, size))}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap justify-end gap-3">
                  <Button variant="outline" onClick={closeModal}>
                    {modalTranslations?.cancel ?? "Cancel"}
                  </Button>
                  <Button onClick={addSelectedItem}>
                    {editingItemIndex !== null ? "Save Changes" : modalTranslations?.addToCart ?? "Add to Cart"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </main>
    </>
  );
}
