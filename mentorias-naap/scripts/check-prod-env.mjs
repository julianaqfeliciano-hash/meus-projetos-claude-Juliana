// Confere o .env.production.local antes de publicar na Cloudflare.
// O build embute os valores dos arquivos .env no site; sem esta checagem, uma
// variável esquecida cairia no .env.local da demonstração (banco 127.0.0.1).
import { existsSync, readFileSync } from "node:fs";

const FILE = ".env.production.local";
const REQUIRED = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "NEXT_PUBLIC_SITE_URL",
  "NEXT_PUBLIC_NAAP_NAME",
  "NEXT_PUBLIC_NAAP_EMAIL",
  "NEXT_PUBLIC_NAAP_PHONE",
  "BREVO_API_KEY",
  "EMAIL_FROM_NAME",
  "EMAIL_FROM_ADDRESS",
  "ADMIN_NOTIFY_EMAIL",
];

if (!existsSync(FILE)) {
  console.error(`✖ Falta o arquivo ${FILE}. Copie o .env.example com esse nome e preencha com os dados reais.`);
  process.exit(1);
}
const env = Object.fromEntries(
  readFileSync(FILE, "utf8")
    .split(/\r?\n/)
    .map((l) => l.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*"?(.*?)"?\s*$/))
    .filter(Boolean)
    .map((m) => [m[1], m[2]]),
);
const problems = [];
for (const key of REQUIRED) {
  const value = env[key];
  if (!value) problems.push(`${key} está vazio`);
  else if (/x{6,}|sua-chave|seu-email|\.\.\.$/i.test(value)) problems.push(`${key} ainda tem o valor de exemplo`);
}
for (const key of ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SITE_URL"]) {
  if (/127\.0\.0\.1|localhost/.test(env[key] ?? "")) problems.push(`${key} aponta para o computador local`);
}
if (problems.length) {
  console.error(`✖ ${FILE} precisa de ajustes antes de publicar:\n  - ${problems.join("\n  - ")}`);
  process.exit(1);
}
console.log(`✔ ${FILE} conferido.`);
