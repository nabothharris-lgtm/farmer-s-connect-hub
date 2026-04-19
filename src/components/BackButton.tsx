import { useRouter, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  to?: string;
  label?: string;
  className?: string;
}

/**
 * Smart back button. Uses router history when possible, falls back to a `to` prop.
 * Avoids full page reload — pure client-side navigation.
 */
export function BackButton({ to, label = "Back", className }: Props) {
  const router = useRouter();

  const handle = (e: React.MouseEvent) => {
    // history.length > 1 means we have something to go back to inside the SPA
    if (typeof window !== "undefined" && window.history.length > 1) {
      e.preventDefault();
      router.history.back();
    }
    // If no history, it naturally falls back to the `to` prop of the Link
  };

  if (to) {
    return (
      <Button asChild variant="ghost" size="sm" className={className}>
        <Link to={to} onClick={handle}>
          <ArrowLeft className="mr-1 h-4 w-4" /> {label}
        </Link>
      </Button>
    );
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className={className}
      onClick={() => {
        if (typeof window !== "undefined" && window.history.length > 1) {
          router.history.back();
        } else {
          router.navigate({ to: "/" });
        }
      }}
    >
      <ArrowLeft className="mr-1 h-4 w-4" /> {label}
    </Button>
  );
}
