import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Plus, Trash2, Crown, Package, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AppHeader } from "@/components/AppHeader";
import { BackButton } from "@/components/BackButton";
import { getCurrentUserAndRole, type AppRole } from "@/lib/auth";
import { toast } from "sonner";

export const Route = createFileRoute("/marketplace")({
  head: () => ({
    meta: [
      { title: "Farmer Marketplace — AgriConnect" },
      { name: "description", content: "Browse fresh farm produce from Ugandan farmers — poultry, crops, dairy, fish and more." },
      { property: "og:title", content: "Farmer Marketplace — AgriConnect" },
      { property: "og:description", content: "Buy direct from farmers. Pro farmers get promoted listings." },
    ],
  }),
  component: MarketplacePage,
});

const CATEGORIES = ["poultry", "crops", "dairy", "fish", "mixed", "other"] as const;
type Category = (typeof CATEGORIES)[number];

interface Product {
  id: string;
  farmer_id: string;
  title: string;
  description: string | null;
  category: Category;
  price: number;
  unit: string;
  quantity_available: number;
  is_active: boolean;
  profiles?: { full_name: string | null; subscription_tier: "free" | "pro"; location_label: string | null } | null;
}

function MarketplacePage() {
  const navigate = useNavigate();
  const [role, setRole] = useState<AppRole | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | Category>("all");
  const [open, setOpen] = useState(false);

  // form
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [category, setCategory] = useState<Category>("crops");
  const [price, setPrice] = useState("");
  const [unit, setUnit] = useState("kg");
  const [qty, setQty] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("farmer_products")
      .select("*, profiles:farmer_id(full_name, subscription_tier, location_label)")
      .eq("is_active", true);
    const list = (data as any[] | null) ?? [];
    // Pro farmers first
    list.sort((a, b) => {
      const ap = a.profiles?.subscription_tier === "pro" ? 1 : 0;
      const bp = b.profiles?.subscription_tier === "pro" ? 1 : 0;
      if (ap !== bp) return bp - ap;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
    setItems(list);
    setLoading(false);
  };

  useEffect(() => {
    (async () => {
      const { user, role } = await getCurrentUserAndRole();
      if (!user) {
        navigate({ to: "/auth" });
        return;
      }
      setRole(role);
      setEmail(user.email ?? null);
      setUserId(user.id);
      load();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    setSaving(true);
    const { error } = await supabase.from("farmer_products").insert({
      farmer_id: userId,
      title,
      description: desc || null,
      category,
      price: Number(price) || 0,
      unit,
      quantity_available: Number(qty) || 0,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Product listed");
    setTitle(""); setDesc(""); setPrice(""); setQty(""); setUnit("kg"); setCategory("crops");
    setOpen(false);
    load();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("farmer_products").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Removed");
    load();
  };

  const visible = filter === "all" ? items : items.filter((i) => i.category === filter);

  return (
    <div className="min-h-screen bg-background">
      <AppHeader role={role} email={email} />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-4 flex items-center justify-between gap-2">
          <BackButton to="/dashboard" />
          {role === "farmer" && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="mr-1 h-4 w-4" /> List a product
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>List a product</DialogTitle>
                </DialogHeader>
                <form onSubmit={create} className="space-y-3">
                  <div>
                    <Label htmlFor="t">Product name</Label>
                    <Input id="t" value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="Fresh eggs (tray)" />
                  </div>
                  <div>
                    <Label htmlFor="d">Description</Label>
                    <Textarea id="d" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Free range, harvested today" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Category</Label>
                      <Select value={category} onValueChange={(v) => setCategory(v as Category)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {CATEGORIES.map((c) => (
                            <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="u">Unit</Label>
                      <Input id="u" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="kg, tray, litre" />
                    </div>
                    <div>
                      <Label htmlFor="p">Price (UGX)</Label>
                      <Input id="p" type="number" value={price} onChange={(e) => setPrice(e.target.value)} required min="0" />
                    </div>
                    <div>
                      <Label htmlFor="q">Quantity available</Label>
                      <Input id="q" type="number" value={qty} onChange={(e) => setQty(e.target.value)} required min="0" />
                    </div>
                  </div>
                  <Button type="submit" className="w-full" disabled={saving}>
                    {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Publish listing
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Farmer Marketplace</h1>
          <p className="text-muted-foreground">
            Buy fresh produce direct from Ugandan farmers.{" "}
            <Link to="/pricing" className="text-primary underline-offset-2 hover:underline">
              Go Pro
            </Link>{" "}
            to promote your listings.
          </p>
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          <button
            onClick={() => setFilter("all")}
            className={`rounded-full border px-3 py-1 text-xs ${filter === "all" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}
          >
            All
          </button>
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setFilter(c)}
              className={`rounded-full border px-3 py-1 text-xs capitalize ${filter === c ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}
            >
              {c}
            </button>
          ))}
        </div>

        {loading ? (
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        ) : visible.length === 0 ? (
          <Card className="flex flex-col items-center p-10 text-center">
            <Package className="h-10 w-10 text-muted-foreground" />
            <h2 className="mt-3 font-semibold">No products yet</h2>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              {role === "farmer" ? "Be the first to list — click 'List a product' above." : "Check back soon — farmers are listing produce."}
            </p>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((p) => {
              const isPro = p.profiles?.subscription_tier === "pro";
              const mine = p.farmer_id === userId;
              return (
                <Card key={p.id} className={`relative p-4 ${isPro ? "border-primary/40 ring-1 ring-primary/20" : ""}`}>
                  {isPro && (
                    <Badge className="absolute right-3 top-3 bg-primary text-primary-foreground">
                      <Sparkles className="mr-1 h-3 w-3" /> Sponsored
                    </Badge>
                  )}
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">{p.category}</div>
                  <div className="mt-1 font-semibold leading-tight">{p.title}</div>
                  {p.description && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{p.description}</p>}
                  <div className="mt-3 flex items-end justify-between">
                    <div>
                      <div className="text-base font-bold">UGX {Number(p.price).toLocaleString()}<span className="ml-1 text-xs font-normal text-muted-foreground">/{p.unit}</span></div>
                      <div className="text-[11px] text-muted-foreground">{p.quantity_available} available</div>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-1 text-xs font-medium">
                        {isPro && <Crown className="h-3 w-3 text-primary" />}
                        {p.profiles?.full_name || "Farmer"}
                      </div>
                      {p.profiles?.location_label && (
                        <div className="text-[10px] text-muted-foreground">{p.profiles.location_label}</div>
                      )}
                    </div>
                  </div>
                  {mine && (
                    <Button size="sm" variant="ghost" className="mt-3 w-full text-destructive" onClick={() => remove(p.id)}>
                      <Trash2 className="mr-1 h-3 w-3" /> Remove listing
                    </Button>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
