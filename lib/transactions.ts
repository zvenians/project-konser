export function reservationIsActive(status: string, expiresAt: string | Date, now = Date.now()) {
  return status === "PENDING" && new Date(expiresAt).getTime() > now;
}

export function cartTotal(items: Array<{ quantity: number; price: number }>) {
  return items.reduce((total, item) => total + item.quantity * item.price, 0);
}
