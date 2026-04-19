import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, MapPin, Calendar, Star, Users, Store, Wallet, ArrowRight, Crown, Sparkles, Package, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentUserAndRole, type AppRole, distanceKm } from "@/lib/auth";
import { shouldShowProUpsell, type SubscriptionTier, TRIAL_DAYS } from "@/lib/subscription";
import { AppHeader } from "@/components/AppHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [{ title: "Dashboard — AgriConnect" }],
  }),
  component: DashboardPage,
});

interface Profile {
  id: string;
  full_name: string | null;
  location_lat: number | null;
  location_lng: number | null;
  subscription_tier: SubscriptionTier;
  pro_since: string | null;
  created_at: string;
  farmer_specialty: string | null;
}

function DashboardPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<AppRole | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    (async () => {
      const { user, role } = await getCurrentUserAndRole();
      if (!user) {
        navigate({ to: "/auth" });
        return;
      }
      setEmail(user.email ?? null);
      setRole(role);
      const { data: prof } = await supabase
        .from("profiles")
        .select("id, full_name, location_lat, location_lng, subscription_tier, pro_since, created_at, farmer_specialty")
        .eq("id", user.id)
        .maybeSingle();
      setProfile(prof as Profile | null);
      setLoading(false);
    })();
  }, [navigate]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader role={role} email={email} tier={profile?.subscription_tier} />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
              Karibu, {profile?.full_name || "friend"} 👋
            </h1>
            <p className="text-muted-foreground">
              {role === "farmer" && "Find experts, list produce, and grow your farm."}
              {role === "expert" && "Manage incoming bookings and your profile."}
              {role === "store" && "Manage your products and incoming orders (coming soon)."}
              {role === "agent" && "Onboard farmers and earn commission (coming soon)."}
              {!role && "Your role isn't set yet."}
            </p>
          </div>
          {profile?.subscription_tier === "pro" && (
            <Badge className="bg-primary text-primary-foreground">
              <Crown className="mr-1 h-3 w-3" /> Pro member
            </Badge>
          )}
        </div>

        <ProUpsellBanner profile={profile} />

        {role === "farmer" && <FarmerView profile={profile} />}
        {role === "expert" && <ExpertView />}
        {role === "store" && <ComingSoonView icon={Store} title="Store dashboard" />}
        {role === "agent" && <ComingSoonView icon={Users} title="Agent dashboard" />}
      </main>
    </div>
  );
}

/* ========== PRO UPSELL ========== */

function ProUpsellBanner({ profile }: { profile: Profile | null }) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed || !profile) return null;
  if (!shouldShowProUpsell(profile)) return null;

  return (
    <Card className="relative mb-6 overflow-hidden border-primary/40 p-5">
      <div
        className="pointer-events-none absolute inset-0 -z-0 opacity-40"
        style={{ background: "radial-gradient(60% 80% at 100% 0%, var(--primary-glow) 0%, transparent 60%)" }}
      />
      <button onClick={() => setDismissed(true)} className="absolute right-3 top-3 rounded-full p-1 text-muted-foreground hover:bg-muted">
        <X className="h-4 w-4" />
      </button>
      <div className="relative z-10 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <div className="font-semibold">You've been on Free for {TRIAL_DAYS}+ days — ready for Pro?</div>
            <p className="text-sm text-muted-foreground">
              Get promoted placement, marketplace ads, and a verified Pro badge.
            </p>
          </div>
        </div>
        <Button asChild>
          <Link to="/pricing">
            <Crown className="mr-1 h-4 w-4" /> See Pro plan
          </Link>
        </Button>
      </div>
    </Card>
  );
}

/* ========== FARMER ========== */

interface ExpertCard {
  id: string;
  full_name: string | null;
  specialty: string;
  rating: number;
  hourly_rate: number;
  years_experience: number;
  verified: boolean;
  location_lat: number | null;
  location_lng: number | null;
  tier: SubscriptionTier;
  km?: number;
}

