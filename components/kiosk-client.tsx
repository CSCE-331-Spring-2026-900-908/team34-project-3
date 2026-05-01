"use client";

// --- REPURPOSED FOR KIOSK (Imports) ---
// We keep most imports. We just need to update the types we use.
import { X, Minus, Plus, ShoppingCart, CupSoda, LogOut, Receipt, Search, MessageCircle, Gift, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CustomerWeatherWidget } from "@/components/customer-weather-widget";
import { MAIN_CONTENT_ID, SkipLink } from "@/components/skip-link";
import { TouchscreenInput } from "@/components/touchscreen-input";
// We now import SessionCustomer instead of SessionEmployee
import type { IngredientRecord, MenuItemRecord, SessionCustomer, SessionEmployee } from "@/lib/types";
import { useOrderStore } from "@/lib/stores/order-store";
import { cn, formatCurrency } from "@/lib/utils";
import Chatbot from "@/components/chatbot";
import { REWARDS_RULES, resolveRedemption, type Redemption } from "@/lib/rewards-rules";
import { getAllergenTags } from "@/lib/allergens";

const pendingRewardsCheckoutStorageKey = "kiosk-pending-rewards-checkout";
const defaultMenuCategories = ["Seasonal", "Hot Drinks", "Slushes"];

// --- REPURPOSED FOR KIOSK (Props) ---
// The props are changed to accept a `customer` object instead of an `employee` object.
type KioskClientProps = {
    customer: SessionCustomer | null;
    menuItems: MenuItemRecord[];
    ingredients: IngredientRecord[];
};

type NarrationSection = "intro" | "menu" | "cart" | "modal" | "rewards-checkout";

type GuidedNarrationStep =
    | { section: NarrationSection; text: string; action: "none"; focusId?: string }
    | { section: NarrationSection; text: string; action: "category"; category: string; focusId?: string }
    | { section: NarrationSection; text: string; action: "drink"; itemId: number; focusId?: string }
    | { section: NarrationSection; text: string; action: "cart-item"; index: number; focusId?: string }
    | { section: NarrationSection; text: string; action: "quantity"; delta: -1 | 1; focusId?: string }
    | { section: NarrationSection; text: string; action: "size"; size: DrinkSize; focusId?: string }
    | { section: NarrationSection; text: string; action: "sweetness"; sweetness: (typeof sweetnessOptions)[number]; focusId?: string }
    | { section: NarrationSection; text: string; action: "ice"; ice: 0 | 1 | 2 | 3; focusId?: string }
    | { section: NarrationSection; text: string; action: "ingredient"; ingredientId: number; delta: -1 | 1; focusId?: string }
    | { section: NarrationSection; text: string; action: "checkout" | "signin" | "rewards" | "add-to-cart" | "close-modal" | "guest-checkout" | "close-rewards-checkout"; focusId?: string };

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

const sizeLabel = (size: number) =>
    sizeOptions.find((option) => option.value === size)?.label ?? "Small";

type SelectedIngredientState = Record<number, number>;

function lineTotal(
    item: MenuItemRecord,
    quantity: number,
    selectedIngredients: SelectedIngredientState,
    ingredients: IngredientRecord[],
    size: DrinkSize
) {
    const addOnTotal = ingredients.reduce((sum, ingredient) => {
        const ingredientQuantity = selectedIngredients[ingredient.id] ?? 0;
        return sum + ingredient.addCost * ingredientQuantity;
    }, 0);

    return (item.cost + addOnTotal) * quantity * SIZE_MULTIPLIER[size];
}
// End of copied block from POS //

