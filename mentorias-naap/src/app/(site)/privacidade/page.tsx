import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";
import { brand } from "@/lib/config";

export const metadata: Metadata = { title: "Política de privacidade" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Política de privacidade" updated="outubro de 2026">
      <p>
        Esta política explica como {brand.name} trata seus dados pessoais na plataforma Mentorias
        NAAP, em conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018 — LGPD).
      </p>
      <h2>1. Dados que coletamos</h2>
      <ul>
        <li><strong>Cadastro:</strong> nome completo, e-mail, telefone e senha (armazenada de forma criptografada).</li>
        <li><strong>Compras:</strong> módulos adquiridos, data, valor e forma de pagamento registrados pela administração.</li>
        <li><strong>Uso:</strong> vídeos assistidos, tempo e percentual assistido, data do último acesso e identificador da sessão ativa.</li>
      </ul>
      <h2>2. Para que usamos</h2>
      <ul>
        <li>Criar e aprovar sua conta e liberar os módulos adquiridos (execução de contrato).</li>
        <li>Enviar avisos sobre aprovação e novas gravações disponíveis.</li>
        <li>Impedir o compartilhamento de contas e proteger o conteúdo (legítimo interesse).</li>
        <li>Gerar relatórios internos de acesso e vendas para a gestão das mentorias.</li>
      </ul>
      <h2>3. Compartilhamento</h2>
      <p>
        Não vendemos seus dados. Eles são armazenados em provedores que prestam serviço à plataforma:
        Supabase (banco de dados e autenticação), provedor de hospedagem do site, provedor de e-mail e
        YouTube (exibição dos vídeos, sujeito à política do Google).
      </p>
      <h2>4. Por quanto tempo</h2>
      <p>
        Mantemos os dados enquanto sua conta existir. Registros de vendas podem ser mantidos pelo prazo
        exigido pela legislação fiscal.
      </p>
      <h2>5. Seus direitos</h2>
      <p>
        Você pode solicitar a confirmação, o acesso, a correção, a portabilidade ou a exclusão dos seus
        dados, além de revogar consentimentos, pelo e-mail {brand.email}. Nome e telefone também podem
        ser atualizados em “Minha conta”.
      </p>
      <h2>6. Segurança</h2>
      <p>
        Usamos conexão criptografada (HTTPS), senhas com hash e controle de acesso por usuário. Apenas a
        administração do NAAP acessa os relatórios.
      </p>
      <h2>7. Contato do encarregado</h2>
      <p>{brand.name} · {brand.email} · {brand.phone}</p>
    </LegalPage>
  );
}
