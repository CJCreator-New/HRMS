import { createClient } from "@/lib/supabase/server";

export interface IdempotencyResult {
  isDuplicate: boolean;
  error?: string;
}

/**
 * Registers an idempotency key under a specific scope in PostgreSQL.
 * Returns { isDuplicate: true, error: "..." } if the key was already registered under the scope.
 */
export async function assertIdempotencyKey(
  idempotencyKey?: string | null,
  scope: string = "default"
): Promise<IdempotencyResult> {
  if (!idempotencyKey || !idempotencyKey.trim()) {
    return { isDuplicate: false };
  }

  const cleanKey = idempotencyKey.trim();
  const cleanScope = scope.trim();

  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("register_idempotency_key", {
      p_key: cleanKey,
      p_scope: cleanScope,
    });

    if (error) {
      if (error.message.includes("Duplicate request") || error.code === "23505") {
        return {
          isDuplicate: true,
          error: `Duplicate request detected for idempotency key '${cleanKey}' under scope '${cleanScope}'.`,
        };
      }
      // If RPC is unavailable (e.g. in certain mock tests), attempt direct table insert
      const { error: insertError } = await supabase
        .from("system_idempotency_keys")
        .insert({ idempotency_key: cleanKey, scope: cleanScope });

      if (insertError) {
        return {
          isDuplicate: true,
          error: `Duplicate request detected for idempotency key '${cleanKey}' under scope '${cleanScope}'.`,
        };
      }
    }

    return { isDuplicate: false };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("Duplicate") || message.includes("duplicate")) {
      return { isDuplicate: true, error: message };
    }
    return { isDuplicate: false };
  }
}
