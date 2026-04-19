import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { Check, Sparkles, Loader2, Crown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AppHeader } from "@/components/AppHeader";
import { BackButton } from "@/components/BackButton";
import { getCurrentUserAndRole, type AppRole } from "@/lib/auth";
import { FREE_FEATURES, PRO_FEATURES, type SubscriptionTier } from "@/lib/subscription";
import { toast } from "sonner";

export default function Pricing() {
  const [role, setRole] = useState<AppRole | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [tier, setTier] = useState<SubscriptionTier>("free");
  const [userId, setUserId] = useState<string | null>(null);
  const [upgrading, setUpgrading] = useState(false);

  useEffect(() => {
    (async () => {
      const { user, role } = await getCurrentUserAndRole();
      setRole(role);
      setEmail(user?.email ?? null);
      setUserId(user?.id ?? null);
      if (user) {
        const { data } = await supabase
          .from("profiles")
          .select("subscription_tier")
          .eq("id", user.id)
          .maybeSingle();
        if (data?.subscription_tier) setTier(data.subscription_tier as SubscriptionTier);
      }
    })();
  }, []);

  const upgrade = async () => {
    if (!userId) {
      toast.info("Sign in first to upgrade");
      return;
    }
    setUpgrading(true);
    const { error } = await supabase
      .from("profiles")
      .update({ subscription_tier: "pro", pro_since: new Date().toISOString() })
      .eq("id", userId);
    setUpgrading(false);
    if (error) return toast.error(error.message);
    setTier("pro");
    toast.success("Welcome to Pro!");
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader role={role} email={email} />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <BackButton to="/dashboard" className="mb-2" />
        <div className="mb-8 text-center">
          <Badge variant="secondary" className="mb-3">
            <Sparkles className="mr-1 h-3 w-3" /> Choose your plan
          </Badge>
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Free or Pro — your call</h1>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
            Start free, see how AgriConnect fits your work, and upgrade when you're ready to grow faster.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          {/* FREE */}
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-muted-foreground">Starter</div>
                <div className="text-2xl font-bold">Free</div>
              </div>
              {tier === "free" && <Badge variant="outline">Current plan</Badge>}
            </div>
            <p className="mt-2 text-sm text-muted-foreground">Everything you need to get started.</p>
            <ul className="mt-5 space-y-2.5">
              {FREE_FEATURES.map((f) => (
                <li key={f} className="flex gap-2 text-sm">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> <span>{f}</span>
                </li>
              ))}
            </ul>
            <Button variant="outline" className="mt-6 w-full" disabled>
              {tier === "free" ? "You're on Free" : "Downgrade (contact us)"}
            </Button>
          </Card>

          {/* PRO */}
          <Card className="relative overflow-hidden border-primary/40 p-6">
            <div
              className="pointer-events-none absolute inset-0 -z-0 opacity-40"
              style={{
                background:
                  "radial-gradient(60% 50% at 100% 0%, var(--primary-glow) 0%, transparent 60%)",
              }}
            />
            <div className="relative z-10">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 text-sm font-medium text-primary">
                    <Crown className="h-4 w-4" /> Most popular
                  </div>
                  <div className="text-2xl font-bold">Pro</div>
                </div>
                {tier === "pro" ? (
                  <Badge className="bg-primary text-primary-foreground">Current plan</Badge>
                ) : (
                  <Badge variant="secondary">Pricing soon</Badge>
                )}
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                Get seen first. Get booked more. Sell more.
              </p>
              <ul className="mt-5 space-y-2.5">
                {PRO_FEATURES.map((f) => (
                  <li key={f} className="flex gap-2 text-sm">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> <span className="font-medium">{f}</span>
                  </li>
                ))}
              </ul>
              {tier === "pro" ? (
                <Button className="mt-6 w-full" disabled>
                  <Crown className="mr-2 h-4 w-4" /> Pro active
                </Button>
              ) : userId ? (
                <Button className="mt-6 w-full" onClick={upgrade} disabled={upgrading}>
                  {upgrading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Crown className="mr-2 h-4 w-4" />}
                  Upgrade to Pro (simulated)
                </Button>
              ) : (
                <Button asChild className="mt-6 w-full">
                  <Link to="/auth">Sign in to upgrade</Link>
                </Button>
              )}
            </div>
          </Card>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Real Mobile Money / card payment integration ships in a later phase. For now, upgrade is simulated for testing.
        </p>
      </main>
    </div>
  );
}
