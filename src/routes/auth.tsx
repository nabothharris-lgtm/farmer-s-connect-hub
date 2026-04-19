import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Sprout, MapPin, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import type { AppRole } from "@/lib/auth";

type FarmerSpecialty = "poultry" | "crops" | "dairy" | "fish" | "mixed" | "other";

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
  { value: "farmer", label: "Farmer", desc: "I grow crops or livestock" },
  { value: "expert", label: "Expert", desc: "I provide farm services" },
  { value: "store", label: "Agro Store", desc: "I sell farm inputs" },
  { value: "agent", label: "Field Agent", desc: "I onboard farmers" },
];

function AuthPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  // signup state
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<AppRole>("farmer");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [specialty, setSpecialty] = useState<FarmerSpecialty | "">("");

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
    try {
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

      // Insert role
      const { error: roleErr } = await supabase
        .from("user_roles")
        .insert({ user_id: data.user.id, role });
      if (roleErr) throw roleErr;

      // Update profile (location, name, phone, optional farmer specialty)
      const profileUpdate: {
        full_name: string;
        phone: string;
        location_lat?: number;
        location_lng?: number;
        farmer_specialty?: FarmerSpecialty;
      } = {
        full_name: fullName,
        phone,
      };
      if (coords) {
        profileUpdate.location_lat = coords.lat;
        profileUpdate.location_lng = coords.lng;
      }
      if (role === "farmer" && specialty) {
        profileUpdate.farmer_specialty = specialty;
      }
      await supabase.from("profiles").update(profileUpdate).eq("id", data.user.id);

      // If expert, seed expert_profiles row
      if (role === "expert") {
        await supabase.from("expert_profiles").insert({
          id: data.user.id,
          specialty: "General agronomy",
          bio: "",
          hourly_rate: 0,
          years_experience: 0,
        });
      }

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
      const { error } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: loginPassword,
      });
      if (error) throw error;
      navigate({ to: "/dashboard" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Login failed";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex max-w-md flex-col items-center px-4 py-10">
        <Link to="/" className="mb-6 flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Sprout className="h-5 w-5" />
          </div>
          <span className="text-lg font-semibold">AgriConnect</span>
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
                    <Label>What do you farm? <span className="text-xs text-muted-foreground">(optional — unlocks the marketplace)</span></Label>
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
              <form onSubmit={handleLogin} className="space-y-3">
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
  );
}
