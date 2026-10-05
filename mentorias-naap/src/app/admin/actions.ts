"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendApprovedEmail, sendNewVideoEmail } from "@/lib/email";
import { parseYouTubeId } from "@/lib/format";
import type { ActionState } from "@/lib/action-state";
import type { ProfileStatus } from "@/lib/types";

const str = (form: FormData, key: string) => String(form.get(key) ?? "").trim();

// ---------------------------------------------------------------------------
// Alunos
// ---------------------------------------------------------------------------
export async function setStudentStatus(studentId: string, status: ProfileStatus) {
  await requireAdmin();
  const db = createAdminClient();
  const { data: before } = await db.from("profiles").select("status, approved_at, email, full_name").eq("id", studentId).single();
  if (!before) return;

  await db
    .from("profiles")
    .update({
      status,
      approved_at: status === "approved" ? before.approved_at ?? new Date().toISOString() : before.approved_at,
      // Ao bloquear, derruba a sessão atual do aluno.
      ...(status === "blocked" ? { active_session_id: null } : {}),
    })
    .eq("id", studentId);

  if (status === "blocked") await db.auth.admin.signOut(studentId).catch(() => undefined);
  if (status === "approved" && before.status !== "approved") {
    await sendApprovedEmail(before.email, before.full_name);
  }
  revalidatePath("/admin", "layout");
}

export async function grantAccess(studentId: string, moduleId: string) {
  await requireAdmin();
  await createAdminClient()
    .from("module_access")
    .upsert({ student_id: studentId, module_id: moduleId }, { onConflict: "student_id,module_id", ignoreDuplicates: true });
  revalidatePath(`/admin/alunos/${studentId}`);
}

export async function revokeAccess(studentId: string, moduleId: string) {
  await requireAdmin();
  await createAdminClient().from("module_access").delete().eq("student_id", studentId).eq("module_id", moduleId);
  revalidatePath(`/admin/alunos/${studentId}`);
}

// ---------------------------------------------------------------------------
// Vendas presenciais
// ---------------------------------------------------------------------------
export async function registerSale(_: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  const studentId = str(form, "student_id");
  const moduleIds = form.getAll("module_ids").map(String).filter(Boolean);
  const amount = Number(str(form, "amount").replace(",", "."));
  const soldOn = str(form, "sold_on") || new Date().toISOString().slice(0, 10);

  if (!studentId) return { error: "Selecione o aluno." };
  if (moduleIds.length === 0) return { error: "Selecione pelo menos um módulo." };
  if (!Number.isFinite(amount) || amount < 0) return { error: "Informe um valor válido." };

  const db = createAdminClient();
  const { data: sale, error } = await db
    .from("sales")
    .insert({
      student_id: studentId,
      sold_on: soldOn,
      amount_cents: Math.round(amount * 100),
      payment_method: str(form, "payment_method") || "pix",
      notes: str(form, "notes"),
    })
    .select("id")
    .single();
  if (error || !sale) return { error: "Não foi possível registrar a venda." };

  await db
    .from("module_access")
    .upsert(
      moduleIds.map((moduleId) => ({ student_id: studentId, module_id: moduleId, sale_id: sale.id })),
      { onConflict: "student_id,module_id" },
    );

  if (form.get("approve") === "on") await setStudentStatus(studentId, "approved");

  revalidatePath("/admin", "layout");
  return { success: "Venda registrada e módulos liberados." };
}

export async function deleteSale(saleId: string) {
  await requireAdmin();
  // O acesso já liberado é mantido; use "remover acesso" na ficha do aluno se necessário.
  await createAdminClient().from("sales").delete().eq("id", saleId);
  revalidatePath("/admin", "layout");
}

// ---------------------------------------------------------------------------
// Módulos
// ---------------------------------------------------------------------------
export async function saveModule(_: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  const id = str(form, "id");
  const title = str(form, "title");
  if (!title) return { error: "Informe o título do módulo." };
  const values = {
    title,
    description: str(form, "description"),
    position: Number(str(form, "position") || 0),
    published: form.get("published") === "on",
  };

  const db = createAdminClient();
  if (id) {
    const { error } = await db.from("modules").update(values).eq("id", id);
    if (error) return { error: "Não foi possível salvar o módulo." };
    revalidatePath("/admin", "layout");
    return { success: "Módulo salvo." };
  }
  const { data, error } = await db.from("modules").insert(values).select("id").single();
  if (error || !data) return { error: "Não foi possível criar o módulo." };
  revalidatePath("/admin", "layout");
  redirect(`/admin/modulos/${data.id}`);
}

