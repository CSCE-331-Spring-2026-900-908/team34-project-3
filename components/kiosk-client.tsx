"use client";

// --- REPURPOSED FOR KIOSK (Imports) ---
// We keep most imports. We just need to update the types we use.
import { X, Minus, Plus, ShoppingCart, CupSoda, LogOut, Receipt, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CustomerWeatherWidget } from "@/components/customer-weather-widget";
import { MAIN_CONTENT_ID, SkipLink } from "@/components/skip-link";
import { TouchscreenInput } from "@/components/touchscreen-input";
// We now import SessionCustomer instead of SessionEmployee
import type { IngredientRecord, MenuItemRecord, SessionCustomer } from "@/lib/types";
import { useOrderStore } from "@/lib/stores/order-store";
import { cn, formatCurrency } from "@/lib/utils";
import Chatbot from "@/components/chatbot";

// --- REPURPOSED FOR KIOSK (Props) ---
// The props are changed to accept a `customer` object instead of an `employee` object.
type KioskClientProps = {
    customer: SessionCustomer;
    menuItems: MenuItemRecord[];
    ingredients: IngredientRecord[];
};

// The rest of the types (ModalTranslations, SelectedIngredientState) and helper functions
// (lineTotal) are IDENTICAL to pos-client.tsx [4] and can be copied directly.
// ... (omitting them for brevity, but you should copy them here) ...

// Start of copied block from POS //
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
// End of copied block from POS //

function getDrinkCategory(name: string) {
    const normalized = name.toLowerCase();

    if (normalized.includes("green tea")) {
        return "Green Tea";
    }

    if (normalized.includes("black tea")) {
        return "Black Tea";
    }

    if (normalized.includes("oolong")) {
        return "Oolong Tea";
    }

    if (normalized.includes("milk tea")) {
        return "Milk Tea";
    }

    if (normalized.includes("latte")) {
        return "Latte";
    }

    if (
        normalized.includes("grapefruit") ||
        normalized.includes("mango") ||
        normalized.includes("passionfruit") ||
        normalized.includes("strawberry") ||
        normalized.includes("lychee") ||
        normalized.includes("peach") ||
        normalized.includes("wintermelon")
    ) {
        return "Fruit Tea";
    }

    return "Specialty";
}

