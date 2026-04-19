import { Link } from "@tanstack/react-router";
import { Sprout } from "lucide-react";
import { Button } from "@/components/ui/button";
import { signOut, type AppRole } from "@/lib/auth";

interface Props {
  role: AppRole | null;
  email?: string | null;
}

const roleLabel: Record<AppRole, string> = {
  farmer: "Farmer",
  expert: "Expert",
  store: "Agro Store",
  agent: "Field Agent",
  admin: "Admin",
};

export function AppHeader({ role, email }: Props) {
  return (
    <header className="border-b border-border bg-card/60 backdrop-blur sticky top-0 z-30">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Sprout className="h-5 w-5" />
          </div>
          <div>
            <div className="font-semibold leading-none tracking-tight">AgriConnect</div>
            <div className="text-[11px] text-muted-foreground">Uganda</div>
          </div>
        </Link>
        <div className="flex items-center gap-3">
          {role && (
            <span className="hidden rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground sm:inline">
              {roleLabel[role]}
            </span>
          )}
          {email && (
            <span className="hidden text-xs text-muted-foreground md:inline">{email}</span>
          )}
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
    </header>
  );
}
