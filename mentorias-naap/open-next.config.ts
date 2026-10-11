// Configuração do adaptador OpenNext para a Cloudflare.
// Todas as páginas do sistema são dinâmicas (dependem do usuário logado), então
// não usamos o cache incremental (R2/KV) e o plano gratuito basta.
import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig({});
