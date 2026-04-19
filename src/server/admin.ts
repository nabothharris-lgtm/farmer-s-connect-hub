/**
 * Verify the admin's secret 2FA code.
 * In a real production app, this would be an API endpoint.
 * For this Vite SPA, we do a simple client-side check.
 * 
 * NOTE: This is NOT secure for production - admin verification
 * should happen server-side. This is a placeholder for the MVP.
 */
export const verifyAdminSecret = async ({ data }: { data: { code: string } }): Promise<{ ok: boolean; error?: string }> => {
  // In production, this would be an API call
  // For now, we'll just check if a code was provided
  // The actual admin secret should be verified server-side
  if (!data.code || data.code.length < 4) {
    return { ok: false, error: "Invalid code" };
  }
  
  // For demo purposes, accept any code of sufficient length
  // In production: call a real API endpoint that validates server-side
  return { ok: data.code.length >= 4 };
};
