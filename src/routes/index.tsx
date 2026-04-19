import { createFileRoute, Link } from "@tanstack/react-router";
import { Sprout, MapPin, Calendar, Wallet, Star, Users, Store, UserCog } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AgriConnect — Uganda's agricultural marketplace" },
      {
        name: "description",
        content:
          "Connecting Ugandan farmers with verified agro experts, input stores and field agents. Book services, track your farm, grow your harvest.",
      },
      { property: "og:title", content: "AgriConnect — Uganda's agricultural marketplace" },
      {
        property: "og:description",
        content:
          "Find nearby experts, order farm inputs, and grow with trusted partners.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <header className="border-b border-border/60">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Sprout className="h-5 w-5" />
            </div>
            <div>
              <div className="font-semibold leading-none tracking-tight">AgriConnect</div>
              <div className="text-[11px] text-muted-foreground">Uganda</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link to="/auth">Sign in</Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/auth">Get started</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0 -z-10 opacity-60"
          style={{
            background:
              "radial-gradient(60% 50% at 80% 0%, var(--primary-glow) 0%, transparent 60%), radial-gradient(40% 40% at 0% 100%, var(--accent) 0%, transparent 60%)",
          }}
        />
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-20 md:grid-cols-2 md:py-28">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              MVP — built for the AgriConnect pilot
            </span>
            <h1 className="mt-5 text-4xl font-bold leading-[1.05] tracking-tight md:text-6xl">
              Grow more, with the <span className="text-primary">right people</span> beside you.
            </h1>
            <p className="mt-5 max-w-lg text-lg text-muted-foreground">
              AgriConnect links Ugandan farmers to verified agro experts, input stores and field
              agents — book a consultation in minutes, pay safely, and grow your harvest.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link to="/auth">Join AgriConnect</Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link to="/auth">I'm an Expert</Link>
              </Button>
            </div>
            <div className="mt-8 flex items-center gap-6 text-sm text-muted-foreground">
              <div className="flex items-center gap-2"><Star className="h-4 w-4 text-accent" /> Verified experts</div>
              <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-accent" /> GPS matching</div>
              <div className="flex items-center gap-2"><Wallet className="h-4 w-4 text-accent" /> Escrow-ready</div>
            </div>
          </div>

          {/* Visual card */}
          <div className="relative">
            <div className="rounded-3xl border border-border bg-card p-6 shadow-xl">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">Nearby experts</div>
                <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px]">Mukono</span>
              </div>
              <div className="mt-4 space-y-3">
                {[
                  { n: "Sarah N.", s: "Coffee agronomy", km: 2.4, r: 4.9 },
                  { n: "Joseph K.", s: "Soil & irrigation", km: 4.1, r: 4.7 },
                  { n: "Grace A.", s: "Poultry health", km: 6.8, r: 4.8 },
                ].map((e) => (
                  <div key={e.n} className="flex items-center justify-between rounded-xl border border-border/60 bg-background p-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 font-semibold text-primary">
                        {e.n[0]}
                      </div>
                      <div>
                        <div className="text-sm font-semibold">{e.n}</div>
                        <div className="text-xs text-muted-foreground">{e.s}</div>
                      </div>
                    </div>
                    <div className="text-right text-xs">
                      <div className="font-medium">{e.km} km</div>
                      <div className="text-muted-foreground">★ {e.r}</div>
                    </div>
                  </div>
                ))}
              </div>
              <Button asChild className="mt-5 w-full">
                <Link to="/auth">Book a consultation</Link>
              </Button>
            </div>
            <div className="absolute -bottom-4 -right-4 -z-10 h-full w-full rounded-3xl bg-primary/15" />
          </div>
        </div>
      </section>

      {/* Roles */}
      <section className="border-t border-border/60 bg-card/40">
        <div className="mx-auto max-w-6xl px-4 py-20">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-bold tracking-tight md:text-4xl">One platform, four roles</h2>
            <p className="mt-3 text-muted-foreground">
              AgriConnect is a marketplace — every side wins when farmers grow more.
            </p>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[
              { i: Sprout, t: "Farmers", d: "Find experts, order inputs, track your farm history." },
              { i: UserCog, t: "Experts", d: "Get booked by farmers near you. Build your reputation." },
              { i: Store, t: "Agro Stores", d: "List inputs, fulfil orders, grow visibility." },
              { i: Users, t: "Field Agents", d: "Onboard farmers, earn commission on every transaction." },
            ].map(({ i: Icon, t, d }) => (
              <Card key={t} className="p-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="mt-4 font-semibold">{t}</div>
                <p className="mt-1 text-sm text-muted-foreground">{d}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-6xl px-4 py-20">
        <h2 className="text-3xl font-bold tracking-tight md:text-4xl">How it works</h2>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {[
            { i: MapPin, t: "1. Sign up & locate", d: "Create your account, share your farm location." },
            { i: Calendar, t: "2. Book a service", d: "Pick a verified expert and schedule a visit." },
            { i: Wallet, t: "3. Pay & rate", d: "Pay safely; release funds when work is done." },
          ].map(({ i: Icon, t, d }) => (
            <div key={t} className="rounded-2xl border border-border bg-card p-6">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-accent/15 text-accent">
                <Icon className="h-5 w-5" />
              </div>
              <div className="mt-4 text-lg font-semibold">{t}</div>
              <p className="mt-1 text-sm text-muted-foreground">{d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-4 pb-24">
        <div className="overflow-hidden rounded-3xl bg-primary p-10 text-primary-foreground md:p-14">
          <h3 className="text-3xl font-bold tracking-tight md:text-4xl">Ready to grow with AgriConnect?</h3>
          <p className="mt-3 max-w-xl opacity-90">
            Join the pilot. Sign up as a farmer, expert, store, or agent.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild size="lg" variant="secondary">
              <Link to="/auth">Create free account</Link>
            </Button>
          </div>
        </div>
      </section>

      <footer className="border-t border-border/60 py-8 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} AgriConnect — A marketplace for Ugandan agriculture.
      </footer>
    </div>
  );
}
