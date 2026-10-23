import { Card, SectionHeading } from "@/components/ui/card";
import { AdminTable, mono, when } from "@/components/admin/admin-table";
import { tableRows } from "@/lib/admin";

export const dynamic = "force-dynamic";

interface ProfileRow {
  id: string;
  email: string | null;
  full_name: string | null;
  created_at: string;
}

interface SubRow {
  user_id: string;
  plan: string | null;
  status: string | null;
  current_period_end: string | null;
}

export default async function AdminUsersPage() {
  const [profiles, subs] = await Promise.all([
    tableRows<ProfileRow>("profiles", { limit: 100, orderBy: "created_at" }),
    tableRows<SubRow>("billing_subscriptions", { limit: 200 }),
  ]);

  const byUser = new Map<string, SubRow>();
  for (const s of subs.rows) if (s.user_id) byUser.set(s.user_id, s);

  return (
    <>
      <SectionHeading
        eyebrow="People"
        title="Users"
        description="The 100 most recent accounts. Emails come from Supabase Auth via the profiles row created by the sign-up trigger."
      />

      <Card className="p-4">
        <AdminTable
          head={["Email", "Name", "User id", "Plan", "Status", "Joined"]}
          caption="Most recent accounts"
          empty={
            profiles.error
              ? `Could not read profiles: ${profiles.error}`
              : "No accounts yet. The first Google sign-in creates one automatically."
          }
          rows={profiles.rows.map((p) => {
            const sub = byUser.get(p.id);
            return [
              <span key="e" className="font-medium">{p.email ?? "—"}</span>,
              <span key="n" className="text-fg-muted">{p.full_name ?? "—"}</span>,
              mono(p.id.slice(0, 8)),
              <span key="p" className="capitalize">{sub?.plan ?? "free"}</span>,
              <span key="s" className="capitalize text-fg-muted">{sub?.status ?? "—"}</span>,
              when(p.created_at),
            ];
          })}
        />
      </Card>

      <p className="text-[12px] leading-relaxed text-fg-subtle">
        Accounts are created only by real authentication. There is no seeded or demo user in
        this project, so an empty table here means nobody has signed in yet.
      </p>
    </>
  );
}
