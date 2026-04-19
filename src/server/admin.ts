import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/**
 * Verify the admin's secret 2FA code (stored in Lovable Cloud secrets).
 * The frontend calls this AFTER the user has entered email + password successfully,
 * and AFTER we've confirmed they have the 'admin' role.
 *
 * Returning a boolean keeps the secret on the server.
 */
export const verifyAdminSecret = createServerFn({ method: "POST" })
  .inputValidator((input: { code: string }) => {
    if (typeof input?.code !== "string") throw new Error("Invalid input");
    if (input.code.length < 4 || input.code.length > 64) throw new Error("Invalid code length");
    return { code: input.code };
  })
  .handler(async ({ data }) => {
    const expected = process.env.ADMIN_SECRET_CODE;
    if (!expected) {
      return { ok: false, error: "Server not configured" };
    }
    // constant-time-ish compare
    if (data.code.length !== expected.length) return { ok: false };
    let diff = 0;
    for (let i = 0; i < expected.length; i++) {
      diff |= data.code.charCodeAt(i) ^ expected.charCodeAt(i);
    }
    return { ok: diff === 0 };
  });

/**
 * Seed demo accounts and sample data so judges can log in instantly.
 * Idempotent — safe to call multiple times.
 *
 * Uses the service role key to:
 *  1. Create auth users (auto-confirmed)
 *  2. Assign roles
 *  3. Update profiles (verified, location, specialty)
 *  4. Seed expert_profiles, farmer_products, bookings, agent_earnings, notifications
 */
