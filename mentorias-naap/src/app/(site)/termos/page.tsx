import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";
import { brand } from "@/lib/config";

export const metadata: Metadata = { title: "Termos de uso" };

export default function TermsPage() {
  return (
    <LegalPage title="Termos de uso" updated="outubro de 2026">
      <p>
        Estes termos regulam o uso da plataforma Mentorias NAAP, mantida por {brand.name}. Ao criar
        uma conta, você declara que leu e concorda com as condições abaixo.
      </p>
      <h2>1. Acesso</h2>
      <ul>
        <li>O acesso é pessoal e intransferível. Cada conta pode ficar conectada em apenas um aparelho por vez; um novo acesso encerra a sessão anterior.</li>
        <li>O cadastro passa por aprovação da administração. Os módulos liberados correspondem aos adquiridos presencialmente junto ao NAAP.</li>
        <li>O acesso aos módulos adquiridos não tem prazo de expiração enquanto a plataforma estiver em funcionamento.</li>
      </ul>
      <h2>2. Uso do conteúdo</h2>
      <ul>
        <li>As gravações e materiais são protegidos por direitos autorais e destinam-se exclusivamente ao seu estudo pessoal.</li>
        <li>É proibido gravar, baixar, copiar, compartilhar, revender ou exibir publicamente o conteúdo sem autorização por escrito.</li>
        <li>As mentorias podem conter discussões de casos; respeite o sigilo e a ética profissional da Psicologia.</li>
      </ul>
      <h2>3. Suspensão</h2>
      <p>
        O NAAP pode suspender ou bloquear contas em caso de compartilhamento de acesso, uso indevido do
        conteúdo ou violação destes termos.
      </p>
      <h2>4. Disponibilidade</h2>
      <p>
        Empenhamo-nos em manter a plataforma disponível, mas podem ocorrer interrupções para
        manutenção ou por falhas de serviços de terceiros (como hospedagem e YouTube).
      </p>
      <h2>5. Contato</h2>
      <p>{brand.name} · {brand.email} · {brand.phone}</p>
    </LegalPage>
  );
}
