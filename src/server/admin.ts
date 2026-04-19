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


