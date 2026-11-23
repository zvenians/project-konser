"use client";
import { useEffect } from "react";
import { CART_KEY } from "@/lib/cart";
export function CartClearer() {
  useEffect(() => {
    localStorage.removeItem(CART_KEY);
  }, []);
  return null;
}