function getDrinkCategory(name: string) {
    const normalized = name.toLowerCase();

    if (
        normalized.includes("seasonal") ||
        normalized.includes("pumpkin") ||
        normalized.includes("peppermint") ||
        normalized.includes("holiday") ||
        normalized.includes("winter") ||
        normalized.includes("summer")
    ) {
        return "Seasonal";
    }

    if (
        normalized.includes("slush") ||
        normalized.includes("slushie") ||
        normalized.includes("smoothie") ||
        normalized.includes("freeze")
    ) {
        return "Slushes";
    }

    if (
        normalized.includes("hot")
    ) {
        return "Hot Drinks";
    }

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

function isCaffeinatedDrink(name: string) {
    const normalized = name.toLowerCase();

    return (
        normalized.includes("tea") ||
        normalized.includes("matcha") ||
        normalized.includes("latte") ||
        normalized.includes("mocha") ||
        normalized.includes("coffee") ||
        normalized.includes("espresso") ||
        normalized.includes("oolong") ||
        normalized.includes("chai") ||
        normalized.includes("thai")
    );
}

function getDrinkSpeechLabel(item: MenuItemRecord) {
    const category = getDrinkCategory(item.name);
    const caffeineLabel = isCaffeinatedDrink(item.name) ? "Caffeinated." : "Not marked caffeinated.";

    return `${item.name}. ${formatCurrency(item.cost)}. Category: ${category}. ${caffeineLabel}`;
}

// --- REPURPOSED FOR KIOSK (Component Definition) ---
// We rename the component and update its props.
export function KioskClient({ customer, menuItems, ingredients }: KioskClientProps) {
    const router = useRouter();
    const items = useOrderStore((state) => state.items);
    const addItem = useOrderStore((state) => state.addItem);
    const removeItem = useOrderStore((state) => state.removeItem);
    const updateItem = useOrderStore((state) => state.updateItem);
    const replaceItems = useOrderStore((state) => state.replaceItems);
    const clear = useOrderStore((state) => state.clear);
    const [selectedItem, setSelectedItem] = useState<MenuItemRecord | null>(null);
    const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [activeCategory, setActiveCategory] = useState("All");
    const [searchKeyboardOpen, setSearchKeyboardOpen] = useState(false);
    const [chatKeyboardOpen, setChatKeyboardOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<"menu" | "rewards">("menu");
    const [rewardsPoints, setRewardsPoints] = useState(0);
    const [redemption, setRedemption] = useState<Redemption>({ kind: "none" });
    const [flatPoints, setFlatPoints] = useState(0);

    // Start of copied block from POS //
    const [quantity, setQuantity] = useState(1);
    const [sweetness, setSweetness] = useState<(typeof sweetnessOptions)[number]>(100);
    const [ice, setIce] = useState<0 | 1 | 2 | 3>(2);
    const [isHot, setIsHot] = useState(false);
    const [size, setSize] = useState<DrinkSize>(0);
    const [selectedIngredients, setSelectedIngredients] = useState<SelectedIngredientState>({});
    const [checkoutPending, setCheckoutPending] = useState(false);
    const [rewardsCheckoutPromptOpen, setRewardsCheckoutPromptOpen] = useState(false);
    const [chatbotOpen, setChatbotOpen] = useState(false);
    const [translatorLanguage, setTranslatorLanguage] = useState("en");
    const [modalTranslations, setModalTranslations] = useState<ModalTranslations | null>(null);
    const modalContentRef = useRef<HTMLDivElement | null>(null);
    const narrationUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
    const guidedNarrationIndexRef = useRef(0);
    const pendingCategoryNarrationRef = useRef<string | null>(null);
    const pendingModalNarrationRef = useRef(false);
    const pendingRewardsCheckoutNarrationRef = useRef(false);
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
        if (!customer || items.length > 0) {
            return;
        }

        const storedCheckout = sessionStorage.getItem(pendingRewardsCheckoutStorageKey);

        if (!storedCheckout) {
            return;
        }

        try {
            const parsed = JSON.parse(storedCheckout) as { items?: typeof items; redemption?: Redemption };

            if (Array.isArray(parsed.items) && parsed.items.length > 0) {
                replaceItems(parsed.items);
                setRedemption(parsed.redemption ?? { kind: "none" });
                toast.success("You are signed in. Your order is ready to checkout with rewards.");
            }
        } catch {
            // Ignore malformed checkout restore data and let the kiosk continue normally.
        } finally {
            sessionStorage.removeItem(pendingRewardsCheckoutStorageKey);
        }
    }, [customer, items.length, replaceItems]);

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
            if (pendingModalNarrationRef.current) {
                pendingModalNarrationRef.current = false;
                guidedNarrationIndexRef.current = 0;
                window.dispatchEvent(new Event("kiosk:narration-start"));
            }
        }, 50);
    }, [selectedItem]);

    useEffect(() => {
        if (!rewardsCheckoutPromptOpen) {
            return;
        }

        window.setTimeout(() => {
            if (pendingRewardsCheckoutNarrationRef.current) {
                pendingRewardsCheckoutNarrationRef.current = false;
                guidedNarrationIndexRef.current = 0;
                window.dispatchEvent(new Event("kiosk:narration-start"));
            }
        }, 50);
    }, [rewardsCheckoutPromptOpen]);

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
    // End of copied block from POS //

    useEffect(() => {
        if (!chatbotOpen) {
            setChatKeyboardOpen(false);
            return;
        }

        function handleEscape(event: KeyboardEvent) {
            if (event.key === "Escape") {
                setChatbotOpen(false);
            }
        }

        window.addEventListener("keydown", handleEscape);

        return () => {
            window.removeEventListener("keydown", handleEscape);
        };
    }, [chatbotOpen]);

    useEffect(() => {
        if (!customer) {
            setRewardsPoints(0); // Ensure points are 0 for guests
            return;
        }

        fetch("/api/rewards")
            .then((r) => r.json())
            .then((data: { points?: number }) => setRewardsPoints(data.points ?? 0))
            .catch(() => {});
    }, [customer]);

    const ingredientNameMap = useMemo(
        () => new Map(ingredients.map((ing) => [ing.id, ing.name])),
        [ingredients]
    );

    const cartTotal = useMemo(() => items.reduce((sum, item) => sum + item.cost, 0), [items]);
    const cartAddonTotal = useMemo(
        () =>
            items.reduce((sum, item) => {
                const ingredientCost = item.ingredientChoices.reduce(
                    (acc, choice) => acc + choice.addCost * choice.quantity,
                    0
                );
                return sum + ingredientCost * item.quantity;
            }, 0),
        [items]
    );
    const baseSubtotal = cartTotal - cartAddonTotal;
    const hasAddons = cartAddonTotal > 0;

    const maxFlatPoints = Math.min(
        Math.floor(rewardsPoints / 100) * 100,
        Math.floor(cartTotal) * 100
    );

    const flatEligible = maxFlatPoints >= 100;
    const addonsEligible = rewardsPoints >= REWARDS_RULES.addons.points && hasAddons;
    const tier1Eligible = rewardsPoints >= REWARDS_RULES.tier1.points && cartTotal >= REWARDS_RULES.tier1.minCart;
    const tier2Eligible = rewardsPoints >= REWARDS_RULES.tier2.points && cartTotal >= REWARDS_RULES.tier2.minCart;

    useEffect(() => {
        if (flatPoints > maxFlatPoints) {
            setFlatPoints(maxFlatPoints);
        }
    }, [maxFlatPoints, flatPoints]);

    useEffect(() => {
        if (redemption.kind === "flat" && redemption.points !== flatPoints) {
            setRedemption({ kind: "flat", points: flatPoints });
        }
    }, [flatPoints, redemption]);

    useEffect(() => {
        if (redemption.kind === "flat" && !flatEligible) {
            setRedemption({ kind: "none" });
        } else if (redemption.kind === "addons" && !addonsEligible) {
            setRedemption({ kind: "none" });
        } else if (redemption.kind === "tier1" && !tier1Eligible) {
            setRedemption({ kind: "none" });
        } else if (redemption.kind === "tier2" && !tier2Eligible) {
            setRedemption({ kind: "none" });
        }
    }, [redemption, flatEligible, addonsEligible, tier1Eligible, tier2Eligible]);

    let resolved;
    try {
        resolved = resolveRedemption(redemption, cartTotal, baseSubtotal);
    } catch {
        resolved = { pointsCost: 0, discount: 0, freeAddons: false };
    }
    const discount = resolved.discount;
    const categories = useMemo(
        () => ["All", ...Array.from(new Set([...defaultMenuCategories, ...menuItems.map((item) => getDrinkCategory(item.name))]))],
        [menuItems]
    );
    const filteredMenuItems = useMemo(() => {
        const normalizedQuery = searchQuery.trim().toLowerCase();

        return menuItems.filter((item) => {
            const matchesCategory = activeCategory === "All" || getDrinkCategory(item.name) === activeCategory;
            const itemIngredientNames = Object.keys(item.ingredients).map(
                (id) => ingredientNameMap.get(Number(id)) ?? ""
            );
            const allergenTags = getAllergenTags(itemIngredientNames);
            const matchesSearch =
                !normalizedQuery ||
                item.name.toLowerCase().includes(normalizedQuery) ||
                itemIngredientNames.some((name) => name.toLowerCase().includes(normalizedQuery)) ||
                allergenTags.some((tag) => tag.includes(normalizedQuery));
            return matchesCategory && matchesSearch;
        });
    }, [activeCategory, ingredientNameMap, menuItems, searchQuery]);
    const keyboardOpen = searchKeyboardOpen || chatKeyboardOpen;

    const guidedNarrationSteps = useMemo<GuidedNarrationStep[]>(() => {
        if (rewardsCheckoutPromptOpen) {
            return [
                {
                    section: "rewards-checkout",
                    action: "none",
                    focusId: "kiosk-rewards-checkout-modal",
                    text: "Rewards checkout. Earn points on this order? Press Next to choose sign in with Google or checkout as guest."
                },
                {
                    section: "rewards-checkout",
                    action: "signin",
                    focusId: "kiosk-rewards-signin",
                    text: "Sign in with Google to earn rewards points for this purchase. Press Yes to sign in with Google."
                },
                {
                    section: "rewards-checkout",
                    action: "guest-checkout",
                    focusId: "kiosk-guest-checkout",
                    text: "Checkout as guest without earning points. Press Yes to checkout as guest."
                },
                {
                    section: "rewards-checkout",
                    action: "close-rewards-checkout",
                    focusId: "kiosk-close-rewards-checkout",
                    text: "Close rewards checkout and return to the order. Press Yes to close this prompt."
                }
            ];
        }

        if (selectedItem) {
            const itemTotal = formatCurrency(lineTotal(selectedItem, quantity, selectedIngredients, paidIngredients, size));

            return [
                {
                    section: "modal",
                    action: "none",
                    focusId: "kiosk-customize-modal",
                    text: `Customize ${selectedItem.name}. Base price ${formatCurrency(selectedItem.cost)}. Current item total ${itemTotal}. Press Next to move through options, or Yes on an option to choose it.`
                },
                {
                    section: "modal",
                    action: "quantity",
                    delta: -1,
                    focusId: "kiosk-quantity-decrease",
                    text: `Quantity is ${quantity}. Press Yes to decrease quantity.`
                },
                {
                    section: "modal",
                    action: "quantity",
                    delta: 1,
                    focusId: "kiosk-quantity-increase",
                    text: `Quantity is ${quantity}. Press Yes to increase quantity.`
                },
                ...sizeOptions.map((option) => ({
                    section: "modal" as const,
                    action: "size" as const,
                    size: option.value,
                    focusId: `kiosk-size-${option.value}`,
                    text: `Size ${option.label}. ${size === option.value ? "Currently selected." : ""} Press Yes to choose ${option.label}.`
                })),
                ...sweetnessOptions.map((option) => ({
                    section: "modal" as const,
                    action: "sweetness" as const,
                    sweetness: option,
                    focusId: `kiosk-sweetness-${option}`,
                    text: `Sweetness ${option} percent. ${sweetness === option ? "Currently selected." : ""} Press Yes to choose ${option} percent sweetness.`
                })),
                ...iceOptions.map((option) => ({
                    section: "modal" as const,
                    action: "ice" as const,
                    ice: option.value,
                    focusId: `kiosk-ice-${option.value}`,
                    text: `Ice ${option.label}. ${ice === option.value ? "Currently selected." : ""} Press Yes to choose ${option.label} ice.`
                })),
                ...paidIngredients.flatMap((ingredient) => {
                    const selectedQuantity = selectedIngredients[ingredient.id] ?? 0;

                    return [
                        {
                            section: "modal" as const,
                            action: "ingredient" as const,
                            ingredientId: ingredient.id,
                            delta: -1 as const,
                            focusId: `kiosk-ingredient-${ingredient.id}-remove`,
                            text: `${ingredient.name}. ${formatCurrency(ingredient.addCost)} each. Current quantity ${selectedQuantity}. Press Yes to remove one.`
                        },
                        {
                            section: "modal" as const,
                            action: "ingredient" as const,
                            ingredientId: ingredient.id,
                            delta: 1 as const,
                            focusId: `kiosk-ingredient-${ingredient.id}-add`,
                            text: `${ingredient.name}. ${formatCurrency(ingredient.addCost)} each. Current quantity ${selectedQuantity}. Press Yes to add one.`
                        }
                    ];
                }),
                {
                    section: "modal",
                    action: "add-to-cart",
                    focusId: "kiosk-add-to-cart",
                    text: `${editingItemIndex !== null ? "Save changes" : "Add to cart"}. Item total ${itemTotal}. Press Yes to ${editingItemIndex !== null ? "save changes" : "add this drink to the cart"}.`
                },
                {
                    section: "modal",
                    action: "close-modal",
                    focusId: "kiosk-cancel-customize",
                    text: "Cancel customization. Press Yes to close this drink without adding it."
                }
            ];
        }

        const cartTotalAfterDiscount = formatCurrency(Math.max(0, cartTotal - discount));
        const steps: GuidedNarrationStep[] = [
            {
                section: "intro",
                action: "none",
                focusId: MAIN_CONTENT_ID,
                text: customer
                    ? `Welcome to Brew 34, ${customer.fullName}. You have ${rewardsPoints} rewards points. Press Next to move one option at a time, Skip to jump sections, or Yes to choose the current option.`
                    : "Welcome to Brew 34. You are ordering as a guest. Press Next to move one option at a time, Skip to jump sections, or Yes to choose the current option."
            },
            {
                section: "menu",
                action: "none",
                focusId: "customer-menu-section",
                text: `Menu section. Active category is ${activeCategory}. ${searchQuery.trim() ? `Search filter is ${searchQuery.trim()}.` : "No search filter is active."}`
            },
            ...categories.map((category) => ({
                section: "menu" as const,
                action: "category" as const,
                category,
                focusId: "customer-menu-section",
                text: `Category: ${category}. Press Yes to hear drinks in ${category}.`
            })),
            ...(filteredMenuItems.length > 0
                ? filteredMenuItems.map((item, index) => ({
                    section: "menu" as const,
                    action: "drink" as const,
                    itemId: item.id,
                    focusId: `kiosk-drink-${item.id}`,
                    text: `Drink ${index + 1} of ${filteredMenuItems.length}. ${getDrinkSpeechLabel(item)} Press Yes to customize this drink.`
                }))
                : [
                    {
                        section: "menu" as const,
                        action: "none" as const,
                        focusId: "customer-menu-section",
                        text: "No drinks match the current search and category filters. Press Skip to move to the cart."
                    }
                ]),
            {
                section: "cart",
                action: "none",
                focusId: "customer-cart-section",
                text: items.length === 0
                    ? "Cart section. Your cart is empty."
                    : `Cart section. Your cart has ${items.length} ${items.length === 1 ? "item" : "items"} and the current total is ${cartTotalAfterDiscount}.`
            },
            ...(items.length > 0
                ? items.map((item, index) => ({
                    section: "cart" as const,
                    action: "cart-item" as const,
                    index,
                    focusId: `kiosk-cart-item-${index}`,
                    text: `Cart item ${index + 1} of ${items.length}. ${item.quantity} ${sizeLabel(item.size)} ${item.itemName}. ${formatCurrency(item.cost)}. Sweetness ${item.sweetness} percent. Press Yes to edit this item.`
                }))
                : []),
            {
                section: "cart",
                action: items.length > 0 ? "checkout" : "none",
                focusId: "customer-checkout-button",
                text: items.length > 0
                    ? `Complete order. Total ${cartTotalAfterDiscount}. Press Yes to continue checkout.`
                    : "Checkout is unavailable until you add a drink."
            },
            {
                section: "cart",
                action: customer ? "rewards" : "signin",
                focusId: customer ? "customer-rewards-tab" : "customer-signin-link",
                text: customer
                    ? `Rewards. You have ${rewardsPoints} points. Press Yes to open rewards.`
                    : "Sign in to earn rewards. Press Yes to go to customer sign in."
            }
        ];

        return steps;
    }, [
        activeCategory,
        cartTotal,
        categories,
        customer,
        discount,
        editingItemIndex,
        filteredMenuItems,
        ice,
        items,
        paidIngredients,
        quantity,
        rewardsPoints,
        rewardsCheckoutPromptOpen,
        searchQuery,
        selectedIngredients,
        selectedItem,
        size,
        sweetness
    ]);

    const updateNarrationStatus = useCallback((speaking: boolean) => {
        window.dispatchEvent(new CustomEvent("kiosk:narration-status", { detail: { speaking } }));
    }, []);

    const stopNarration = useCallback(() => {
        if ("speechSynthesis" in window) {
            window.speechSynthesis.cancel();
        }

        narrationUtteranceRef.current = null;
        updateNarrationStatus(false);
    }, [updateNarrationStatus]);

    const speakGuidedStep = useCallback((index: number) => {
        if (!("speechSynthesis" in window) || typeof SpeechSynthesisUtterance === "undefined") {
            toast.error("This browser does not support built-in speech narration.");
            return;
        }

        const boundedIndex = Math.min(Math.max(index, 0), Math.max(0, guidedNarrationSteps.length - 1));
        const step = guidedNarrationSteps[boundedIndex];

        if (!step) {
            return;
        }

        guidedNarrationIndexRef.current = boundedIndex;
        stopNarration();
        document.getElementById(step.focusId ?? MAIN_CONTENT_ID)?.focus();

        const utterance = new SpeechSynthesisUtterance(step.text);
        utterance.rate = 0.92;
        utterance.pitch = 1;
        utterance.onend = () => updateNarrationStatus(false);
        utterance.onerror = () => updateNarrationStatus(false);
        narrationUtteranceRef.current = utterance;
        updateNarrationStatus(true);
        window.speechSynthesis.speak(utterance);
    }, [guidedNarrationSteps, stopNarration, updateNarrationStatus]);

    const findFirstStepInSection = useCallback((section: NarrationSection) => {
        const index = guidedNarrationSteps.findIndex((step) => step.section === section);
        return index === -1 ? 0 : index;
    }, [guidedNarrationSteps]);

    const findFirstDrinkStep = useCallback(() => {
        return guidedNarrationSteps.findIndex((step) => step.action === "drink");
    }, [guidedNarrationSteps]);

    const moveToNextGuidedStep = useCallback(() => {
        const nextIndex = (guidedNarrationIndexRef.current + 1) % Math.max(1, guidedNarrationSteps.length);
        speakGuidedStep(nextIndex);
    }, [guidedNarrationSteps.length, speakGuidedStep]);

    const skipGuidedSection = useCallback(() => {
        const currentStep = guidedNarrationSteps[guidedNarrationIndexRef.current];
        const currentSection = currentStep?.section ?? "intro";

        if (currentSection === "modal") {
            let nextIndex = -1;

            if (!currentStep || currentStep.action === "none" || currentStep.action === "quantity") {
                nextIndex = guidedNarrationSteps.findIndex((step) => step.action === "size");
            } else if (currentStep.action === "size") {
                nextIndex = guidedNarrationSteps.findIndex((step) => step.action === "sweetness");
            } else if (currentStep.action === "sweetness") {
                nextIndex = guidedNarrationSteps.findIndex((step) => step.action === "ice");
            } else if (currentStep.action === "ice") {
                nextIndex = guidedNarrationSteps.findIndex((step) => step.action === "ingredient");
            } else if (currentStep.action === "ingredient") {
                nextIndex = guidedNarrationSteps.findIndex((step) => step.action === "add-to-cart");
            } else if (currentStep.action === "add-to-cart") {
                nextIndex = guidedNarrationSteps.findIndex((step) => step.action === "close-modal");
            }

            speakGuidedStep(nextIndex === -1 ? 0 : nextIndex);
            return;
        }

        if (currentSection === "rewards-checkout") {
            const nextIndex = Math.min(guidedNarrationIndexRef.current + 1, guidedNarrationSteps.length - 1);
            speakGuidedStep(nextIndex);
            return;
        }

        if (currentSection === "intro") {
            speakGuidedStep(findFirstStepInSection("menu"));
            return;
        }

        if (currentSection === "menu") {
            speakGuidedStep(findFirstStepInSection("cart"));
            return;
        }

        speakGuidedStep(findFirstStepInSection("menu"));
    }, [findFirstStepInSection, guidedNarrationSteps, speakGuidedStep]);

    const selectCurrentGuidedStep = useCallback(() => {
        const step = guidedNarrationSteps[guidedNarrationIndexRef.current];

        if (!step) {
            return;
        }

        stopNarration();

        if (step.action === "category") {
            setActiveTab("menu");
            pendingCategoryNarrationRef.current = step.category;
            setActiveCategory(step.category);
            toast.success(`Showing ${step.category}.`);

            if (step.category === activeCategory) {
                pendingCategoryNarrationRef.current = null;
                const firstDrinkIndex = findFirstDrinkStep();
                if (firstDrinkIndex !== -1) {
                    speakGuidedStep(firstDrinkIndex);
                }
            }

            return;
        }

        if (step.action === "none") {
            moveToNextGuidedStep();
            return;
        }

        if (step.action === "drink") {
            const item = menuItems.find((candidate) => candidate.id === step.itemId);

            if (item) {
                pendingModalNarrationRef.current = true;
                openAddItemModal(item);
            }

            return;
        }

        if (step.action === "cart-item") {
            pendingModalNarrationRef.current = true;
            openEditItemModal(step.index);
            return;
        }

        if (step.action === "quantity") {
            setQuantity((current) => step.delta > 0 ? Math.min(20, current + 1) : Math.max(1, current - 1));
            setTimeout(() => speakGuidedStep(guidedNarrationIndexRef.current), 0);
            return;
        }

        if (step.action === "size") {
            setSize(step.size);
            setTimeout(() => speakGuidedStep(guidedNarrationIndexRef.current), 0);
            return;
        }

        if (step.action === "sweetness") {
            setSweetness(step.sweetness);
            setTimeout(() => speakGuidedStep(guidedNarrationIndexRef.current), 0);
            return;
        }

        if (step.action === "ice") {
            setIce(step.ice);
            setTimeout(() => speakGuidedStep(guidedNarrationIndexRef.current), 0);
            return;
        }

        if (step.action === "ingredient") {
            updateIngredient(step.ingredientId, step.delta);
            setTimeout(() => speakGuidedStep(guidedNarrationIndexRef.current), 0);
            return;
        }

        if (step.action === "checkout") {
            pendingRewardsCheckoutNarrationRef.current = true;
            void handleCheckout();
            return;
        }

        if (step.action === "signin") {
            startRewardsSignIn();
            return;
        }

        if (step.action === "guest-checkout") {
            void submitCheckout(true);
            return;
        }

        if (step.action === "close-rewards-checkout") {
            setRewardsCheckoutPromptOpen(false);
            return;
        }

        if (step.action === "rewards") {
            setActiveTab("rewards");
            toast.success("Opened rewards.");
            return;
        }

        if (step.action === "add-to-cart") {
            addSelectedItem();
            return;
        }

        if (step.action === "close-modal") {
            closeModal();
        }
    // The local action functions are intentionally read from the current render for the spoken step.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeCategory, findFirstDrinkStep, guidedNarrationSteps, menuItems, moveToNextGuidedStep, speakGuidedStep, stopNarration]);

    useEffect(() => {
        if (!pendingCategoryNarrationRef.current || pendingCategoryNarrationRef.current !== activeCategory) {
            return;
        }

        pendingCategoryNarrationRef.current = null;
        const firstDrinkIndex = findFirstDrinkStep();

        if (firstDrinkIndex !== -1) {
            speakGuidedStep(firstDrinkIndex);
            return;
        }

        const menuIndex = findFirstStepInSection("menu");
        speakGuidedStep(menuIndex);
    }, [activeCategory, findFirstDrinkStep, findFirstStepInSection, speakGuidedStep]);

    useEffect(() => {
        function handleStartNarration() {
            speakGuidedStep(guidedNarrationIndexRef.current);
        }

        function handleStopNarration() {
            stopNarration();
        }

        function handleNextNarration() {
            moveToNextGuidedStep();
        }

        function handleSkipNarration() {
            skipGuidedSection();
        }

        function handleSelectNarration() {
            selectCurrentGuidedStep();
        }

        function handleHashChange() {
            if (window.location.hash === "#customer-cart-section") {
                speakGuidedStep(findFirstStepInSection("cart"));
            } else if (window.location.hash === "#customer-menu-section") {
                speakGuidedStep(findFirstStepInSection("menu"));
            }
        }

        window.addEventListener("kiosk:narration-start", handleStartNarration);
        window.addEventListener("kiosk:narration-stop", handleStopNarration);
        window.addEventListener("kiosk:narration-next", handleNextNarration);
        window.addEventListener("kiosk:narration-skip", handleSkipNarration);
        window.addEventListener("kiosk:narration-select", handleSelectNarration);
        window.addEventListener("hashchange", handleHashChange);

        return () => {
            window.removeEventListener("kiosk:narration-start", handleStartNarration);
            window.removeEventListener("kiosk:narration-stop", handleStopNarration);
            window.removeEventListener("kiosk:narration-next", handleNextNarration);
            window.removeEventListener("kiosk:narration-skip", handleSkipNarration);
            window.removeEventListener("kiosk:narration-select", handleSelectNarration);
            window.removeEventListener("hashchange", handleHashChange);
            stopNarration();
        };
    }, [
        findFirstStepInSection,
        moveToNextGuidedStep,
        selectCurrentGuidedStep,
        skipGuidedSection,
        speakGuidedStep,
        stopNarration
    ]);

    // All the functions (closeModal, updateIngredient, addSelectedItem, handleCheckout) are
    // IDENTICAL to pos-client.tsx [4], copy them here.

    // Start of copied block from POS //
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
        setSize(([0, 1, 2] as const).includes(cartItem.size as DrinkSize) ? (cartItem.size as DrinkSize) : 0);
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

        const ingredientChoices = paidIngredients
            .filter((ingredient) => (selectedIngredients[ingredient.id] ?? 0) > 0)
            .map((ingredient) => ({
                ingredientId: ingredient.id,
                quantity: selectedIngredients[ingredient.id] ?? 0,
                addCost: ingredient.addCost,
                name: ingredient.name
            }));

        const nextItem = {
            itemId: selectedItem.id,
            itemName: selectedItem.name,
            quantity,
            sweetness,
            ice,
            isHot,
            size,
            ingredientChoices,
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

    async function submitCheckout(checkoutAsGuest = false) {
        setCheckoutPending(true);

        const response = await fetch("/api/orders", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ items, redemption: checkoutAsGuest ? { kind: "none" } : redemption })
        });

        setCheckoutPending(false);

        if (!response.ok) {
            const payload = (await response.json().catch(() => null)) as { error?: string } | null;
            toast.error(payload?.error ?? "Checkout failed.");
            return;
        }

        clear();
        setRewardsCheckoutPromptOpen(false);
        setRedemption({ kind: "none" });
        setFlatPoints(0);
        setActiveTab("menu");
        // Refresh points balance after checkout (earned points added, redeemed points subtracted)
        fetch("/api/rewards")
            .then((r) => r.json())
            .then((data: { points?: number }) => setRewardsPoints(data.points ?? 0))
            .catch(() => {});
        toast.success("Order completed.");
    }

    async function handleCheckout() {
        if (items.length === 0) {
            toast.error("Add at least one item before checkout.");
            return;
        }

        if (!customer) {
            setRewardsCheckoutPromptOpen(true);
            return;
        }

        await submitCheckout();
    }

    function startRewardsSignIn() {
        if (items.length > 0) {
            sessionStorage.setItem(
                pendingRewardsCheckoutStorageKey,
                JSON.stringify({
                    items,
                    redemption
                })
            );
        }

        window.location.href = `/api/auth/google/start?next=${encodeURIComponent("/kiosk")}&login=${encodeURIComponent("/customer-login")}`;
    }
    // End of copied block from POS //

    // --- REPURPOSED FOR KIOSK (Logout Function) ---
    // The customer logout endpoint is different from the employee one.
    async function logoutCustomer() {
        // The original PosClient used "/api/auth/logout" [4].
        // From kiosk/page.tsx, we see the customer logout is "/api/auth/customer/logout" [2].
        await fetch("/api/auth/customer/logout", { method: "POST" });
        clear(); // Clear the cart on logout
        router.replace("/kiosk"); // Go back to the kiosk as a guest
        router.refresh();
    }

    async function backToPortal() {
        // TODO ask for a PIN confirmation and then leave

        // blah blah blah

        clear(); // Clear the cart when leaving
        router.replace("/"); // Go back to the home page
        router.refresh();
    }

    return (
        <>
            <SkipLink />
            <SkipLink targetId="customer-menu-section" label="Skip to menu" />
            <SkipLink targetId="customer-cart-section" label="Skip to cart" />
            {/* --- REPURPOSED FOR KIOSK (Main Layout) --- */}
            <main
                id={MAIN_CONTENT_ID}
                tabIndex={-1}
                aria-label="Brew 34 customer ordering kiosk"
                className="min-h-screen bg-stone-100"
            >
                <div className={cn("mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8", keyboardOpen && "pb-[32rem]")}>

                    {/* --- REPURPOSED FOR KIOSK (Header) --- */}
                    {/* We replace the employee-specific header with a customer welcome message. */}
                    <div className="mb-6 flex flex-wrap items-center gap-4 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
                        <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
                            <CupSoda className="h-7 w-7" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-sm font-bold uppercase tracking-widest text-stone-500">Welcome</p>
                            <h1 className="text-2xl font-semibold tracking-tight">{customer ? customer.fullName : "Guest"}</h1>
                            <p className="text-sm text-stone-500">Ready to order? Select an item below.</p>
                        </div>
                        <div className="shrink-0">
                            <CustomerWeatherWidget />
                        </div>
                        
                        {/* If customer exists, show points and a Sign Out button. */}
                        {customer ? (
                            <>
                                <div className="flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-sm font-semibold text-blue-700">
                                    <Receipt className="h-4 w-4" />
                                    {rewardsPoints} pts
                                </div>
                                <Button variant="outline" onClick={logoutCustomer} className="ml-auto gap-2">
                                    <LogOut className="h-4 w-4" />
                                    Sign Out
                                </Button>
                            </>
                        ) : (
                            /* If no customer, show a Sign In button. */
                            <a
                                id="customer-signin-link"
                                href="/customer-login?next=/kiosk"
                                className="ml-auto inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-foreground px-4 py-2.5 text-sm font-medium text-white transition hover:bg-black"
                            >
                                Sign In to Earn Rewards
                            </a>
                        )}

                        {/* <Button variant="outline" onClick={backToPortal} className="ml-auto gap-2">
                            <LogOut className="h-4 w-4" />
                            Back To Portal
                        </Button> */}
                    </div>

                    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_380px]">
                        <Card
                            id="customer-menu-section"
                            tabIndex={-1}
                            className="relative shadow-sm"
                            aria-labelledby="customer-menu-heading"
                        >
                            <CardHeader>
                                <h2 id="customer-menu-heading" className="sr-only">Customer menu</h2>
                                {customer ? (
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
                                                id="customer-rewards-tab"
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
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-4">
                                            <button
                                                type="button"
                                                onClick={() => setActiveTab("menu")}
                                                className={cn("text-xl font-semibold transition-colors", activeTab === "menu" ? "text-stone-900" : "text-stone-400 hover:text-stone-600")}
                                            >
                                                Menu
                                            </button>
                                        </div>
                                    </div>
                                )}
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
                                                    aria-pressed={activeCategory === category}
                                                    aria-label={`Show ${category} drinks`}
                                                >
                                                    {category}
                                                </Button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                
                            </CardHeader>
                            <CardContent>
                                {activeTab === "rewards" ? (
                                    <div className="space-y-6">
                                        <div className="rounded-xl border border-blue-200 bg-blue-50 p-5">
                                            <p className="text-sm text-blue-600">{customer ? "Your Balance:" : "Sign In To Use Points"}</p>
                                            <p className="mt-1 text-4xl font-bold tracking-tight text-blue-700">{rewardsPoints} pts</p>
                                            <p className="mt-1 text-sm text-blue-500">Worth {formatCurrency(Math.floor(rewardsPoints / 100))}</p>
                                        </div>
                                        <div className="space-y-3">
                                            <p className="font-medium">Choose a redemption</p>
                                            <p className="text-sm text-stone-500">Select how you want to spend your points</p>

                                            {/* Flat discount card */}
                                            <button
                                                type="button"
                                                disabled={!flatEligible}
                                                onClick={() => {
                                                    if (redemption.kind === "flat") {
                                                        setRedemption({ kind: "none" });
                                                        setFlatPoints(0);
                                                    } else {
                                                        setFlatPoints(100);
                                                        setRedemption({ kind: "flat", points: 100 });
                                                    }
                                                }}
                                                className={cn(
                                                    "w-full rounded-xl border p-4 text-left transition-colors",
                                                    redemption.kind === "flat"
                                                        ? "border-blue-500 bg-blue-50"
                                                        : "border-stone-200 bg-white hover:border-stone-300",
                                                    !flatEligible && "cursor-not-allowed opacity-50"
                                                )}
                                            >
                                                <div className="flex items-center justify-between">
                                                    <p className="font-semibold">Flat Discount</p>
                                                    <span className="text-sm text-stone-500">100 pts = $1.00 off</span>
                                                </div>
                                                <p className="mt-1 text-sm text-stone-500">
                                                    {!flatEligible ? "Not enough points or empty cart" : "Spend points for dollars off your order"}
                                                </p>
                                            </button>

                                            {redemption.kind === "flat" && (
                                                <div className="flex items-center gap-4 pl-2">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => setFlatPoints((p) => Math.max(100, p - 100))}
                                                        disabled={flatPoints <= 100}
                                                    >
                                                        <Minus className="h-4 w-4" />
                                                    </Button>
                                                    <span className="w-24 text-center text-2xl font-semibold">{flatPoints} pts</span>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => setFlatPoints((p) => Math.min(maxFlatPoints, p + 100))}
                                                        disabled={flatPoints >= maxFlatPoints}
                                                    >
                                                        <Plus className="h-4 w-4" />
                                                    </Button>
                                                    <span className="text-sm font-medium text-green-700">
                                                        {formatCurrency(flatPoints / 100)} off
                                                    </span>
                                                </div>
                                            )}

                                            {/* Free add-ons card */}
                                            <button
                                                type="button"
                                                disabled={!addonsEligible}
                                                onClick={() => {
                                                    if (redemption.kind === "addons") {
                                                        setRedemption({ kind: "none" });
                                                    } else {
                                                        setFlatPoints(0);
                                                        setRedemption({ kind: "addons" });
                                                    }
                                                }}
                                                className={cn(
                                                    "w-full rounded-xl border p-4 text-left transition-colors",
                                                    redemption.kind === "addons"
                                                        ? "border-blue-500 bg-blue-50"
                                                        : "border-stone-200 bg-white hover:border-stone-300",
                                                    !addonsEligible && "cursor-not-allowed opacity-50"
                                                )}
                                            >
                                                <div className="flex items-center justify-between">
                                                    <p className="font-semibold">Add-on Credit</p>
                                                    <span className="text-sm text-stone-500">{REWARDS_RULES.addons.points} pts</span>
                                                </div>
                                                <p className="mt-1 text-sm text-stone-500">
                                                    {rewardsPoints < REWARDS_RULES.addons.points
                                                        ? `Need ${REWARDS_RULES.addons.points} pts`
                                                        : !hasAddons
                                                            ? `Up to ${formatCurrency(REWARDS_RULES.addons.creditAmount)} off add-ons — add some first`
                                                            : `Covers ${formatCurrency(Math.min(REWARDS_RULES.addons.creditAmount, cartAddonTotal))} of add-on costs (max ${formatCurrency(REWARDS_RULES.addons.creditAmount)})`}
                                                </p>
                                            </button>

                                            {/* Tier 1 card */}
                                            <button
                                                type="button"
                                                disabled={!tier1Eligible}
                                                onClick={() => {
                                                    if (redemption.kind === "tier1") {
                                                        setRedemption({ kind: "none" });
                                                    } else {
                                                        setFlatPoints(0);
                                                        setRedemption({ kind: "tier1" });
                                                    }
                                                }}
                                                className={cn(
                                                    "w-full rounded-xl border p-4 text-left transition-colors",
                                                    redemption.kind === "tier1"
                                                        ? "border-blue-500 bg-blue-50"
                                                        : "border-stone-200 bg-white hover:border-stone-300",
                                                    !tier1Eligible && "cursor-not-allowed opacity-50"
                                                )}
                                            >
                                                <div className="flex items-center justify-between">
                                                    <p className="font-semibold">{REWARDS_RULES.tier1.percent * 100}% Off</p>
                                                    <span className="text-sm text-stone-500">{REWARDS_RULES.tier1.points} pts</span>
                                                </div>
                                                <p className="mt-1 text-sm text-stone-500">
                                                    {rewardsPoints < REWARDS_RULES.tier1.points
                                                        ? `Need ${REWARDS_RULES.tier1.points} pts`
                                                        : cartTotal < REWARDS_RULES.tier1.minCart
                                                            ? `Requires cart of $${REWARDS_RULES.tier1.minCart}+`
                                                            : `Save ${formatCurrency(cartTotal * REWARDS_RULES.tier1.percent)} on this order`}
                                                </p>
                                            </button>

                                            {/* Tier 2 card */}
                                            <button
                                                type="button"
                                                disabled={!tier2Eligible}
                                                onClick={() => {
                                                    if (redemption.kind === "tier2") {
                                                        setRedemption({ kind: "none" });
                                                    } else {
                                                        setFlatPoints(0);
                                                        setRedemption({ kind: "tier2" });
                                                    }
                                                }}
                                                className={cn(
                                                    "w-full rounded-xl border p-4 text-left transition-colors",
                                                    redemption.kind === "tier2"
                                                        ? "border-blue-500 bg-blue-50"
                                                        : "border-stone-200 bg-white hover:border-stone-300",
                                                    !tier2Eligible && "cursor-not-allowed opacity-50"
                                                )}
                                            >
                                                <div className="flex items-center justify-between">
                                                    <p className="font-semibold">{REWARDS_RULES.tier2.percent * 100}% Off</p>
                                                    <span className="text-sm text-stone-500">{REWARDS_RULES.tier2.points} pts</span>
                                                </div>
                                                <p className="mt-1 text-sm text-stone-500">
                                                    {rewardsPoints < REWARDS_RULES.tier2.points
                                                        ? `Need ${REWARDS_RULES.tier2.points} pts`
                                                        : cartTotal < REWARDS_RULES.tier2.minCart
                                                            ? `Requires cart of $${REWARDS_RULES.tier2.minCart}+`
                                                            : `Save ${formatCurrency(cartTotal * REWARDS_RULES.tier2.percent)} on this order`}
                                                </p>
                                            </button>
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
                                            id={`kiosk-drink-${item.id}`}
                                            type="button"
                                            onClick={() => openAddItemModal(item)}
                                            aria-label={`${getDrinkSpeechLabel(item)} Tap to customize this drink.`}
                                            className="group relative flex flex-col overflow-hidden rounded-xl border border-stone-200 bg-white text-left shadow-sm transition-all hover:border-blue-500 hover:shadow-lg"
                                        >
                                            {isCaffeinatedDrink(item.name) ? (
                                                <span className="absolute left-2 top-2 z-10 rounded bg-white px-2 py-0.5 text-[0.62rem] font-bold uppercase tracking-wide text-amber-900 shadow-sm ring-1 ring-amber-300">
                                                    caffeinated
                                                </span>
                                            ) : null}
                                            {/* Placeholder Image using the new `imageUrl` field */}
                                            <img
                                                src={item.imageUrl}
                                                alt={`${item.name} drink`}
                                                className="w-full h-40 object-cover bg-stone-200"
                                                onError={(e) => { (e.currentTarget as HTMLImageElement).src = "/menu-items/placeholder.png"; }}
                                            />
                                            <div className="p-4 flex-1 flex flex-col">
                                                <div className="flex-1">
                                                    <h2 className="text-lg font-semibold leading-tight group-hover:text-blue-600">{item.name}</h2>
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
                        <Card
                            id="customer-cart-section"
                            tabIndex={-1}
                            className="relative h-fit shadow-sm xl:sticky xl:top-6"
                            aria-labelledby="customer-cart-heading"
                        >
                            { /* ... (Paste the entire Cart Card JSX from pos-client.tsx here) ... */}
                            <CardHeader>
                                <CardTitle id="customer-cart-heading" className="flex items-center gap-2">
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
                                                id={`kiosk-cart-item-${index}`}
                                                type="button"
                                                onClick={() => openEditItemModal(index)}
                                                className="w-full rounded-xl border border-border bg-[rgb(var(--surface-alt))] p-4 text-left transition hover:bg-white"
                                            >
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="min-w-0">
                                                        <div className="font-semibold">{sizeLabel(item.size)} {item.itemName}</div>
                                                        <div className="mt-1 text-sm text-stone-600">
                                                            Qty {item.quantity} | Sweet {item.sweetness}%{item.isHot ? " | Hot" : ` | Ice ${item.ice}`}
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
                                    {discount > 0 && (
                                        <div className="mt-2 flex items-center justify-between text-sm text-green-700">
                                            <span>
                                                {redemption.kind === "flat" && `Rewards: ${resolved.pointsCost} pts`}
                                                {redemption.kind === "addons" && "Rewards: Add-on credit"}
                                                {redemption.kind === "tier1" && `Rewards: ${REWARDS_RULES.tier1.percent * 100}% off`}
                                                {redemption.kind === "tier2" && `Rewards: ${REWARDS_RULES.tier2.percent * 100}% off`}
                                            </span>
                                            <span>−{formatCurrency(discount)}</span>
                                        </div>
                                    )}
                                    <div className="mt-4 flex items-end justify-between gap-4">
                                        <span className="font-medium">Total</span>
                                        <span className="text-3xl font-semibold tracking-tight">{formatCurrency(Math.max(0, cartTotal - discount))}</span>
                                    </div>
                                </div>

                                <Button
                                    id="customer-checkout-button"
                                    className="w-full gap-2"
                                    size="lg"
                                    onClick={handleCheckout}
                                    disabled={checkoutPending}
                                >
                                    <Receipt className="h-4 w-4" />
                                    {checkoutPending ? "Completing order..." : "Complete Order"}
                                </Button>
                            </CardContent>
                        </Card>
                    </div>
                </div>

                <button
                    type="button"
                    onClick={() => setChatbotOpen((current) => !current)}
                    className={cn(
                        "fixed right-6 z-50 flex items-center gap-2 rounded-full bg-blue-700 px-4 py-3 text-sm font-semibold text-white shadow-xl transition hover:bg-blue-800",
                        keyboardOpen ? "bottom-[calc(min(56vh,32rem)+1rem)]" : "bottom-6"
                    )}
                    aria-label={chatbotOpen ? "Close AI chatbot" : "Open AI chatbot"}
                    aria-expanded={chatbotOpen}
                    aria-controls="kiosk-ai-chatbot-popup"
                >
                    <MessageCircle className="h-5 w-5" />
                    AI Chat
                </button>

                {chatbotOpen ? (
                    <section
                        id="kiosk-ai-chatbot-popup"
                        className={cn(
                            "fixed right-4 z-50 w-[22rem] max-w-[calc(100vw-2rem)] rounded-2xl border border-stone-200 bg-white shadow-2xl sm:right-6 sm:w-[24rem]",
                            keyboardOpen ? "bottom-[calc(min(56vh,32rem)+6rem)]" : "bottom-24"
                        )}
                        aria-label="Kiosk AI chatbot popup"
                    >
                        <div className="flex items-center justify-between border-b border-stone-200 px-4 py-3">
                            <h2 className="text-sm font-semibold">AI Chat Assistant</h2>
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => setChatbotOpen(false)}
                                aria-label="Close AI chatbot popup"
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                        <div className="p-3">
                            <Chatbot
                                cartItems={items}
                                ingredients={ingredients}
                                menuItems={menuItems}
                                onKeyboardOpenChange={setChatKeyboardOpen}
                            />
                        </div>
                    </section>
                ) : null}

                {rewardsCheckoutPromptOpen ? (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
                        <div
                            id="kiosk-rewards-checkout-modal"
                            tabIndex={-1}
                            className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-6 shadow-2xl"
                        >
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex items-center gap-3">
                                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
                                        <Gift className="h-6 w-6" />
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold uppercase tracking-[0.2em] text-stone-500">
                                            Rewards checkout
                                        </p>
                                        <h2 className="mt-1 text-xl font-semibold tracking-tight text-stone-900">
                                            Earn points on this order?
                                        </h2>
                                    </div>
                                </div>
                                <button
                                    id="kiosk-close-rewards-checkout"
                                    type="button"
                                    onClick={() => setRewardsCheckoutPromptOpen(false)}
                                    className="rounded-lg border border-stone-200 bg-white p-2 text-stone-500 transition hover:bg-stone-50"
                                    aria-label="Close rewards checkout prompt"
                                    disabled={checkoutPending}
                                >
                                    <X className="h-5 w-5" />
                                </button>
                            </div>

                            <p className="mt-4 text-sm leading-6 text-stone-600">
                                Sign in with Google to earn rewards points for this purchase, or continue as a guest
                                without earning points.
                            </p>

                            <div className="mt-6 grid gap-3">
                                <Button
                                    id="kiosk-rewards-signin"
                                    className="w-full gap-2"
                                    size="lg"
                                    onClick={startRewardsSignIn}
                                    disabled={checkoutPending}
                                >
                                    <UserRound className="h-4 w-4" />
                                    Sign in with Google
                                </Button>
                                <Button
                                    id="kiosk-guest-checkout"
                                    className="w-full gap-2"
                                    variant="outline"
                                    size="lg"
                                    onClick={() => void submitCheckout(true)}
                                    disabled={checkoutPending}
                                >
                                    <Receipt className="h-4 w-4" />
                                    {checkoutPending ? "Completing order..." : "Checkout as guest"}
                                </Button>
                            </div>
                        </div>
                    </div>
                ) : null}

                {/* --- REPURPOSED FOR KIOSK (Customization Modal) --- */}
                {/* This modal logic is IDENTICAL to PosClient [4]. It will appear when `selectedItem` is set. */}
                {/* You can copy the entire modal block from the bottom of pos-client.tsx here. */}
                {selectedItem ? (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                        <div
                            id="kiosk-customize-modal"
                            ref={modalContentRef}
                            tabIndex={-1}
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
                                        <Button id="kiosk-quantity-decrease" variant="outline" size="icon" onClick={() => setQuantity((current) => Math.max(1, current - 1))}>
                                            <Minus className="h-4 w-4" />
                                        </Button>
                                        <div className="min-w-[5rem] rounded-lg border border-border bg-[rgb(var(--surface-alt))] px-4 py-3 text-center text-lg font-semibold">
                                            {quantity}
                                        </div>
                                        <Button id="kiosk-quantity-increase" variant="outline" size="icon" onClick={() => setQuantity((current) => Math.min(20, current + 1))}>
                                            <Plus className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </section>

                                <section className="space-y-3">
                                    <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-stone-500">
                                        Size
                                    </h3>
                                    <div className="flex flex-wrap gap-2">
                                        {sizeOptions.map((option) => (
                                            <button
                                                key={option.value}
                                                id={`kiosk-size-${option.value}`}
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
                                                id={`kiosk-sweetness-${option}`}
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
                                                id={`kiosk-ice-${option.value}`}
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
                                                        <Button id={`kiosk-ingredient-${ingredient.id}-remove`} variant="outline" size="sm" onClick={() => updateIngredient(ingredient.id, -1)} className="flex-1">
                                                            {modalTranslations?.remove ?? "Remove"}
                                                        </Button>
                                                        <Button id={`kiosk-ingredient-${ingredient.id}-add`} size="sm" onClick={() => updateIngredient(ingredient.id, 1)} className="flex-1">
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
                                    <Button id="kiosk-cancel-customize" variant="outline" onClick={closeModal}>
                                        {modalTranslations?.cancel ?? "Cancel"}
                                    </Button>
                                    <Button id="kiosk-add-to-cart" onClick={addSelectedItem}>
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
