import "server-only";
import nodemailer from "nodemailer";
import { brand, siteUrl } from "@/lib/config";

function transporter() {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER) return null;
  const port = Number(process.env.SMTP_PORT || 465);
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

function escapeHtml(text: string) {
  return text.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}

function layout(title: string, body: string, cta?: { label: string; href: string }) {
  const button = cta
    ? `<p style="margin:28px 0"><a href="${cta.href}" style="background:#2f5d62;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:600">${escapeHtml(cta.label)}</a></p>`
    : "";
  return `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#1d2b2d">
  <h2 style="color:#2f5d62">${escapeHtml(title)}</h2>
  ${body}
  ${button}
  <hr style="border:none;border-top:1px solid #d9e3e2;margin:28px 0" />
  <p style="font-size:12px;color:#5f6f71">${escapeHtml(brand.name)} · ${escapeHtml(brand.email)} · ${escapeHtml(brand.phone)}</p>
</div>`;
}

async function send(to: string, subject: string, html: string) {
  const t = transporter();
  if (!t) {
    console.warn(`[email] SMTP não configurado; e-mail não enviado para ${to}: ${subject}`);
    return false;
  }
  try {
    await t.sendMail({ from: process.env.EMAIL_FROM || process.env.SMTP_USER, to, subject, html });
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