function FarmerView({ profile }: { profile: Profile | null }) {
  const [experts, setExperts] = useState<ExpertCard[]>([]);
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [bookingId, setBookingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const [{ data: ex }, { data: bk }] = await Promise.all([
      supabase
        .from("expert_profiles")
        .select(
          "id, specialty, rating, hourly_rate, years_experience, verified, profiles!expert_profiles_id_fkey(full_name, location_lat, location_lng, subscription_tier)",
        ),
      supabase
        .from("bookings")
        .select("id, status, payment_status, scheduled_for, price, notes, expert_id, profiles:expert_id(full_name)")
        .order("scheduled_for", { ascending: false }),
    ]);
    const list: ExpertCard[] = (ex ?? []).map((row: any) => {
      const card: ExpertCard = {
        id: row.id,
        full_name: row.profiles?.full_name ?? "Expert",
        specialty: row.specialty,
        rating: Number(row.rating ?? 0),
        hourly_rate: Number(row.hourly_rate ?? 0),
        years_experience: row.years_experience ?? 0,
        verified: row.verified,
        location_lat: row.profiles?.location_lat ?? null,
        location_lng: row.profiles?.location_lng ?? null,
        tier: (row.profiles?.subscription_tier as SubscriptionTier) ?? "free",
      };
      if (
        profile?.location_lat &&
        profile?.location_lng &&
        card.location_lat &&
        card.location_lng
      ) {
        card.km = distanceKm(
          { lat: profile.location_lat, lng: profile.location_lng },
          { lat: card.location_lat, lng: card.location_lng },
        );
      }
      return card;
    });
    // Pro experts always first, then by distance
    list.sort((a, b) => {
      const ap = a.tier === "pro" ? 1 : 0;
      const bp = b.tier === "pro" ? 1 : 0;
      if (ap !== bp) return bp - ap;
      return (a.km ?? 9999) - (b.km ?? 9999);
    });
    setExperts(list);
    setBookings((bk as any) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  const book = async (expertId: string, price: number) => {
    setBookingId(expertId);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const scheduled = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const { error } = await supabase.from("bookings").insert({
        farmer_id: u.user.id,
        expert_id: expertId,
        scheduled_for: scheduled,
        price,
        notes: "Farm consultation",
      });
      if (error) throw error;
      toast.success("Booking requested");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to book");
    } finally {
      setBookingId(null);
    }
  };

  if (loading) {
    return <Loader2 className="h-6 w-6 animate-spin text-primary" />;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <section className="lg:col-span-2">
        <h2 className="mb-3 text-lg font-semibold">Experts near you</h2>
        {!profile?.location_lat && (
          <p className="mb-3 rounded-lg border border-dashed border-border bg-card p-3 text-sm text-muted-foreground">
            <MapPin className="mr-1 inline h-4 w-4" /> Add your location in profile to see distances.
          </p>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          {experts.length === 0 && (
            <Card className="p-5 text-sm text-muted-foreground">No experts yet.</Card>
          )}
          {experts.map((e) => (
            <Card key={e.id} className={`relative p-4 ${e.tier === "pro" ? "border-primary/40 ring-1 ring-primary/20" : ""}`}>
              {e.tier === "pro" && (
                <Badge className="absolute right-3 top-3 bg-primary text-primary-foreground text-[10px]">
                  <Sparkles className="mr-0.5 h-2.5 w-2.5" /> Sponsored
                </Badge>
              )}
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 font-semibold text-primary">
                  {(e.full_name ?? "E")[0]}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <div className="font-semibold">{e.full_name}</div>
                    {e.verified && <Badge variant="secondary" className="text-[10px]">Verified</Badge>}
                  </div>
                  <div className="text-xs text-muted-foreground">{e.specialty}</div>
                  <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Star className="h-3 w-3 text-accent" /> {e.rating.toFixed(1)}</span>
                    <span>{e.years_experience} yrs</span>
                    {e.km !== undefined && <span>{e.km.toFixed(1)} km away</span>}
                  </div>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <div className="text-sm font-medium">UGX {Number(e.hourly_rate).toLocaleString()}/hr</div>
                <Button size="sm" disabled={bookingId === e.id} onClick={() => book(e.id, e.hourly_rate)}>
                  {bookingId === e.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Book"}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">My bookings</h2>
        <BookingList rows={bookings} mode="farmer" onChange={load} />
      </section>
    </div>
  );
}

/* ========== EXPERT ========== */

function ExpertView() {
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ pending: 0, accepted: 0, completed: 0, earnings: 0 });

  const load = async () => {
    setLoading(true);
    const { data: bk } = await supabase
      .from("bookings")
      .select("id, status, payment_status, scheduled_for, price, notes, farmer_id, profiles:farmer_id(full_name)")
      .order("scheduled_for", { ascending: false });
    const list = (bk as any) ?? [];
    setBookings(list);
    const s = { pending: 0, accepted: 0, completed: 0, earnings: 0 };
    for (const b of list) {
      if (b.status === "pending") s.pending++;
      if (b.status === "accepted") s.accepted++;
      if (b.status === "completed") {
        s.completed++;
        s.earnings += Number(b.price ?? 0);
      }
    }
    setStats(s);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  if (loading) return <Loader2 className="h-6 w-6 animate-spin text-primary" />;

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Pending" value={stats.pending} icon={Calendar} />
        <Stat label="Accepted" value={stats.accepted} icon={ArrowRight} />
        <Stat label="Completed" value={stats.completed} icon={Star} />
        <Stat label="Earnings (UGX)" value={stats.earnings.toLocaleString()} icon={Wallet} />
      </div>
      <section>
        <h2 className="mb-3 text-lg font-semibold">Booking requests</h2>
        <BookingList rows={bookings} mode="expert" onChange={load} />
      </section>
    </div>
  );
}

function Stat({ label, value, icon: Icon }: { label: string; value: number | string; icon: any }) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">{label}</div>
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <div className="mt-2 text-2xl font-bold">{value}</div>
    </Card>
  );
}

/* ========== BOOKINGS LIST ========== */

interface BookingRow {
  id: string;
  status: "pending" | "accepted" | "completed" | "cancelled";
  payment_status: "pending" | "paid" | "released";
  scheduled_for: string;
  price: number;
  notes: string | null;
  farmer_id?: string;
  expert_id?: string;
  profiles?: { full_name: string | null } | null;
}

const statusColor: Record<BookingRow["status"], string> = {
  pending: "bg-muted text-muted-foreground",
  accepted: "bg-primary/15 text-primary",
  completed: "bg-accent/15 text-accent",
  cancelled: "bg-destructive/15 text-destructive",
};

function BookingList({
  rows,
  mode,
  onChange,
}: {
  rows: BookingRow[];
  mode: "farmer" | "expert";
  onChange: () => void;
}) {
  const update = async (
    id: string,
    patch: {
      status?: BookingRow["status"];
      payment_status?: BookingRow["payment_status"];
    },
  ) => {
    const { error } = await supabase.from("bookings").update(patch).eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Updated");
      onChange();
    }
  };

  if (rows.length === 0) {
    return <Card className="p-5 text-sm text-muted-foreground">No bookings yet.</Card>;
  }

  return (
    <div className="space-y-3">
      {rows.map((b) => (
        <Card key={b.id} className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">
                {mode === "farmer" ? "Expert" : "Farmer"}: {b.profiles?.full_name || "—"}
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                {new Date(b.scheduled_for).toLocaleString()}
              </div>
              {b.notes && <div className="mt-1 text-xs">{b.notes}</div>}
            </div>
            <div className="text-right">
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${statusColor[b.status]}`}>
                {b.status}
              </span>
              <div className="mt-1 text-xs text-muted-foreground">UGX {Number(b.price).toLocaleString()}</div>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {mode === "expert" && b.status === "pending" && (
              <>
                <Button size="sm" onClick={() => update(b.id, { status: "accepted" })}>Accept</Button>
                <Button size="sm" variant="outline" onClick={() => update(b.id, { status: "cancelled" })}>Decline</Button>
              </>
            )}
            {mode === "expert" && b.status === "accepted" && (
              <Button size="sm" onClick={() => update(b.id, { status: "completed", payment_status: "released" })}>
                Mark completed
              </Button>
            )}
            {mode === "farmer" && b.status === "accepted" && b.payment_status === "pending" && (
              <Button size="sm" onClick={() => update(b.id, { payment_status: "paid" })}>
                Pay (simulated)
              </Button>
            )}
            {mode === "farmer" && b.status === "pending" && (
              <Button size="sm" variant="outline" onClick={() => update(b.id, { status: "cancelled" })}>
                Cancel
              </Button>
            )}
            <span className="ml-auto self-center text-[11px] text-muted-foreground">
              Payment: {b.payment_status}
            </span>
          </div>
        </Card>
      ))}
    </div>
  );
}

function ComingSoonView({ icon: Icon, title }: { icon: any; title: string }) {
  return (
    <Card className="flex flex-col items-center p-10 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Icon className="h-7 w-7" />
      </div>
      <h2 className="mt-4 text-xl font-semibold">{title}</h2>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">
        This dashboard is part of the AgriConnect roadmap. The auth + role system is live — the
        feature workflows ship in the next iteration.
      </p>
    </Card>
  );
}
