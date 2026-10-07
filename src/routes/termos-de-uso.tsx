import { createFileRoute } from "@tanstack/react-router";
import { LegalList, LegalPageShell, LegalSection } from "@/components/legal/legal-page-shell";

export const Route = createFileRoute("/termos-de-uso")({
  head: () => ({
    meta: [
      { title: "Termos de uso | Manos Tech" },
      { name: "description", content: "Regras para acesso e utilização da plataforma Manos Tech." },
    ],
  }),
  component: TermsOfUsePage,
});

function TermsOfUsePage() {
  return (
    <LegalPageShell
      eyebrow="Condições da plataforma"
      title="Termos de uso"
      summary="Regras aplicáveis aos administradores e usuários autorizados pelas empresas que utilizam a plataforma Manos Tech."
      updatedAt="7 de outubro de 2026"
    >
      <LegalSection title="1 Aceitação e acesso">
        <p>
          Ao acessar a plataforma, o usuário declara possuir autorização da organização contratante
          e concorda em utilizar os recursos conforme estes Termos, o contrato do cliente e a
          legislação aplicável.
        </p>
        <p>
          A conta é pessoal. Senhas, tokens e sessões não devem ser compartilhados. Qualquer
          suspeita de acesso indevido deve ser comunicada imediatamente.
        </p>
      </LegalSection>
      <LegalSection title="2 Perfis e permissões">
        <p>
          Os perfis de administrador, matriz, filial, revenda e demais funções limitam os dados e
          ações disponíveis. É proibido tentar ampliar privilégios, contornar controles ou acessar
          informações de outra organização.
        </p>
      </LegalSection>
      <LegalSection title="3 Uso permitido">
        <LegalList
          items={[
            "Utilizar a plataforma somente para atividades legítimas relacionadas à operação contratada.",
            "Manter os dados cadastrais e responsáveis atualizados.",
            "Respeitar direitos de terceiros, regras de proteção de dados e condições comerciais anunciadas.",
            "Revisar campanhas, prompts, relatórios e respostas de inteligência artificial antes de utilizá-los.",
          ]}
        />
      </LegalSection>
      <LegalSection title="4 Condutas proibidas">
        <LegalList
          items={[
            "Coletar dados excessivos, enganar visitantes ou enviar comunicações sem fundamento legal.",
            "Inserir malware, explorar vulnerabilidades ou interferir na disponibilidade do serviço.",
            "Copiar, sublicenciar, revender ou realizar engenharia reversa fora das permissões contratuais.",
            "Inserir dados sensíveis, credenciais de terceiros ou segredos desnecessários em recursos de IA.",
          ]}
        />
      </LegalSection>
      <LegalSection title="5 Rede, integrações e pagamentos">
        <p>
          Alterações em MikroTik, firewall, RADIUS, bridges e Hotspot devem seguir o manual
          operacional e utilizar backup e acesso seguro. Serviços de internet, energia,
          equipamentos, bancos, mensageria, nuvem e inteligência artificial podem afetar funções
          dependentes.
        </p>
        <p>
          PagBank, Asaas e outros provedores processam pagamentos segundo regras próprias. A Manos
          Tech organiza as cobranças e recebe notificações, mas não atua como instituição
          financeira.
        </p>
      </LegalSection>
      <LegalSection title="6 Conteúdo e inteligência artificial">
        <p>
          A organização contratante responde por marcas, imagens, preços, ofertas e comunicações
          publicadas. Recursos de IA são ferramentas de apoio e podem produzir imprecisões. Decisões
          com impacto relevante sobre pessoas exigem revisão humana.
        </p>
      </LegalSection>
      <LegalSection title="7 Suspensão e encerramento">
        <p>
          O acesso poderá ser limitado em caso de risco de segurança, fraude, ordem legal,
          inadimplência ou violação destes Termos. Exportação, retenção e eliminação de dados
          seguirão o contrato e a Política de Privacidade.
        </p>
      </LegalSection>
      <LegalSection title="8 Contato">
        <p>
          Questões sobre estes Termos podem ser encaminhadas para{" "}
          <strong className="text-white">manostech.suporte@gmail.com</strong>.
        </p>
      </LegalSection>
    </LegalPageShell>
  );
}
