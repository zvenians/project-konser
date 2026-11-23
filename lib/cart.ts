import { useSyncExternalStore } from "react";

export const CART_KEY = "sof_cart_v1";
export type Cart = Record<string, number>;

export function parseCart(raw: string): Cart {
  try {
    const value = JSON.parse(raw);
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return Object.fromEntries(
      Object.entries(value).filter(
        ([key, quantity]) =>
          /^[0-9a-f-]{36}$/i.test(key) &&
          Number.isInteger(quantity) &&
          Number(quantity) > 0 &&
          Number(quantity) <= 10,
      ),
    ) as Cart;
  } catch {
    return {};
  }
}

export function readCart(): Cart {
  return parseCart(localStorage.getItem(CART_KEY) || "{}");
}

export function saveCart(cart: Cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  window.dispatchEvent(new Event("sof:cart"));
}

function subscribe(notify: () => void) {
  window.addEventListener("sof:cart", notify);
  window.addEventListener("storage", notify);
  return () => {
    window.removeEventListener("sof:cart", notify);
    window.removeEventListener("storage", notify);
  };
}
function snapshot() {
  return localStorage.getItem(CART_KEY) || "{}";
}
function serverSnapshot() {
  return "{}";
}
export function useCart(): [Cart, (update: (current: Cart) => Cart) => void] {
  const raw = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  return [parseCart(raw), (update) => saveCart(update(readCart()))];
}