// --- REPURPOSED FOR KIOSK (Component Definition) ---
// We rename the component and update its props.
export function KioskClient({ customer, menuItems, ingredients }: KioskClientProps) {
    const router = useRouter();
    // All of the state management hooks (useState, useOrderStore, etc.) are IDENTICAL
    // to pos-client.tsx [4]. We can reuse all of this logic.
    const items = useOrderStore((state) => state.items);
    const addItem = useOrderStore((state) => state.addItem);
    const removeItem = useOrderStore((state) => state.removeItem);
    const clear = useOrderStore((state) => state.clear);
    const [selectedItem, setSelectedItem] = useState<MenuItemRecord | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [activeCategory, setActiveCategory] = useState("All");
    const [searchKeyboardOpen, setSearchKeyboardOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<"menu" | "rewards">("menu");
    const [rewardsPoints, setRewardsPoints] = useState(0);
    const [pointsToRedeem, setPointsToRedeem] = useState(0);
    // ... (all other useState and useEffect hooks are identical, copy them here) ...

    // Start of copied block from POS //
    const [quantity, setQuantity] = useState(1);
    const [sweetness, setSweetness] = useState<(typeof sweetnessOptions)[number]>(100);
    const [ice, setIce] = useState<0 | 1 | 2 | 3>(2);
    const [selectedIngredients, setSelectedIngredients] = useState<SelectedIngredientState>({});
    const [checkoutPending, setCheckoutPending] = useState(false);
    const [translatorLanguage, setTranslatorLanguage] = useState("en");
    const [modalTranslations, setModalTranslations] = useState<ModalTranslations | null>(null);
    const modalContentRef = useRef<HTMLDivElement | null>(null);

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

            const ingredientCostTexts = ingredients.map((ingredient) => `+${formatCurrency(ingredient.addCost)} each`);
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
                ...ingredients.map((ingredient) => ingredient.name),
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
                ingredientNames: ingredients.map(() => translated[index++] ?? ""),
                ingredientCosts: ingredients.map(() => translated[index++] ?? ""),
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
    }, [ingredients, selectedItem, translatorLanguage]);
    // End of copied block from POS //

    useEffect(() => {
        fetch("/api/rewards")
            .then((r) => r.json())
            .then((data: { points?: number }) => setRewardsPoints(data.points ?? 0))
            .catch(() => {});
    }, []);

    const cartTotal = useMemo(() => items.reduce((sum, item) => sum + item.cost, 0), [items]);
    const maxRedeemablePoints = Math.min(
        Math.floor(rewardsPoints / 100) * 100,
        Math.floor(cartTotal) * 100
    );
    const discount = Math.floor(pointsToRedeem / 100);

    useEffect(() => {
        if (pointsToRedeem > maxRedeemablePoints) {
            setPointsToRedeem(maxRedeemablePoints);
        }
    }, [maxRedeemablePoints, pointsToRedeem]);
    const categories = useMemo(
        () => ["All", ...Array.from(new Set(menuItems.map((item) => getDrinkCategory(item.name))))],
        [menuItems]
    );
    const filteredMenuItems = useMemo(() => {
        const normalizedQuery = searchQuery.trim().toLowerCase();

        return menuItems.filter((item) => {
            const matchesCategory = activeCategory === "All" || getDrinkCategory(item.name) === activeCategory;
            const matchesSearch = !normalizedQuery || item.name.toLowerCase().includes(normalizedQuery);
            return matchesCategory && matchesSearch;
        });
    }, [activeCategory, menuItems, searchQuery]);

    // All the functions (closeModal, updateIngredient, addSelectedItem, handleCheckout) are
    // IDENTICAL to pos-client.tsx [4], copy them here.

    // Start of copied block from POS //
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
            body: JSON.stringify({ items, pointsToRedeem })
        });

        setCheckoutPending(false);

        if (!response.ok) {
            const payload = (await response.json().catch(() => null)) as { error?: string } | null;
            toast.error(payload?.error ?? "Checkout failed.");
            return;
        }

        clear();
        setPointsToRedeem(0);
        setActiveTab("menu");
        // Refresh points balance after checkout (earned points added, redeemed points subtracted)
        fetch("/api/rewards")
            .then((r) => r.json())
            .then((data: { points?: number }) => setRewardsPoints(data.points ?? 0))
            .catch(() => {});
        toast.success("Order completed.");
    }
    // End of copied block from POS //

    // --- REPURPOSED FOR KIOSK (Logout Function) ---
    // The customer logout endpoint is different from the employee one.
    async function logout() {
        // The original PosClient used "/api/auth/logout" [4].
        // From kiosk/page.tsx, we see the customer logout is "/api/auth/customer/logout" [2].
        await fetch("/api/auth/customer/logout", { method: "POST" });
        clear(); // Clear the cart on logout
        router.replace("/"); // Go back to the home page
        // TODO: Should this go back to the home page or somewhere else...?
        router.refresh();
    }

    return (
        <>
            <SkipLink />
            {/* --- REPURPOSED FOR KIOSK (Main Layout) --- */}
            <main id={MAIN_CONTENT_ID} tabIndex={-1} className="min-h-screen bg-stone-100">
                <div className={cn("mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8", searchKeyboardOpen && "pb-[32rem]")}>

                    {/* --- REPURPOSED FOR KIOSK (Header) --- */}
                    {/* We replace the employee-specific header with a customer welcome message. */}
                    <div className="mb-6 flex flex-wrap items-center gap-4 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
                        <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
                            <CupSoda className="h-7 w-7" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-sm font-bold uppercase tracking-widest text-stone-500">Welcome</p>
                            <h1 className="text-2xl font-semibold tracking-tight">{customer.fullName}</h1>
                            <p className="text-sm text-stone-500">Ready to order? Select an item below.</p>
                        </div>
                        <div className="shrink-0">
                            <CustomerWeatherWidget />
                        </div>
                        <div className="flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-sm font-semibold text-blue-700">
                            <Receipt className="h-4 w-4" />
                            {rewardsPoints} pts
                        </div>
                        <Button variant="outline" onClick={logout} className="ml-auto gap-2">
                            <LogOut className="h-4 w-4" />
                            Sign Out
                        </Button>
                    </div>

                    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_380px]">
                        <Card className="shadow-sm">
                            <CardHeader>
                                <div className="space-y-4">
                                    <div className="flex items-center gap-4">
                                        <button
                                            type="button"
                                            onClick={() => setActiveTab("menu")}
                                            className={cn("text-xl font-semibold transition-colors", activeTab === "menu" ? "text-stone-900" : "text-stone-400 hover:text-stone-600")}
                                        >
                                            Menu
                                        </button>
                                        <span className="text-stone-300">|</span>
                                        <button
                                            type="button"
                                            onClick={() => setActiveTab("rewards")}
                                            className={cn("flex items-center gap-2 text-xl font-semibold transition-colors", activeTab === "rewards" ? "text-stone-900" : "text-stone-400 hover:text-stone-600")}
                                        >
                                            Rewards
                                            {rewardsPoints > 0 && (
                                                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">
                                                    {rewardsPoints} pts
                                                </span>
                                            )}
                                        </button>
                                    </div>
                                    {activeTab === "menu" && (
                                        <div className="flex flex-col gap-4">
                                            <div className="relative max-w-md">
                                                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                                                <TouchscreenInput
                                                    value={searchQuery}
                                                    onValueChange={setSearchQuery}
                                                    onKeyboardOpenChange={setSearchKeyboardOpen}
                                                    placeholder="Search for a drink"
                                                    className="pl-9"
                                                />
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                {categories.map((category) => (
                                                    <Button
                                                        key={category}
                                                        variant={activeCategory === category ? "default" : "outline"}
                                                        size="sm"
                                                        onClick={() => setActiveCategory(category)}
                                                    >
                                                        {category}
                                                    </Button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </CardHeader>
                            <CardContent>
                                {activeTab === "rewards" ? (
                                    <div className="space-y-6">
                                        <div className="rounded-xl border border-blue-200 bg-blue-50 p-5">
                                            <p className="text-sm text-blue-600">Your balance</p>
                                            <p className="mt-1 text-4xl font-bold tracking-tight text-blue-700">{rewardsPoints} pts</p>
                                            <p className="mt-1 text-sm text-blue-500">Worth {formatCurrency(Math.floor(rewardsPoints / 100))}</p>
                                        </div>
                                        <div className="space-y-3">
                                            <p className="font-medium">Redeem points</p>
                                            <p className="text-sm text-stone-500">100 points = $1.00 off your order</p>
                                            <div className="flex items-center gap-4">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => setPointsToRedeem((p) => Math.max(0, p - 100))}
                                                    disabled={pointsToRedeem === 0}
                                                >
                                                    <Minus className="h-4 w-4" />
                                                </Button>
                                                <span className="w-24 text-center text-2xl font-semibold">{pointsToRedeem} pts</span>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => setPointsToRedeem((p) => Math.min(maxRedeemablePoints, p + 100))}
                                                    disabled={pointsToRedeem >= maxRedeemablePoints}
                                                >
                                                    <Plus className="h-4 w-4" />
                                                </Button>
                                            </div>
                                            {pointsToRedeem > 0 && (
                                                <p className="text-sm font-medium text-green-700">
                                                    {formatCurrency(discount)} discount applied to your order
                                                </p>
                                            )}
                                        </div>
                                        <Button variant="outline" className="w-full" onClick={() => setActiveTab("menu")}>
                                            Back to Menu
                                        </Button>
                                    </div>
                                ) : (
                                <>
                                {/* --- REPURPOSED FOR KIOSK (Menu Grid) --- */}
                                {/* We change the grid to be more spacious and visually appealing for a kiosk. */}
                                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                                    {filteredMenuItems.map((item) => (
                                        // --- REPURPOSED FOR KIOSK (Menu Item Card) ---
                                        // This is the biggest change. We replace the simple text button from PosClient [4]
                                        // with a large, visual, clickable card that includes our new `imageUrl`.
                                        <button
                                            key={item.id}
                                            type="button"
                                            onClick={() => setSelectedItem(item)}
                                            className="group flex flex-col text-left overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm transition-all hover:shadow-lg hover:border-blue-500"
                                        >
                                            {/* Placeholder Image using the new `imageUrl` field */}
                                            <img
                                                src={item.imageUrl}
                                                alt={item.name}
                                                className="w-full h-40 object-cover bg-stone-200"
                                            />
                                            <div className="p-4 flex-1 flex flex-col">
                                                <div className="flex-1">
                                                    <h3 className="text-lg font-semibold leading-tight group-hover:text-blue-600">{item.name}</h3>
                                                </div>
                                                <div className="mt-2 text-xl font-bold text-stone-800">{formatCurrency(item.cost)}</div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                                {filteredMenuItems.length === 0 ? (
                                    <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50 px-5 py-8 text-center text-sm text-stone-500">
                                        No drinks match your current search and category filters.
                                    </div>
                                ) : null}
                                </>
                                )}
                            </CardContent>
                        </Card>

                        {/* --- REPURPOSED FOR KIOSK (Cart) --- */}
                        {/* The entire cart component is almost identical to PosClient [4]. */}
                        {/* It already reads from the shared `useOrderStore`, so it will work automatically. */}
                        {/* We can just copy the <Card> for the cart directly from pos-client.tsx. */}
                        <Card className="h-fit xl:sticky xl:top-6 shadow-sm">
                            { /* ... (Paste the entire Cart Card JSX from pos-client.tsx here) ... */}
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
                                    {discount > 0 && (
                                        <div className="mt-2 flex items-center justify-between text-sm text-green-700">
                                            <span>Rewards discount ({pointsToRedeem} pts)</span>
                                            <span>−{formatCurrency(discount)}</span>
                                        </div>
                                    )}
                                    <div className="mt-4 flex items-end justify-between gap-4">
                                        <span className="font-medium">Total</span>
                                        <span className="text-3xl font-semibold tracking-tight">{formatCurrency(Math.max(0, cartTotal - discount))}</span>
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

                {/* --- REPURPOSED FOR KIOSK (Customization Modal) --- */}
                {/* This modal logic is IDENTICAL to PosClient [4]. It will appear when `selectedItem` is set. */}
                {/* You can copy the entire modal block from the bottom of pos-client.tsx here. */}
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
                                        {ingredients.map((ingredient, index) => {
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
                                            {formatCurrency(lineTotal(selectedItem, quantity, selectedIngredients, ingredients))}
                                        </span>
                                    </div>
                                </div>

                                <div className="flex flex-wrap justify-end gap-3">
                                    <Button variant="outline" onClick={closeModal}>
                                        {modalTranslations?.cancel ?? "Cancel"}
                                    </Button>
                                    <Button onClick={addSelectedItem}>{modalTranslations?.addToCart ?? "Add to Cart"}</Button>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : null}
            </main>
        </>
    );
}