export const seedDemoData = createServerFn({ method: "POST" }).handler(async () => {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SERVICE_ROLE) {
    return { ok: false, error: "Server not configured" };
  }

  const admin = createClient<Database>(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const DEMO_PASSWORD = "Demo1234!";
  const accounts: Array<{
    key: "farmer" | "expert" | "store" | "agent" | "admin";
    email: string;
    name: string;
    phone: string;
    role: "farmer" | "expert" | "store" | "agent" | "admin";
    location: { lat: number; lng: number; label: string };
    specialty?: "poultry" | "crops" | "dairy" | "fish" | "mixed" | "other";
    pro?: boolean;
    verified?: boolean;
    expertSpecialty?: string;
  }> = [
    { key: "farmer",  email: "demo.farmer@agriconnect.ug",  name: "Joseph Mukasa",  phone: "+256700000001", role: "farmer", location: { lat: 0.4807, lng: 32.6263, label: "Mukono" }, specialty: "poultry", pro: false },
    { key: "expert",  email: "demo.expert@agriconnect.ug",  name: "Sarah Nakitto",  phone: "+256700000002", role: "expert", location: { lat: 0.4900, lng: 32.6300, label: "Mukono" }, verified: true, pro: true, expertSpecialty: "Poultry health & vaccination" },
    { key: "store",   email: "demo.store@agriconnect.ug",   name: "GreenHarvest Agro Supplies", phone: "+256700000003", role: "store", location: { lat: 0.3476, lng: 32.5825, label: "Kampala" }, verified: true, pro: true },
    { key: "agent",   email: "demo.agent@agriconnect.ug",   name: "Grace Atim",     phone: "+256700000004", role: "agent", location: { lat: 0.3500, lng: 32.5800, label: "Kampala" } },
    { key: "admin",   email: "demo.admin@agriconnect.ug",   name: "AgriConnect Admin", phone: "+256700000099", role: "admin", location: { lat: 0.3163, lng: 32.5822, label: "Kampala" } },
  ];

  // helper: get or create auth user
  const ensureUser = async (email: string, password: string, meta: Record<string, string>) => {
    // try sign-in first to discover existing
    const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    const existing = list?.users?.find((u) => u.email === email);
    if (existing) return existing.id;
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: meta,
    });
    if (error) throw error;
    return data.user!.id;
  };

  const ids: Record<string, string> = {};
  for (const a of accounts) {
    const uid = await ensureUser(a.email, DEMO_PASSWORD, { full_name: a.name, phone: a.phone });
    ids[a.key] = uid;

    // upsert role
    await admin.from("user_roles").upsert(
      { user_id: uid, role: a.role },
      { onConflict: "user_id,role", ignoreDuplicates: true },
    );

    // update profile
    await admin
      .from("profiles")
      .update({
        full_name: a.name,
        phone: a.phone,
        location_lat: a.location.lat,
        location_lng: a.location.lng,
        location_label: a.location.label,
        farmer_specialty: a.specialty ?? null,
        verified: !!a.verified,
        verification_status: a.verified ? "approved" : "unsubmitted",
        subscription_tier: a.pro ? "pro" : "free",
        pro_since: a.pro ? new Date().toISOString() : null,
      })
      .eq("id", uid);
  }

  // expert profile
  await admin.from("expert_profiles").upsert(
    {
      id: ids.expert,
      specialty: "Poultry health & vaccination",
      bio: "10+ years helping smallholder poultry farms in central Uganda. Specialised in vaccination programmes and feed conversion.",
      hourly_rate: 25000,
      years_experience: 10,
      verified: true,
      rating: 4.9,
    },
    { onConflict: "id" },
  );

  // farmer products (so the marketplace looks alive)
  const products = [
    { title: "Fresh tray of eggs (30 pcs)", description: "Free-range, collected daily.", category: "poultry", price: 14000, unit: "tray", quantity_available: 40 },
    { title: "Live broiler chicken 1.8kg",  description: "Healthy, vaccinated.",         category: "poultry", price: 28000, unit: "bird",  quantity_available: 18 },
  ] as const;
  // wipe any prior demo products to keep it clean, then re-insert
  await admin.from("farmer_products").delete().eq("farmer_id", ids.farmer);
  for (const p of products) {
    await admin.from("farmer_products").insert({ farmer_id: ids.farmer, ...p });
  }

  // referral: agent referred farmer
  await admin.from("profiles").update({ referred_by_agent: ids.agent }).eq("id", ids.farmer);

  // agent earnings (signup commission + a booking commission) — wipe & re-seed
  await admin.from("agent_earnings").delete().eq("agent_id", ids.agent);
  await admin.from("agent_earnings").insert([
    { agent_id: ids.agent, farmer_id: ids.farmer, source: "signup",  amount: 5000  },
    { agent_id: ids.agent, farmer_id: ids.farmer, source: "booking", amount: 2500  },
  ]);

  // a sample booking (farmer -> expert), accepted
  // wipe any existing demo bookings
  await admin.from("bookings").delete().eq("farmer_id", ids.farmer).eq("expert_id", ids.expert);
  await admin.from("bookings").insert({
    farmer_id: ids.farmer,
    expert_id: ids.expert,
    scheduled_for: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
    status: "accepted",
    payment_status: "paid",
    price: 25000,
    notes: "Vaccination round for 200 layers",
  });

  // notifications (one per role) — keep it short, dedupe by deleting recent demo ones
  const seedNotifs: Array<{ user_id: string; kind: "weather" | "earning" | "booking" | "system" | "market"; title: string; body: string }> = [
    { user_id: ids.farmer, kind: "weather", title: "Rain expected tomorrow in Mukono", body: "Light showers from 14:00. Cover young birds and check drainage." },
    { user_id: ids.farmer, kind: "market",  title: "Egg prices up 8% this week",       body: "Average tray price in Kampala is now UGX 14,000." },
    { user_id: ids.expert, kind: "booking", title: "New booking accepted",             body: "Joseph Mukasa booked you for a vaccination round." },
    { user_id: ids.agent,  kind: "earning", title: "You earned UGX 2,500 today",       body: "Commission from Joseph Mukasa's booking." },
    { user_id: ids.store,  kind: "system",  title: "Welcome to AgriConnect",           body: "Your store is verified — start listing inputs." },
    { user_id: ids.admin,  kind: "system",  title: "1 verification waiting",           body: "Review pending experts and stores in the admin panel." },
  ];
  for (const n of seedNotifs) {
    // dedupe by title
    const { data: dup } = await admin.from("notifications").select("id").eq("user_id", n.user_id).eq("title", n.title).limit(1);
    if (!dup || dup.length === 0) await admin.from("notifications").insert(n);
  }

  return { ok: true, accounts: accounts.map((a) => ({ key: a.key, email: a.email })), password: DEMO_PASSWORD };
});
