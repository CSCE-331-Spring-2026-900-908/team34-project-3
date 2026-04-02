import { getIngredientAddOns, getMenuItems } from "@/lib/db/menu-items";
import { formatCurrency } from "@/lib/utils";

export default async function MenuBoardPage() {
  const [menuItems, ingredients] = await Promise.all([getMenuItems(), getIngredientAddOns()]);

  return (
    <main className="min-h-screen bg-[rgb(var(--background))] px-2 py-4">
      <div className="mx-auto max-w-5xl">
        <section className="mb-4 rounded-[1.5rem] border border-border bg-[rgb(var(--surface))] px-5 py-4 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-stone-500">Customer Menu</p>
          <div className="mt-2 flex items-end justify-between gap-4">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Choose Your Drink</h1>
            <p className="text-sm text-stone-500">{menuItems.length} items</p>
          </div>
        </section>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,500px)_640px] lg:justify-center">
          <section>
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
          </section>

          <aside className="h-fit rounded-[1.25rem] border border-border bg-[rgb(var(--surface))] p-3 shadow-sm">
            <div className="mb-2">
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-stone-500">Add-Ons</p>
              <h2 className="mt-1 text-base font-semibold tracking-tight text-foreground">Additional Ingredients</h2>
            </div>

            <div className="grid grid-cols-2 gap-x-4">
              {ingredients.map((ingredient) => (
                <div
                  key={ingredient.id}
                  className="flex items-center justify-between gap-3 border-b border-border py-1.5 last:border-b-0"
                >
                  <span className="text-sm font-medium text-foreground">{ingredient.name}</span>
                  <span className="text-sm font-semibold text-stone-600">+{formatCurrency(ingredient.addCost)}</span>
                </div>
              ))}
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
