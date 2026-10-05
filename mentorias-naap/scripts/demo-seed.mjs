// Preenche o Supabase LOCAL com dados de demonstração (admin, alunos, módulos,
// vídeos, vendas e progresso), para apresentar o sistema com os relatórios cheios.
// Uso: npm run demo:seed            (zera o banco local antes)
//      npm run demo:seed -- https://youtu.be/SEU_VIDEO   (usa um vídeo real seu nos exemplos)
import { execSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("✖ Variáveis não encontradas. Rode antes: npm run local:env");
  process.exit(1);
}
if (!/127\.0\.0\.1|localhost/.test(url)) {
  console.error("✖ Por segurança, este script só roda contra o Supabase local.");
  process.exit(1);
}

function youtubeId(input) {
  if (!input) return null;
  if (/^[\w-]{11}$/.test(input)) return input;
  const m = input.match(/(?:youtu\.be\/|v=|embed\/|live\/|shorts\/)([\w-]{11})/);
  return m ? m[1] : null;
}
const demoVideo = youtubeId(process.argv[2]);
if (process.argv[2] && !demoVideo) {
  console.error("✖ Link do YouTube inválido:", process.argv[2]);
  process.exit(1);
}

console.log("• Zerando o banco local…");
execSync("npx supabase db reset", { stdio: "ignore" });

const db = createClient(url, key, { auth: { persistSession: false } });
const PASSWORD = "naap2026";
const now = new Date();
const daysAgo = (n) => new Date(now.getTime() - n * 864e5);
const isoDate = (n) => daysAgo(n).toISOString().slice(0, 10);

async function createUser(email, fullName, phone, profile) {
  const { data, error } = await db.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: fullName, phone, accepted_terms_at: daysAgo(40).toISOString() },
  });
  if (error) throw error;
  await db.from("profiles").update(profile).eq("id", data.user.id);
  return data.user.id;
}
const must = ({ data, error }) => {
  if (error) throw error;
  return data;
};

console.log("• Criando usuários…");
const approved = (n) => ({ status: "approved", approved_at: daysAgo(n).toISOString(), last_seen_at: daysAgo(n % 5).toISOString() });
await createUser("coordenacao@naappsicologia.com.br", "Coordenação NAAP", "(85) 99840-2825", { role: "admin", status: "approved", approved_at: now.toISOString() });
const students = {
  maria: await createUser("maria.souza@email.com", "Maria Souza", "(85) 98888-1111", approved(35)),
  ana: await createUser("ana.costa@email.com", "Ana Costa", "(85) 97777-2222", approved(30)),
  pedro: await createUser("pedro.rocha@email.com", "Pedro Rocha", "(85) 99111-2233", approved(20)),
  lucas: await createUser("lucas.melo@email.com", "Lucas Melo", "(88) 99222-3344", approved(12)),
  joao: await createUser("joao.lima@email.com", "João Lima", "(85) 96666-3333", { status: "pending" }),
  carla: await createUser("carla.mendes@email.com", "Carla Mendes", "(88) 95555-4444", { status: "pending" }),
};

