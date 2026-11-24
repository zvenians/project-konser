export type StaffRole = "CUSTOMER" | "ADMIN" | "FINANCE" | "CHECK_IN" | "STREAM_OPERATOR";
export type StaffCapability = "inventory" | "finance" | "checkin" | "stream" | "users" | "settings";

const grants: Record<StaffRole, ReadonlySet<StaffCapability>> = {
  CUSTOMER: new Set(),
  ADMIN: new Set(["inventory", "finance", "checkin", "stream", "users", "settings"]),
  FINANCE: new Set(["finance"]),
  CHECK_IN: new Set(["checkin"]),
  STREAM_OPERATOR: new Set(["stream"]),
};

export function hasCapability(role: string, capability: StaffCapability) {
  return role in grants && grants[role as StaffRole].has(capability);
}
