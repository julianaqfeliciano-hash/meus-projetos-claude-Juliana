"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ActionState } from "@/lib/action-state";

export async function updateProfile(_: ActionState, form: FormData): Promise<ActionState> {
  const { profile } = await requireUser();
  const fullName = String(form.get("full_name") ?? "").trim();
  const phone = String(form.get("phone") ?? "").trim();
  if (fullName.length < 3) return { error: "Informe seu nome completo." };
  if (phone.replace(/\D/g, "").length < 10) return { error: "Informe um telefone com DDD." };

  const { error } = await createAdminClient()
    .from("profiles")
    .update({ full_name: fullName, phone })
    .eq("id", profile.id);
  if (error) return { error: "Não foi possível salvar. Tente novamente." };
  revalidatePath("/conta");
  return { success: "Dados atualizados." };
}
