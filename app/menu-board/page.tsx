import Image from "next/image";

import { MAIN_CONTENT_ID, SkipLink } from "@/components/skip-link";
import { getIngredientAddOns, getMenuItems } from "@/lib/db/menu-items";
import { formatCurrency } from "@/lib/utils";

export default async function MenuBoardPage() {
  const [menuItems, ingredients] = await Promise.all([getMenuItems(), getIngredientAddOns()]);
  const paidIngredients = ingredients.filter((ingredient) => ingredient.addCost > 0);
  const featuredItems = menuItems.slice(0, 6);

  return (
    <>
      <SkipLink />
      <main id={MAIN_CONTENT_ID} tabIndex={-1} className="min-h-screen bg-[rgb(var(--background))] px-2 py-4">
        <div className="mx-auto max-w-5xl">
          <section className="mb-4 rounded-[1.5rem] border border-border bg-[rgb(var(--surface))] px-5 py-4 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-stone-500">Customer Menu</p>
            <div className="mt-2 flex items-end justify-between gap-4">
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">Choose Your Drink</h1>
              <p className="text-sm text-stone-500">{menuItems.length} items</p>
            </div>
          </section>

          <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
            <section className="h-fit rounded-[1.25rem] border border-border bg-[rgb(var(--surface))] p-3 shadow-sm">
              <div className="mb-2">
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-stone-500">Pictures</p>
                <h2 className="mt-1 text-base font-semibold tracking-tight text-foreground">Drink Photos</h2>
              </div>

              <div className="grid gap-2">
                {featuredItems.length > 0 ? (
                  featuredItems.map((item) => (
                    <div
                      key={`featured-${item.id}`}
                      className="overflow-hidden rounded-lg border border-border bg-[rgb(var(--surface-alt))]"
                    >
                      <Image src={item.imageUrl} alt={item.name} width={320} height={192} className="h-24 w-full object-cover" />
                    </div>
                  ))
                ) : (
                  <p className="py-1.5 text-sm text-stone-500">No drink photos available right now.</p>
                )}
              </div>
            </section>

            <section className="space-y-4">
              <div>
                <div className="mb-2">
                  <p className="text-xs font-bold uppercase tracking-[0.24em] text-stone-500">Drinks</p>
                </div>

                <div className="grid grid-cols-2 gap-x-6 rounded-[1.25rem] border border-border bg-[rgb(var(--surface))] px-4 py-2 shadow-sm">
                  {menuItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-4 border-b border-border px-1 py-2 last:border-b-0"
                    >
                      <div className="text-sm font-medium leading-tight text-foreground">{item.name}</div>
                      <div className="whitespace-nowrap text-sm font-semibold text-stone-600">{formatCurrency(item.cost)}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="h-fit rounded-[1.25rem] border border-border bg-[rgb(var(--surface))] p-3 shadow-sm">
                <div className="mb-2">
                  <p className="text-xs font-bold uppercase tracking-[0.24em] text-stone-500">Add-Ons</p>
                  <h2 className="mt-1 text-base font-semibold tracking-tight text-foreground">Additional Ingredients</h2>
                </div>

                <div className="grid grid-cols-2 gap-x-4">
                  {paidIngredients.length > 0 ? (
                    paidIngredients.map((ingredient) => (
                      <div
                        key={ingredient.id}
                        className="flex items-center justify-between gap-3 border-b border-border py-1.5 last:border-b-0"
                      >
                        <span className="text-sm font-medium text-foreground">{ingredient.name}</span>
                        <span className="text-sm font-semibold text-stone-600">+{formatCurrency(ingredient.addCost)}</span>
                      </div>
                    ))
                  ) : (
                    <p className="col-span-2 py-1.5 text-sm text-stone-500">No paid add-ons available right now.</p>
                  )}
                </div>
              </div>
            </section>
          </div>
        </div>
      </main>
    </>
  );
}
