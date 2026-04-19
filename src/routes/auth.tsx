import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Sprout, MapPin, Loader2, ShieldCheck, Sparkles, Upload, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { BackButton } from "@/components/BackButton";
import { verifyAdminSecret } from "@/server/admin";
import type { AppRole } from "@/lib/auth";

type FarmerSpecialty = "poultry" | "crops" | "dairy" | "fish" | "mixed" | "other";
type FarmerSignupMode = "direct" | "agent";
type DocType = "national_id" | "license" | "certificate";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in or join — AgriConnect" },
      { name: "description", content: "Sign in or create your AgriConnect account." },
    ],
  }),
  component: AuthPage,
});

const roles: { value: AppRole; label: string; desc: string }[] = [
  { value: "farmer", label: "Farmer",     desc: "I grow crops or livestock" },
  { value: "expert", label: "Expert",     desc: "I provide farm services" },
  { value: "store",  label: "Agro Store", desc: "I sell farm inputs" },
  { value: "agent",  label: "Field Agent",desc: "I onboard farmers" },
];

function AuthPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [adminCodeOpen, setAdminCodeOpen] = useState(false);
  const [adminCode, setAdminCode] = useState("");
  const [adminPendingUserId, setAdminPendingUserId] = useState<string | null>(null);

  // signup state
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<AppRole>("farmer");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [specialty, setSpecialty] = useState<FarmerSpecialty | "">("");

  // Farmer-specific
  const [farmerMode, setFarmerMode] = useState<FarmerSignupMode>("direct");
  const [agentCode, setAgentCode] = useState("");

  // Expert / store docs (collected after signup, uploaded to storage)
  const [docs, setDocs] = useState<Record<DocType, File | null>>({
    national_id: null,
    license: null,
    certificate: null,
  });

  // login state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard" });
    });
  }, [navigate]);

  const captureLocation = () => {
    if (!navigator.geolocation) return toast.error("Geolocation not supported");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        toast.success("Location captured");
      },
      () => toast.error("Could not get location"),
    );
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    let referringAgentId: string | null = null;

    try {
      // 1. Validate agent code BEFORE creating the account
      if (role === "farmer" && farmerMode === "agent") {
        const code = agentCode.trim().toUpperCase();
        if (!code) throw new Error("Please enter the field agent's ID");
        const { data: match, error: rpcErr } = await supabase.rpc("find_agent_by_code", { _code: code });
        if (rpcErr) throw rpcErr;
        if (!match || match.length === 0) throw new Error("Agent ID not found. Please double-check with your field agent.");
        referringAgentId = match[0].agent_id;
      }

      // 2. Create the user
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard`,
          data: { full_name: fullName, phone },
        },
      });
      if (error) throw error;
      if (!data.user) throw new Error("Signup failed");
      const newUserId = data.user.id;

      // 3. Insert role
      const { error: roleErr } = await supabase
        .from("user_roles")
        .insert({ user_id: newUserId, role });
      if (roleErr) throw roleErr;

      // 4. Update profile
      const profileUpdate: {
        full_name: string;
        phone: string;
        location_lat?: number;
        location_lng?: number;
        farmer_specialty?: FarmerSpecialty;
        referred_by_agent?: string;
        verification_status?: "unsubmitted" | "pending" | "approved" | "rejected";
      } = { full_name: fullName, phone };
      if (coords) {
        profileUpdate.location_lat = coords.lat;
        profileUpdate.location_lng = coords.lng;
      }
      if (role === "farmer" && specialty) profileUpdate.farmer_specialty = specialty;
      if (referringAgentId) profileUpdate.referred_by_agent = referringAgentId;
      const hasAnyDoc = !!(docs.national_id || docs.license || docs.certificate);
      if ((role === "expert" || role === "store") && hasAnyDoc) {
        profileUpdate.verification_status = "pending";
      }
      await supabase.from("profiles").update(profileUpdate).eq("id", newUserId);

      // 5. Expert seed
      if (role === "expert") {
        await supabase.from("expert_profiles").insert({
          id: newUserId,
          specialty: "General agronomy",
          bio: "",
          hourly_rate: 0,
          years_experience: 0,
        });
      }

      // 6. Upload verification docs (expert/store)
      if (role === "expert" || role === "store") {
        for (const [k, file] of Object.entries(docs) as Array<[DocType, File | null]>) {
          if (!file) continue;
          const path = `${newUserId}/${k}-${Date.now()}-${file.name}`;
          const { error: upErr } = await supabase.storage.from("verification-docs").upload(path, file);
          if (upErr) {
            toast.error(`Could not upload ${k}: ${upErr.message}`);
            continue;
          }
          await supabase.from("verification_documents").insert({
            user_id: newUserId,
            doc_type: k,
            file_url: path,
          });
        }
      }

      // 7. Agent commission for signup-via-agent
      if (referringAgentId) {
        await supabase.from("agent_earnings").insert({
          agent_id: referringAgentId,
          farmer_id: newUserId,
          source: "signup",
          amount: 5000,
        });
        // notify the agent (the agent may not be logged in — RLS now allows admin or the user themselves;
        // we are signed in as the new farmer, so we can only insert notif for ourselves. Skip notifying agent here;
        // agent's earning row will surface in their dashboard.)
      }

      // Welcome notification for the new user
      await supabase.from("notifications").insert({
        user_id: newUserId,
        kind: "system",
        title: `Welcome to AgriConnect, ${fullName.split(" ")[0]}!`,
        body:
          role === "expert" || role === "store"
            ? "Your account is created. Verification documents are under review."
            : "You're all set. Explore experts, marketplace, and more.",
      });

      toast.success("Account created");
      navigate({ to: "/dashboard" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Signup failed";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: loginPassword,
      });
      if (error) throw error;
      if (!data.user) throw new Error("Login failed");

      // Check if admin — if yes, require secret code before dashboard
      const { data: roleRows } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", data.user.id);
      const isAdmin = (roleRows ?? []).some((r) => r.role === "admin");
      if (isAdmin) {
        setAdminPendingUserId(data.user.id);
        setAdminCodeOpen(true);
        setLoading(false);
        return;
      }

      navigate({ to: "/dashboard" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Login failed";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const submitAdminCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await verifyAdminSecret({ data: { code: adminCode.trim() } });
      if (!res.ok) {
        toast.error("Invalid admin secret code");
        // sign them out so a wrong code doesn't grant admin session
        await supabase.auth.signOut();
        setAdminPendingUserId(null);
        setAdminCodeOpen(false);
        setAdminCode("");
        return;
      }
      navigate({ to: "/admin" });
    } catch {
      toast.error("Could not verify code");
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="min-h-screen bg-background lg:grid lg:grid-cols-2">
      {/* Aside - Left Side */}
      <div className="hidden flex-col justify-between bg-primary p-10 text-primary-foreground lg:flex">
        <div>
          <Link to="/" className="mb-8 flex items-center gap-2">
            <div className="flex h-10 w-10 overflow-hidden rounded-lg bg-white/10 p-1">
              <img src="/favicon.ico" alt="AgriConnect Logo" className="h-full w-full object-contain" />
            </div>
            <span className="text-xl font-bold">AgriConnect</span>
          </Link>
          <h1 className="mt-12 text-4xl font-bold leading-tight">
            Grow more, with the right people beside you.
          </h1>
          <p className="mt-6 max-w-md text-lg text-primary-foreground/80">
            Join thousands of Ugandan farmers, verified experts, and agro-stores building a stronger, more transparent agricultural ecosystem.
          </p>
        </div>

        <div className="mt-auto space-y-6 pb-12">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10">
              <ShieldCheck className="h-6 w-6 text-white" />
            </div>
            <div>
              <div className="font-semibold text-lg">Verified Ecosystem</div>
              <div className="text-sm text-primary-foreground/80">Every expert and store is thoroughly vetted.</div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10">
              <MapPin className="h-6 w-6 text-white" />
            </div>
            <div>
              <div className="font-semibold text-lg">Local Focus</div>
              <div className="text-sm text-primary-foreground/80">Find partners right in your district.</div>
            </div>
          </div>
        </div>
      </div>

      {/* Auth Form - Right Side */}
      <div className="flex flex-col px-4 py-6 lg:h-screen lg:overflow-y-auto lg:p-12">
        <div className="mx-auto w-full max-w-md">
          <div className="mb-6 w-full">
            <BackButton to="/" label="Back to home" />
          </div>

          <Link to="/" className="mb-6 flex items-center gap-2 lg:hidden">
            <div className="flex h-10 w-10 overflow-hidden rounded-lg bg-primary/10 p-1">
              <img src="/favicon.ico" alt="AgriConnect Logo" className="h-full w-full object-contain" />
            </div>
            <span className="text-xl font-bold text-foreground">AgriConnect</span>
          </Link>

          <Card className="w-full p-6">
          <Tabs defaultValue="signup">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signup">Create account</TabsTrigger>
              <TabsTrigger value="login">Sign in</TabsTrigger>
            </TabsList>

            <TabsContent value="signup" className="mt-5">
              <form onSubmit={handleSignup} className="space-y-3">
                <div>
                  <Label className="mb-2 block">I am a…</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {roles.map((r) => (
                      <button
                        key={r.value}
                        type="button"
                        onClick={() => setRole(r.value)}
                        className={`rounded-lg border p-3 text-left text-sm transition ${
                          role === r.value
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/50"
                        }`}
                      >
                        <div className="font-semibold">{r.label}</div>
                        <div className="text-xs text-muted-foreground">{r.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Farmer: direct vs via agent */}
                {role === "farmer" && (
                  <div className="rounded-lg border border-border p-3">
                    <Label className="mb-2 block text-xs">How did you hear about us?</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setFarmerMode("direct")}
                        className={`rounded-md border p-2 text-xs transition ${
                          farmerMode === "direct"
                            ? "border-primary bg-primary/5 font-semibold"
                            : "border-border"
                        }`}
                      >
                        Direct sign-up
                      </button>
                      <button
                        type="button"
                        onClick={() => setFarmerMode("agent")}
                        className={`rounded-md border p-2 text-xs transition ${
                          farmerMode === "agent"
                            ? "border-primary bg-primary/5 font-semibold"
                            : "border-border"
                        }`}
                      >
                        Via field agent
                      </button>
                    </div>
                    {farmerMode === "agent" && (
                      <div className="mt-3">
                        <Label htmlFor="agent">Field agent ID</Label>
                        <Input
                          id="agent"
                          placeholder="e.g. AG-A1B2C3"
                          value={agentCode}
                          onChange={(e) => setAgentCode(e.target.value.toUpperCase())}
                          required
                        />
                        <p className="mt-1 text-xs text-muted-foreground">
                          Ask your field agent for their ID. They earn commission on your activity.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                <div>
                  <Label htmlFor="name">Full name</Label>
                  <Input id="name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
                </div>
                <div>
                  <Label htmlFor="phone">Phone</Label>
                  <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} required />
                </div>

                {role === "farmer" && (
                  <div>
                    <Label>What do you farm? <span className="text-xs text-muted-foreground">(optional)</span></Label>
                    <Select value={specialty} onValueChange={(v) => setSpecialty(v as FarmerSpecialty)}>
                      <SelectTrigger><SelectValue placeholder="Select your main produce" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="poultry">Poultry (eggs, chicken)</SelectItem>
                        <SelectItem value="crops">Crops (maize, beans, coffee...)</SelectItem>
                        <SelectItem value="dairy">Dairy (milk, cheese)</SelectItem>
                        <SelectItem value="fish">Fish / aquaculture</SelectItem>
                        <SelectItem value="mixed">Mixed farm</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {(role === "expert" || role === "store") && (
                  <div className="rounded-lg border border-dashed border-primary/40 bg-primary/5 p-3">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <ShieldCheck className="h-4 w-4 text-primary" />
                      Verification documents
                    </div>
                    <p className="mb-2 text-xs text-muted-foreground">
                      Upload your ID and {role === "store" ? "trading licence" : "professional licence"} so admins can verify you. You can use the app immediately — your "Verified" badge appears once approved.
                    </p>
                    <DocPicker label="National ID" value={docs.national_id} onChange={(f) => setDocs((d) => ({ ...d, national_id: f }))} />
                    <DocPicker label={role === "store" ? "Trading licence" : "Professional licence"} value={docs.license} onChange={(f) => setDocs((d) => ({ ...d, license: f }))} />
                    <DocPicker label="Certificate (optional)" value={docs.certificate} onChange={(f) => setDocs((d) => ({ ...d, certificate: f }))} />
                  </div>
                )}

                {role === "agent" && (
                  <div className="rounded-lg border border-dashed border-accent/40 bg-accent/5 p-3 text-xs text-muted-foreground">
                    <Sparkles className="mr-1 inline h-3 w-3 text-accent" />
                    You'll receive your unique <span className="font-semibold text-foreground">Agent ID</span> right after signup. Share it with farmers to earn commission on every transaction.
                  </div>
                )}

                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
                <div>
                  <Label htmlFor="password">Password</Label>
                  <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
                </div>

                <Button type="button" variant="outline" className="w-full" onClick={captureLocation}>
                  <MapPin className="mr-2 h-4 w-4" />
                  {coords ? `Location set (${coords.lat.toFixed(3)}, ${coords.lng.toFixed(3)})` : "Share my location"}
                </Button>

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create account
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="login" className="mt-5">
              <form id="login-form" onSubmit={handleLogin} className="space-y-3">
                <div>
                  <Label htmlFor="lemail">Email</Label>
                  <Input id="lemail" type="email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} required />
                </div>
                <div>
                  <Label htmlFor="lpw">Password</Label>
                  <Input id="lpw" type="password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} required />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Sign in
                </Button>
              </form>

            </TabsContent>
          </Tabs>
        </Card>
        </div>
      </div>

      {/* Admin secret-code modal */}
      {adminCodeOpen && adminPendingUserId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <Card className="w-full max-w-sm p-6">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-primary" />
                <div className="font-semibold">Admin verification</div>
              </div>
              <button
                onClick={async () => {
                  await supabase.auth.signOut();
                  setAdminCodeOpen(false);
                  setAdminCode("");
                  setAdminPendingUserId(null);
                }}
                className="rounded-full p-1 text-muted-foreground hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mb-3 text-xs text-muted-foreground">
              Enter the admin secret code to access the admin panel.
            </p>
            <form onSubmit={submitAdminCode} className="space-y-3">
              <Input
                type="password"
                placeholder="Admin secret code"
                value={adminCode}
                onChange={(e) => setAdminCode(e.target.value)}
                autoFocus
                required
              />
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Verify & enter
              </Button>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}

function DocPicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: File | null;
  onChange: (f: File | null) => void;
}) {
  return (
    <label className="mt-2 flex cursor-pointer items-center justify-between gap-2 rounded-md border border-border bg-background px-3 py-2 text-xs hover:border-primary/50">
      <div className="flex items-center gap-2 truncate">
        <Upload className="h-3.5 w-3.5 text-primary" />
        <span className="truncate">{value ? value.name : label}</span>
      </div>
      {value && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            onChange(null);
          }}
          className="rounded-full p-0.5 text-muted-foreground hover:bg-muted"
        >
          <X className="h-3 w-3" />
        </button>
      )}
      <input
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
      />
    </label>
  );
}
