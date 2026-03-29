"use client";

import { X, Minus, Plus, ShoppingCart, CupSoda, LogOut, Receipt } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { IngredientRecord, MenuItemRecord, SessionEmployee } from "@/lib/types";
import { useOrderStore } from "@/lib/stores/order-store";
import { cn, formatCurrency } from "@/lib/utils";

type PosClientProps = {
  employee: SessionEmployee;
  menuItems: MenuItemRecord[];
  ingredients: IngredientRecord[];
};

const sweetnessOptions = [0, 25, 50, 75, 100] as const;
const iceOptions = [
  { label: "No Ice", value: 0 },
  { label: "Light", value: 1 },
  { label: "Regular", value: 2 },
  { label: "Extra", value: 3 }
] as const;

type SelectedIngredientState = Record<number, number>;

function lineTotal(item: MenuItemRecord, quantity: number, selectedIngredients: SelectedIngredientState, ingredients: IngredientRecord[]) {
  const addOnTotal = ingredients.reduce((sum, ingredient) => {
    const ingredientQuantity = selectedIngredients[ingredient.id] ?? 0;
    return sum + ingredient.addCost * ingredientQuantity;
  }, 0);

  return (item.cost + addOnTotal) * quantity;
}

export function PosClient({ employee, menuItems, ingredients }: PosClientProps) {
  const router = useRouter();
  const items = useOrderStore((state) => state.items);
  const addItem = useOrderStore((state) => state.addItem);
  const removeItem = useOrderStore((state) => state.removeItem);
  const clear = useOrderStore((state) => state.clear);

  const [selectedItem, setSelectedItem] = useState<MenuItemRecord | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [sweetness, setSweetness] = useState<(typeof sweetnessOptions)[number]>(100);
  const [ice, setIce] = useState<0 | 1 | 2 | 3>(2);
  const [selectedIngredients, setSelectedIngredients] = useState<SelectedIngredientState>({});
  const [checkoutPending, setCheckoutPending] = useState(false);

  useEffect(() => {
    if (!selectedItem) {
      setQuantity(1);
      setSweetness(100);
      setIce(2);
      setSelectedIngredients({});
    }
  }, [selectedItem]);

  const cartTotal = useMemo(() => items.reduce((sum, item) => sum + item.cost, 0), [items]);

  function closeModal() {
    setSelectedItem(null);
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

    const ingredientChoices = ingredients
      .filter((ingredient) => (selectedIngredients[ingredient.id] ?? 0) > 0)
      .map((ingredient) => ({
        ingredientId: ingredient.id,
        quantity: selectedIngredients[ingredient.id] ?? 0,
        addCost: ingredient.addCost,
        name: ingredient.name
      }));

    addItem({
      itemId: selectedItem.id,
      itemName: selectedItem.name,
      quantity,
      sweetness,
      ice,
      ingredientChoices,
      cost: lineTotal(selectedItem, quantity, selectedIngredients, ingredients)
    });

    toast.success(`${selectedItem.name} added to cart.`);
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
    <main className="min-h-screen bg-[rgb(var(--background))]">
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

          {employee.isManager && (
              <Link href="/manager">
                <Button variant="outline">Manager Dashboard</Button>
              </Link>
            )}
          
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
                    onClick={() => setSelectedItem(item)}
                    className="rounded-xl border border-border bg-[rgb(var(--surface-alt))] p-5 text-left transition hover:bg-white"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-lg font-semibold leading-tight">{item.name}</div>
                        <div className="mt-2 text-sm text-stone-500">{formatCurrency(item.cost)}</div>
                      </div>
                      <div className="rounded-lg border border-border bg-white px-3 py-2 text-xs font-semibold text-foreground">Customize</div>
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
                    <div key={`${item.itemId}-${index}`} className="rounded-xl border border-border bg-[rgb(var(--surface-alt))] p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-semibold">{item.itemName}</div>
                          <div className="mt-1 text-sm text-stone-600">
                            Qty {item.quantity} | Sweet {item.sweetness}% | Ice {item.ice}
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
                          <Button variant="ghost" size="sm" onClick={() => removeItem(index)}>
                            Remove
                          </Button>
                        </div>
                      </div>
                    </div>
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
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-border bg-[rgb(var(--surface))]">
            <div className="sticky top-0 flex items-start justify-between gap-4 border-b border-border bg-[rgb(var(--surface))] p-6">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-stone-500">Customize Drink</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight">{selectedItem.name}</h2>
                <p className="mt-2 text-sm text-stone-500">Pick sweetness, ice, and any extra ingredients before adding to the cart.</p>
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
                  <span className="font-medium">Base price</span>
                  <span className="text-lg font-semibold">{formatCurrency(selectedItem.cost)}</span>
                </div>
              </div>

              <section className="space-y-3">
                <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-stone-500">Quantity</h3>
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
                <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-stone-500">Sweetness</h3>
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
                <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-stone-500">Ice</h3>
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
                      {option.label}
                    </button>
                  ))}
                </div>
              </section>

              <section className="space-y-4">
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-stone-500">Extra Ingredients</h3>
                  <p className="mt-1 text-sm text-stone-500">Choose any extras you want to add to this drink.</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {ingredients.map((ingredient) => {
                    const selectedQuantity = selectedIngredients[ingredient.id] ?? 0;

                    return (
                      <div key={ingredient.id} className="rounded-xl border border-border bg-[rgb(var(--surface-alt))] p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-semibold">{ingredient.name}</div>
                            <div className="mt-1 text-sm text-stone-500">+{formatCurrency(ingredient.addCost)} each</div>
                          </div>
                          <div className="rounded-lg border border-border bg-white px-3 py-2 text-sm font-semibold">{selectedQuantity}</div>
                        </div>
                        <div className="mt-4 flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => updateIngredient(ingredient.id, -1)} className="flex-1">
                            Remove
                          </Button>
                          <Button size="sm" onClick={() => updateIngredient(ingredient.id, 1)} className="flex-1">
                            Add
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              <div className="rounded-xl border border-border bg-[rgb(var(--surface-alt))] p-5">
                <div className="flex items-center justify-between">
                  <span className="font-medium">Item total</span>
                  <span className="text-2xl font-semibold">
                    {formatCurrency(lineTotal(selectedItem, quantity, selectedIngredients, ingredients))}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap justify-end gap-3">
                <Button variant="outline" onClick={closeModal}>
                  Cancel
                </Button>
                <Button onClick={addSelectedItem}>Add to Cart</Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