export async function deleteModule(moduleId: string) {
  await requireAdmin();
  const db = createAdminClient();
  const { data: videos } = await db.from("videos").select("pdf_path").eq("module_id", moduleId);
  const paths = (videos ?? []).map((v) => v.pdf_path).filter((p): p is string => Boolean(p));
  if (paths.length) await db.storage.from("materiais").remove(paths);
  await db.from("modules").delete().eq("id", moduleId);
  revalidatePath("/admin", "layout");
  redirect("/admin/modulos");
}

// ---------------------------------------------------------------------------
// Vídeos
// ---------------------------------------------------------------------------
export async function saveVideo(_: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  const id = str(form, "id");
  const moduleId = str(form, "module_id");
  const title = str(form, "title");
  const youtubeId = parseYouTubeId(str(form, "youtube"));
  if (!title) return { error: "Informe o título do vídeo." };
  if (!youtubeId) return { error: "Link do YouTube inválido. Cole o link do vídeo não listado." };

  const duration = Number(str(form, "duration_minutes"));
  const values = {
    module_id: moduleId,
    title,
    description: str(form, "description"),
    youtube_id: youtubeId,
    recorded_on: str(form, "recorded_on") || null,
    duration_minutes: Number.isFinite(duration) && duration > 0 ? Math.round(duration) : null,
    position: Number(str(form, "position") || 0),
    published: form.get("published") === "on",
  };

  const db = createAdminClient();
  const query = id
    ? db.from("videos").update(values).eq("id", id).select("id").single()
    : db.from("videos").insert(values).select("id").single();
  const { data, error } = await query;
  if (error || !data) return { error: "Não foi possível salvar o vídeo." };

  let notified = 0;
  if (values.published && form.get("notify") === "on") {
    notified = await notifyNewVideo(data.id);
  }

  revalidatePath("/admin", "layout");
  return {
    success: notified
      ? `Vídeo salvo. Aviso enviado por e-mail para ${notified} aluno(s).`
      : "Vídeo salvo.",
  };
}

/** Envia o aviso de vídeo novo uma única vez para cada vídeo. */
async function notifyNewVideo(videoId: string) {
  const db = createAdminClient();
  const { data: video } = await db
    .from("videos")
    .select("id, title, module_id, notified_at, modules(title, published)")
    .eq("id", videoId)
    .single<{ id: string; title: string; module_id: string; notified_at: string | null; modules: { title: string; published: boolean } }>();
  if (!video || video.notified_at || !video.modules?.published) return 0;

  const { data: students } = await db
    .from("module_access")
    .select("profiles!inner(email, full_name, status)")
    .eq("module_id", video.module_id)
    .eq("profiles.status", "approved")
    .returns<{ profiles: { email: string; full_name: string; status: string } }[]>();

  await db.from("videos").update({ notified_at: new Date().toISOString() }).eq("id", videoId);

  let sent = 0;
  for (const row of students ?? []) {
    if (await sendNewVideoEmail(row.profiles.email, row.profiles.full_name, video.modules.title, video.title, video.id)) sent++;
  }
  return sent;
}

export async function deleteVideo(videoId: string, moduleId: string) {
  await requireAdmin();
  const db = createAdminClient();
  const { data: video } = await db.from("videos").select("pdf_path").eq("id", videoId).single();
  if (video?.pdf_path) await db.storage.from("materiais").remove([video.pdf_path]);
  await db.from("videos").delete().eq("id", videoId);
  revalidatePath("/admin", "layout");
  redirect(`/admin/modulos/${moduleId}`);
}

/** Chamado depois que o navegador enviou o PDF direto para o armazenamento. */
export async function setVideoPdf(videoId: string, path: string | null, name: string | null) {
  await requireAdmin();
  const db = createAdminClient();
  const { data: video } = await db.from("videos").select("pdf_path").eq("id", videoId).single();
  if (video?.pdf_path && video.pdf_path !== path) {
    await db.storage.from("materiais").remove([video.pdf_path]);
  }
  await db.from("videos").update({ pdf_path: path, pdf_name: name }).eq("id", videoId);
  revalidatePath("/admin", "layout");
}
