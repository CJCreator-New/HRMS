"use server";

import { createClient } from "@/lib/supabase/server";
import { assertPermission } from "@/lib/auth/assertPermission";
import { validateRequestOrigin, sanitizeInput } from "@/lib/security";

export async function saveStatutoryProfileAction(
  profileId: string,
  panNumber: string,
  uanNumber: string,
  ptState: string,
  taxRegime: "new_regime" | "old_regime",
  pfApplicable: boolean,
  esiApplicable: boolean
): Promise<{ success: boolean; error?: string; profile?: any }> {
  const csrfError = await validateRequestOrigin();
  if (csrfError) return { success: false, error: csrfError.error };

  panNumber = sanitizeInput(panNumber);
  uanNumber = sanitizeInput(uanNumber);
  ptState = sanitizeInput(ptState);

  const permError = await assertPermission("statutory.edit");
  if (permError) return { success: false, error: permError.error };

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("statutory_profiles")
    .update({
      pan_number: panNumber,
      uan_number: uanNumber,
      pt_state: ptState,
      tax_regime: taxRegime,
      pf_applicable: pfApplicable,
      esi_applicable: esiApplicable,
    })
    .eq("id", profileId)
    .select()
    .single();

  if (error) return { success: false, error: error.message };
  return { success: true, profile: data };
}
