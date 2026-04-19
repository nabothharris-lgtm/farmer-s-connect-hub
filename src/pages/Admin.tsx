import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, ShieldCheck, FileText, CheckCircle2, XCircle, Users, Store, UserCog, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AppHeader } from "@/components/AppHeader";
import { BackButton } from "@/components/BackButton";
import { getCurrentUserAndRole } from "@/lib/auth";
import { toast } from "sonner";

interface PendingUser {
  id: string;
  full_name: string | null;
  phone: string | null;
  verification_status: string;
  role: string;
  doc_count: number;
}

export default function Admin() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState<string | null>(null);
  const [users, setUsers] = useState<PendingUser[]>([]);
  const [stats, setStats] = useState({ farmers: 0, experts: 0, stores: 0, agents: 0, pending: 0 });

  const loadAll = async () => {
    setLoading(true);
    // All profiles + their roles
    const [{ data: profs }, { data: roles }, { data: docs }] = await Promise.all([
      supabase.from("profiles").select("id, full_name, phone, verification_status"),
      supabase.from("user_roles").select("user_id, role"),
      supabase.from("verification_documents").select("user_id"),
    ]);
    const roleByUser = new Map<string, string[]>();
    (roles ?? []).forEach((r) => {
      const arr = roleByUser.get(r.user_id) ?? [];
      arr.push(r.role);
      roleByUser.set(r.user_id, arr);
    });
    const docCount = new Map<string, number>();
    (docs ?? []).forEach((d) => docCount.set(d.user_id, (docCount.get(d.user_id) ?? 0) + 1));

    const list: PendingUser[] = (profs ?? []).map((p) => {
      const userRoles = roleByUser.get(p.id) ?? [];
      // pick the most relevant non-admin role to show
      const display = userRoles.find((r) => r !== "admin") ?? userRoles[0] ?? "—";
      return {
        id: p.id,
        full_name: p.full_name,
        phone: p.phone,
        verification_status: p.verification_status ?? "unsubmitted",
        role: display,
        doc_count: docCount.get(p.id) ?? 0,
      };
    });

    setUsers(list);
    setStats({
      farmers: list.filter((u) => u.role === "farmer").length,
      experts: list.filter((u) => u.role === "expert").length,
      stores:  list.filter((u) => u.role === "store").length,
      agents:  list.filter((u) => u.role === "agent").length,
      pending: list.filter((u) => u.verification_status === "pending").length,
    });
    setLoading(false);
  };

  useEffect(() => {
    (async () => {
      const { user, role } = await getCurrentUserAndRole();
      if (!user) {
        navigate({ to: "/auth" });
        return;
      }
      // Also accept admin role if it exists in the user's role set
      const { data: allRoles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      const isAdmin = (allRoles ?? []).some((r) => r.role === "admin") || role === "admin";
      if (!isAdmin) {
        toast.error("Admin access required");
        navigate({ to: "/dashboard" });
        return;
      }
      setEmail(user.email ?? null);
      await loadAll();
    })();
  }, [navigate]);

  const setStatus = async (userId: string, status: "approved" | "rejected") => {
    const { error } = await supabase
      .from("profiles")
      .update({
        verification_status: status,
        verified: status === "approved",
      })
      .eq("id", userId);
    if (error) return toast.error(error.message);

    // Notify the user
    await supabase.from("notifications").insert({
      user_id: userId,
      kind: "system",
      title: status === "approved" ? "You're verified!" : "Verification rejected",
      body: status === "approved"
        ? "Your account is now marked as Verified on AgriConnect."
        : "Your documents could not be approved. Please re-upload clearer copies.",
    });

    // If expert: also flip expert_profiles.verified
    await supabase.from("expert_profiles").update({ verified: status === "approved" }).eq("id", userId);

    toast.success(`User ${status}`);
    loadAll();
  };

  const viewDoc = async (userId: string) => {
    const { data: docs } = await supabase
      .from("verification_documents")
      .select("doc_type, file_url")
      .eq("user_id", userId);
    if (!docs || docs.length === 0) return toast.info("No documents uploaded");
    // Open first doc as a signed URL
    for (const d of docs) {
      const { data } = await supabase.storage.from("verification-docs").createSignedUrl(d.file_url, 60 * 5);
      if (data?.signedUrl) window.open(data.signedUrl, "_blank");
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const pending = users.filter((u) => u.verification_status === "pending" && (u.role === "expert" || u.role === "store"));
  const approved = users.filter((u) => u.verification_status === "approved");
  const allUsers = users;

  return (
    <div className="min-h-screen bg-background">
      <AppHeader role="admin" email={email} />
      <main className="mx-auto max-w-6xl px-4 py-6">
        <div className="mb-4 flex items-center justify-between">
          <BackButton to="/dashboard" />
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="h-4 w-4 text-primary" /> Admin panel
          </div>
        </div>

        <h1 className="mb-1 text-2xl font-bold tracking-tight md:text-3xl">Admin Control Center</h1>
        <p className="mb-6 text-muted-foreground">Verify experts and stores, monitor users, keep AgriConnect trustworthy.</p>

        <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard icon={Users}     label="Farmers"  value={stats.farmers} />
          <StatCard icon={UserCog}   label="Experts"  value={stats.experts} />
          <StatCard icon={Store}     label="Stores"   value={stats.stores} />
          <StatCard icon={Users}     label="Agents"   value={stats.agents} />
          <StatCard icon={FileText}  label="Pending"  value={stats.pending} highlight />
        </div>

        <Tabs defaultValue="pending">
          <TabsList>
            <TabsTrigger value="pending">Pending verification ({pending.length})</TabsTrigger>
            <TabsTrigger value="approved">Verified ({approved.length})</TabsTrigger>
            <TabsTrigger value="all">All users ({allUsers.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="mt-4">
            <UserList users={pending} onApprove={(id) => setStatus(id, "approved")} onReject={(id) => setStatus(id, "rejected")} onView={viewDoc} />
          </TabsContent>
          <TabsContent value="approved" className="mt-4">
            <UserList users={approved} onApprove={(id) => setStatus(id, "approved")} onReject={(id) => setStatus(id, "rejected")} onView={viewDoc} />
          </TabsContent>
          <TabsContent value="all" className="mt-4">
            <UserList users={allUsers} onApprove={(id) => setStatus(id, "approved")} onReject={(id) => setStatus(id, "rejected")} onView={viewDoc} />
          </TabsContent>
        </Tabs>

        <div className="mt-8 text-center text-xs text-muted-foreground">
          <Link to="/dashboard" className="underline">Back to dashboard</Link>
        </div>
      </main>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, highlight }: { icon: any; label: string; value: number; highlight?: boolean }) {
  return (
    <Card className={`p-4 ${highlight ? "border-accent/50 bg-accent/5" : ""}`}>
      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground">{label}</div>
        <Icon className={`h-4 w-4 ${highlight ? "text-accent" : "text-primary"}`} />
      </div>
      <div className="mt-2 text-2xl font-bold">{value}</div>
    </Card>
  );
}

function UserList({
  users,
  onApprove,
  onReject,
  onView,
}: {
  users: PendingUser[];
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onView: (id: string) => void;
}) {
  if (users.length === 0) {
    return <Card className="p-6 text-center text-sm text-muted-foreground">Nothing here.</Card>;
  }
  return (
    <div className="space-y-2">
      {users.map((u) => (
        <Card key={u.id} className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <div className="font-semibold">{u.full_name || "—"}</div>
                <Badge variant="secondary" className="text-[10px] capitalize">{u.role}</Badge>
                {u.verification_status === "approved" && (
                  <Badge className="bg-primary text-primary-foreground text-[10px]">
                    <CheckCircle2 className="mr-1 h-3 w-3" /> Verified
                  </Badge>
                )}
                {u.verification_status === "pending" && (
                  <Badge className="bg-accent text-accent-foreground text-[10px]">Pending</Badge>
                )}
                {u.verification_status === "rejected" && (
                  <Badge variant="destructive" className="text-[10px]">Rejected</Badge>
                )}
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                {u.phone || "no phone"} · {u.doc_count} document{u.doc_count === 1 ? "" : "s"}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {u.doc_count > 0 && (
                <Button size="sm" variant="outline" onClick={() => onView(u.id)}>
                  <Eye className="mr-1 h-3 w-3" /> View
                </Button>
              )}
              {u.verification_status !== "approved" && (
                <Button size="sm" onClick={() => onApprove(u.id)}>
                  <CheckCircle2 className="mr-1 h-3 w-3" /> Approve
                </Button>
              )}
              {u.verification_status !== "rejected" && (
                <Button size="sm" variant="outline" onClick={() => onReject(u.id)}>
                  <XCircle className="mr-1 h-3 w-3" /> Reject
                </Button>
              )}
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
