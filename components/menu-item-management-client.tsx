"use client";

import { useRouter } from "next/navigation";
import { useDeferredValue, useMemo, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { toast } from "sonner";

import {
  ManagerFilterBar,
  ManagerPaneHeader,
  ManagerScrollArea
} from "@/components/manager-primitives";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { MenuItemRecord } from "@/lib/types";
import type { Ingredient } from "@/lib/db/inventory";
import { formatCurrency } from "@/lib/utils";

type Props = {
  menuItems: MenuItemRecord[];
  ingredients: Ingredient[];
};

export function MenuItemManagementClient({ menuItems, ingredients }: Props) {
  const router = useRouter();
  const [selectedItem, setSelectedItem] = useState<MenuItemRecord | null>(null);
  const [name, setName] = useState("");
  const [rawCost, setRawCost] = useState("");
  const [ingredientQuantities, setIngredientQuantities] = useState<Record<number, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());

  const filteredItems = useMemo(() => {
    return menuItems.filter((item) => {
      if (!deferredQuery) {
        return true;
      }

      return item.name.toLowerCase().includes(deferredQuery);
    });
  }, [deferredQuery, menuItems]);

  function selectItem(item: MenuItemRecord) {
    setSelectedItem(item);
    setName(item.name);
    setRawCost(String(item.cost));
    setIngredientQuantities({ ...item.ingredients });
  }

  function clearForm() {
    setSelectedItem(null);
    setName("");
    setRawCost("");
    setIngredientQuantities({});
  }

  function updateIngredient(id: number, delta: number) {
    setIngredientQuantities((current) => {
      const next = Math.max(0, (current[id] ?? 0) + delta);

      if (next === 0) {
        const { [id]: _removed, ...rest } = current;
        return rest;
      }

      return { ...current, [id]: next };
    });
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error("Name is required.");
      return;
    }

    const costValue = Number(rawCost);
    if (Number.isNaN(costValue) || costValue < 0) {
      toast.error("Enter a valid cost.");
      return;
    }

    setSubmitting(true);

    const body = {
      name: trimmedName,
      rawCost,
      ingredients: ingredientQuantities
    };

    const url = selectedItem
      ? `/api/menu-items/${selectedItem.id}`
      : "/api/menu-items";

    const method = selectedItem ? "PUT" : "POST";

    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    setSubmitting(false);

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      toast.error(payload?.error ?? "Failed to save menu item.");
      return;
    }

    toast.success(selectedItem ? "Menu item updated." : "Menu item created.");
    clearForm();
    router.refresh();
  }

  async function handleDelete() {
    if (!selectedItem || deleting) {
      return;
    }

    const confirmed = window.confirm(`Delete menu item "${selectedItem.name}"?`);

    if (!confirmed) {
      return;
    }

    setDeleting(true);

    const response = await fetch(`/api/menu-items/${selectedItem.id}`, {
      method: "DELETE"
    });

    setDeleting(false);

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      toast.error(payload?.error ?? "Failed to delete menu item.");
      return;
    }

    toast.success("Menu item deleted.");
    clearForm();
    router.refresh();
  }

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      {/* Left: Menu item list */}
      <section className="space-y-4">
          <ManagerPaneHeader
            title="Menu Items"
            action={(
              <Button size="sm" onClick={clearForm}>
                + New Item
              </Button>
            )}
          />

          <ManagerFilterBar>
            <Input
              className="lg:max-w-[22rem]"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search menu items"
            />
          </ManagerFilterBar>

          <ManagerScrollArea className="space-y-3">
            {filteredItems.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-border px-4 py-6 text-sm text-stone-500">
                No menu items match the current search.
              </p>
            ) : (
              filteredItems.map((item) => (
                <Card
                  key={item.id}
                  className={`cursor-pointer transition hover:border-foreground/30 ${
                    selectedItem?.id === item.id ? "border-foreground/50 bg-[rgb(var(--surface-alt))]" : ""
                  }`}
                  onClick={() => selectItem(item)}
                >
                  <CardContent className="flex items-center justify-between gap-4 px-5 py-4 sm:px-6 sm:py-5">
                    <div>
                      <p className="font-semibold">{item.name}</p>
                      <p className="text-sm text-stone-500">
                        {Object.keys(item.ingredients).length} ingredient(s)
                      </p>
                    </div>
                    <div className="rounded-lg border border-border bg-white px-3 py-2 text-sm font-semibold">
                      {formatCurrency(item.cost)}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </ManagerScrollArea>
      </section>

      {/* Right: Menu item form */}
      <section>
          <Card>
            <CardHeader>
              <CardTitle>
                {selectedItem ? `Edit: ${selectedItem.name}` : "New Menu Item"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="itemName">Name</Label>
                  <Input
                    id="itemName"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Enter item name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="itemCost">Cost ($)</Label>
                  <Input
                    id="itemCost"
                    value={rawCost}
                    onChange={(event) => setRawCost(event.target.value)}
                    placeholder="0.00"
                  />
                </div>

                <div className="space-y-3">
                  <div>
                    <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-stone-500">
                      Ingredients
                    </h3>
                    <p className="mt-1 text-sm text-stone-500">
                      Set the quantity of each ingredient used per item.
                    </p>
                  </div>

                  <ManagerScrollArea className="max-h-[320px] space-y-3">
                    {ingredients.map((ingredient) => {
                      const qty = ingredientQuantities[ingredient.id] ?? 0;

                      return (
                        <div
                          key={ingredient.id}
                          className="flex items-center justify-between gap-3 rounded-xl border border-border bg-[rgb(var(--surface-alt))] p-3"
                        >
                          <span className="text-sm font-medium">{ingredient.name}</span>
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => updateIngredient(ingredient.id, -1)}
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <div className="min-w-[3rem] rounded-lg border border-border bg-white px-3 py-1.5 text-center text-sm font-semibold">
                              {qty}
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => updateIngredient(ingredient.id, 1)}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </ManagerScrollArea>
                </div>

                <div className="flex gap-3">
                  <Button type="submit" disabled={submitting} className="flex-1">
                    {submitting
                      ? "Saving..."
                      : selectedItem
                        ? "Save Changes"
                        : "Create Item"}
                  </Button>
                  {selectedItem ? (
                    <Button type="button" variant="outline" onClick={clearForm}>
                      Cancel
                    </Button>
                  ) : null}
                  {selectedItem ? (
                    <Button type="button" variant="outline" onClick={() => void handleDelete()} disabled={deleting}>
                      {deleting ? "Deleting..." : "Delete"}
                    </Button>
                  ) : null}
                </div>
              </form>
            </CardContent>
          </Card>
      </section>
    </div>
  );
}
