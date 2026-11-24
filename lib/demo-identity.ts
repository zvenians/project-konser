import { randomUUID } from "node:crypto";

export function demoCustomerEmail(id = randomUUID()) {
  return `customer+${id}@demo.symphonyoffaith.local`;
}

export function regularLoginRoleAllowed(demo: boolean, role: string) {
  return !demo || role === "CUSTOMER";
}
