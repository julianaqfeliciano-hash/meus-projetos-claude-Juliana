// Gera o .env.local a partir do Supabase rodando na máquina (npx supabase start).
// Uso: npm run local:env
import { execSync } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";

let raw;
try {
  raw = execSync("npx supabase status -o env", { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
} catch {
  console.error("✖ O Supabase local não está rodando. Abra o Docker Desktop e rode: npx supabase start");
  process.exit(1);
}

const env = Object.fromEntries(
  raw
    .split(/\r?\n/)
    .map((line) => line.match(/^([A-Z_]+)="?(.*?)"?$/))
    .filter(Boolean)
    .map((m) => [m[1], m[2]]),
);
if (!env.API_URL || !env.ANON_KEY || !env.SERVICE_ROLE_KEY) {
  console.error("✖ Não consegui ler as chaves do Supabase. Saída recebida:\n" + raw);
  process.exit(1);
}

const content = `# Gerado por scripts/setup-local.mjs — ambiente LOCAL de demonstração.
NEXT_PUBLIC_SUPABASE_URL=${env.API_URL}
NEXT_PUBLIC_SUPABASE_ANON_KEY=${env.ANON_KEY}
SUPABASE_SERVICE_ROLE_KEY=${env.SERVICE_ROLE_KEY}
NEXT_PUBLIC_SITE_URL=http://localhost:3000

NEXT_PUBLIC_NAAP_NAME=NAAP Psicologia
NEXT_PUBLIC_NAAP_EMAIL=contato@naappsicologia.com.br
NEXT_PUBLIC_NAAP_PHONE=(85) 99840-2825

# Os e-mails não saem de verdade: ficam na caixa de teste em http://127.0.0.1:54324
SMTP_HOST=127.0.0.1
SMTP_PORT=54325
SMTP_USER=demo
SMTP_PASS=demo
EMAIL_FROM="Mentorias NAAP <mentorias@naap.local>"
ADMIN_NOTIFY_EMAIL=coordenacao@naappsicologia.com.br
`;

if (existsSync(".env.local")) console.log("ℹ .env.local já existia e foi substituído.");
writeFileSync(".env.local", content);
console.log("✔ .env.local criado. Próximo passo: npm run demo:seed");
