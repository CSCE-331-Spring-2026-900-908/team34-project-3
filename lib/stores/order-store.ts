"use client";

import { create } from "zustand";

import type { OrderItemInput } from "@/lib/types";

type OrderStore = {
  items: OrderItemInput[];
  addItem: (item: OrderItemInput) => void;
  removeItem: (index: number) => void;
  updateItem: (index: number, item: OrderItemInput) => void;
  replaceItems: (items: OrderItemInput[]) => void;
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
  updateItem: (index, item) =>
    set((state) => ({
      items: state.items.map((currentItem, currentIndex) => (currentIndex === index ? item : currentItem))
    })),
  replaceItems: (items) =>
    set({
      items
    }),
  clear: () =>
    set({
      items: []
    })
}));
