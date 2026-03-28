"use client";

import { create } from "zustand";

import type { OrderItemInput } from "@/lib/types";

type OrderStore = {
  items: OrderItemInput[];
  addItem: (item: OrderItemInput) => void;
  removeItem: (index: number) => void;
  clear: () => void;
};

export const useOrderStore = create<OrderStore>((set) => ({
  items: [],
  addItem: (item) =>
    set((state) => ({
      items: [...state.items, item]
    })),
  removeItem: (index) =>
    set((state) => ({
      items: state.items.filter((_, currentIndex) => currentIndex !== index)
    })),
  clear: () =>
    set({
      items: []
    })
}));
