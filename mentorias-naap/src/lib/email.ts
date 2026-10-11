import "server-only";
import { brand, siteUrl } from "@/lib/config";

function escapeHtml(text: string) {
  return text.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}

function layout(title: string, body: string, cta?: { label: string; href: string }) {
  const button = cta
    ? `<p style="margin:28px 0"><a href="${cta.href}" style="background:#0c7483;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:600">${escapeHtml(cta.label)}</a></p>`
    : "";
  return `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#1c3238">
  <h2 style="color:#0c7483">${escapeHtml(title)}</h2>
  ${body}
  ${button}
  <hr style="border:none;border-top:1px solid #d5e7eb;margin:28px 0" />
  <p style="font-size:12px;color:#5d7177">${escapeHtml(brand.name)} · ${escapeHtml(brand.email)} · ${escapeHtml(brand.phone)}</p>
</div>`;
}

/**
 * Envia e-mail por API HTTPS (funciona na Cloudflare, que não abre conexões SMTP):
 * - BREVO_API_KEY definido: envia pelo Brevo (produção; plano grátis de 300/dia);
 * - MAILPIT_URL definido: entrega na caixa de teste local do Supabase;
 * - nenhum dos dois: só registra no log.
 */
async function send(to: string, subject: string, html: string) {
  const fromName = process.env.EMAIL_FROM_NAME || "Mentorias NAAP";
  const fromEmail = process.env.EMAIL_FROM_ADDRESS;
  try {
    let res: Response;
    if (process.env.BREVO_API_KEY && fromEmail) {
      res = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: { "api-key": process.env.BREVO_API_KEY, "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ sender: { name: fromName, email: fromEmail }, to: [{ email: to }], subject, htmlContent: html }),
      });
    } else if (process.env.MAILPIT_URL) {
      res = await fetch(`${process.env.MAILPIT_URL.replace(/\/$/, "")}/api/v1/send`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ From: { Email: fromEmail || "mentorias@naap.local", Name: fromName }, To: [{ Email: to }], Subject: subject, HTML: html }),
      });
    } else {
      console.warn(`[email] envio não configurado; e-mail não enviado para ${to}: ${subject}`);
      return false;
    }
    if (!res.ok) {
      console.error(`[email] falha ao enviar para ${to}: ${res.status} ${await res.text()}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error(`[email] falha ao enviar para ${to}`, err);
    return false;
  }
}

export function sendApprovedEmail(to: string, name: string) {
  return send(
    to,
    "Seu acesso às Mentorias NAAP foi aprovado",
    layout(
      `Olá, ${name || "aluno(a)"}!`,
      `<p>Seu cadastro foi aprovado. Você já pode entrar na plataforma e assistir às mentorias dos módulos que adquiriu.</p>`,
      { label: "Acessar as mentorias", href: siteUrl("/mentorias") },
    ),
  );
}

export function sendNewVideoEmail(to: string, name: string, moduleTitle: string, videoTitle: string, videoId: string) {
  return send(
    to,
    `Nova mentoria disponível: ${videoTitle}`,
    layout(
      `Olá, ${name || "aluno(a)"}!`,
      `<p>Uma nova gravação foi publicada no módulo <strong>${escapeHtml(moduleTitle)}</strong>:</p>
       <p style="font-size:16px"><strong>${escapeHtml(videoTitle)}</strong></p>`,
      { label: "Assistir agora", href: siteUrl(`/assistir/${videoId}`) },
    ),
  );
}

export function sendNewSignupEmail(name: string, email: string) {
  const to = process.env.ADMIN_NOTIFY_EMAIL;
  if (!to) return Promise.resolve(false);
  return send(
    to,
    `Novo cadastro aguardando aprovação: ${name}`,
    layout(
      "Novo cadastro",
      `<p><strong>${escapeHtml(name)}</strong> (${escapeHtml(email)}) se cadastrou e aguarda aprovação.</p>`,
      { label: "Revisar cadastros", href: siteUrl("/admin/alunos?status=pending") },
    ),
  );
}
