import { getAdminCheck } from "@/lib/admin";

export async function journalAdmin() {
  const check = await getAdminCheck();
  if (check.status === "allowed") return { ok: true as const, userId: check.userId };
  return { ok: false as const, status: check.status === "anonymous" ? 401 : check.status === "unconfigured" ? 503 : 403 };
}