console.log("• Criando módulos e vídeos…");
const [m1, m2, m3] = must(
  await db.from("modules").insert([
    { title: "Módulo 1 — Avaliação Psicológica", description: "Mentorias quinzenais sobre testes, entrevistas e elaboração de laudos.", position: 1, published: true },
    { title: "Módulo 2 — Psicoterapia Infantil", description: "Estudos de caso e técnicas lúdicas no atendimento de crianças.", position: 2, published: true },
    { title: "Módulo 3 — Neuropsicologia", description: "Em preparação.", position: 3, published: false },
  ]).select(),
);
const yt = (fallback) => demoVideo ?? fallback;
const videos = must(
  await db.from("videos").insert(
    [
      { module_id: m1.id, title: "Mentoria — Entrevista inicial", youtube_id: yt("aaaaaaaaaaa"), recorded_on: isoDate(42), duration_minutes: 118, position: 1 },
      { module_id: m1.id, title: "Mentoria — Escolha dos testes", youtube_id: yt("bbbbbbbbbbb"), recorded_on: isoDate(28), duration_minutes: 124, position: 2 },
      { module_id: m1.id, title: "Mentoria — Elaboração do laudo", youtube_id: yt("ccccccccccc"), recorded_on: isoDate(14), duration_minutes: 121, position: 3,
        description: "Estrutura do laudo psicológico conforme a Resolução CFP 06/2019, com exemplos comentados." },
      { module_id: m2.id, title: "Mentoria — O brincar na clínica", youtube_id: yt("ddddddddddd"), recorded_on: isoDate(35), duration_minutes: 115, position: 1 },
      { module_id: m2.id, title: "Mentoria — Devolutiva aos pais", youtube_id: yt("eeeeeeeeeee"), recorded_on: isoDate(21), duration_minutes: 117, position: 2 },
      { module_id: m3.id, title: "Mentoria — Funções executivas", youtube_id: yt("fffffffffff"), recorded_on: isoDate(7), duration_minutes: 120, position: 1 },
    ].map((v) => ({ description: "", published: true, notified_at: now.toISOString(), ...v })),
  ).select(),
);

console.log("• Registrando vendas e acessos…");
const sale = async (student, n, cents, method, modules, notes = "") => {
  const s = must(await db.from("sales").insert({ student_id: student, sold_on: isoDate(n), amount_cents: cents, payment_method: method, notes }).select().single());
  must(await db.from("module_access").insert(modules.map((m) => ({ student_id: student, module_id: m.id, sale_id: s.id, granted_at: daysAgo(n).toISOString() }))));
};
await sale(students.maria, 70, 45000, "pix", [m1], "Pago na mentoria presencial");
await sale(students.ana, 40, 80000, "cartao_credito", [m1, m2], "Combo 2 módulos");
await sale(students.pedro, 18, 45000, "dinheiro", [m1]);
await sale(students.lucas, 6, 40000, "pix", [m2]);
await sale(students.maria, 3, 40000, "pix", [m2]);

console.log("• Simulando quem assistiu…");
const v = Object.fromEntries(videos.map((x, i) => [i, x]));
const prog = (student, video, pct, views, lastDays) => {
  const dur = video.duration_minutes * 60;
  const pos = Math.round(dur * pct);
  return { student_id: student, video_id: video.id, duration: dur, max_position: pos, seconds_watched: Math.round(pos * 1.05),
    view_count: views, first_watched_at: daysAgo(lastDays + 3).toISOString(), last_watched_at: daysAgo(lastDays).toISOString() };
};
must(await db.from("video_progress").insert([
  prog(students.maria, v[0], 1, 2, 30), prog(students.maria, v[1], 0.55, 1, 9), prog(students.maria, v[3], 0.2, 1, 1),
  prog(students.ana, v[0], 1, 1, 25), prog(students.ana, v[1], 1, 1, 15), prog(students.ana, v[2], 0.3, 1, 2),
  prog(students.ana, v[3], 0.95, 1, 20), prog(students.ana, v[4], 0.6, 2, 4),
  prog(students.pedro, v[0], 0.8, 1, 10), prog(students.lucas, v[3], 0.4, 1, 3),
]));

console.log(`
✔ Dados de demonstração prontos!

  Administração:  coordenacao@naappsicologia.com.br
  Aluna:          maria.souza@email.com   (também: ana.costa@email.com)
  Senha de todos: ${PASSWORD}

  Abra http://localhost:3000 (rode "npm run dev" se ainda não estiver rodando).
${demoVideo ? "" : `
  ⚠ Os vídeos de exemplo usam links fictícios e não tocam. Para a apresentação,
    rode de novo passando um vídeo seu do YouTube (não listado):
    npm run demo:seed -- https://youtu.be/SEU_VIDEO
`}`);
