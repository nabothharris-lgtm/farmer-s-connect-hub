import { Link, NavLink } from "react-router-dom";
import { Sprout, Crown, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { signOut, type AppRole } from "@/lib/auth";
import type { SubscriptionTier } from "@/lib/subscription";
import { NotificationBell } from "@/components/NotificationBell";

interface Props {
  role: AppRole | null;
  email?: string | null;
  tier?: SubscriptionTier;
  userId?: string | null;
}

const roleLabel: Record<AppRole, string> = {
  farmer: "Farmer",
  expert: "Expert",
  store: "Agro Store",
  agent: "Field Agent",
  admin: "Admin",
};

export function AppHeader({ role, email, tier, userId }: Props) {
  return (
    <header className="border-b border-border bg-card/60 backdrop-blur sticky top-0 z-30">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Sprout className="h-5 w-5" />
          </div>
          <div>
            <div className="font-semibold leading-none tracking-tight">AgriConnect</div>
            <div className="text-[11px] text-muted-foreground">Uganda</div>
          </div>
        </Link>

        {email && (
          <nav className="hidden items-center gap-1 md:flex">
            <Button asChild variant="ghost" size="sm">
              <NavLink to="/dashboard" className={({ isActive }) => isActive ? "bg-secondary" : ""}>Dashboard</NavLink>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <NavLink to="/marketplace" className={({ isActive }) => isActive ? "bg-secondary" : ""}>Marketplace</NavLink>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <NavLink to="/pricing" className={({ isActive }) => isActive ? "bg-secondary" : ""}>Pricing</NavLink>
            </Button>
            {role === "admin" && (
              <Button asChild variant="ghost" size="sm">
                <NavLink to="/admin" className={({ isActive }) => isActive ? "bg-secondary" : ""}>
                  <ShieldCheck className="mr-1 h-3.5 w-3.5" /> Admin
                </NavLink>
              </Button>
            )}
          </nav>
        )}

        <div className="flex items-center gap-2">
          {tier === "pro" && (
            <span className="hidden items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-[11px] font-semibold text-primary-foreground sm:inline-flex">
              <Crown className="h-3 w-3" /> Pro
            </span>
          )}
          {role && (
            <span className="hidden rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground sm:inline">
              {roleLabel[role]}
            </span>
          )}
          {email && (
            <span className="hidden text-xs text-muted-foreground lg:inline">{email}</span>
          )}
          {userId && <NotificationBell userId={userId} />}
          {email ? (
            <Button variant="outline" size="sm" onClick={signOut}>
              Sign out
            </Button>
          ) : (
            <Button asChild size="sm">
              <Link to="/auth">Sign in</Link>
            </Button>
          )}
        </div>
      </div>

      {/* Mobile nav */}
      {email && (
        <nav className="flex items-center gap-1 overflow-x-auto border-t border-border/60 px-4 py-2 md:hidden">
          <Button asChild variant="ghost" size="sm">
            <Link to="/dashboard">Dashboard</Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link to="/marketplace">Marketplace</Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link to="/pricing">Pricing</Link>
          </Button>
          {role === "admin" && (
            <Button asChild variant="ghost" size="sm">
              <Link to="/admin">Admin</Link>
            </Button>
          )}
        </nav>
      )}
    </header>
  );
}
