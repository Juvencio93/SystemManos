import { createFileRoute } from "@tanstack/react-router";
import {
  LegalCompanyDetails,
  LegalList,
  LegalPageShell,
  LegalSection,
} from "@/components/legal/legal-page-shell";

export const Route = createFileRoute("/politica-de-privacidade")({
  head: () => ({
    meta: [
      { title: "Política de privacidade | Manos Tech" },
      {
        name: "description",
        content: "Como a plataforma Manos Tech trata e protege dados pessoais.",
      },
    ],
  }),
  component: PrivacyPolicyPage,
});

function PrivacyPolicyPage() {
  return (
    <LegalPageShell
      eyebrow="Proteção de dados"
      title="Política de privacidade"
      summary="Esta política explica quais dados são tratados na plataforma, para quais finalidades, com quem podem ser compartilhados e como os titulares podem exercer seus direitos."
      updatedAt="13 de outubro de 2026"
    >
      <LegalSection title="1 Quem participa do tratamento">
        <p>
          Para dados coletados pelo portal Wi-Fi e usados em campanhas, o estabelecimento
          normalmente decide as finalidades e atua como controlador. A Manos Tech normalmente
          processa esses dados para prestar o serviço e atua como operadora.
        </p>
        <p>
          A Manos Tech pode atuar como controladora dos dados necessários para cadastro de clientes,
          cobrança, segurança, suporte e cumprimento de obrigações próprias. A classificação final
          depende da operação concreta.
        </p>
      </LegalSection>
      <LegalSection title="2 Dados tratados">
        <LegalList
          items={[
            "Nome, telefone, e-mail, cidade e informações fornecidas no portal Wi-Fi.",
            "Empresa, filial, campanha, histórico de acessos e registros de consentimento.",
            "Identificadores técnicos necessários à conexão, segurança e prevenção a fraude.",
            "Dados cadastrais, profissionais e de contato dos usuários da plataforma.",
            "Registros de suporte, auditoria, cobrança e utilização dos recursos contratados.",
            "Em solicitações de privacidade, nome, e-mail, telefone, estabelecimento informado, detalhes do pedido, endereço IP e dados técnicos do navegador enviados no formulário.",
          ]}
        />
      </LegalSection>
      <LegalSection title="3 Finalidades">
        <LegalList
          items={[
            "Liberar, proteger e administrar o acesso ao Wi-Fi.",
            "Organizar visitantes, relacionamentos e campanhas autorizadas no CRM.",
            "Gerenciar matrizes, filiais, usuários, RBs, planos e cobranças.",
            "Prevenir abuso, investigar falhas, manter auditoria e melhorar a segurança.",
            "Prestar suporte, cumprir contratos e atender obrigações legais.",
          ]}
        />
      </LegalSection>
      <LegalSection title="4 Consentimento e comunicações">
        <p>
          O tratamento necessário para fornecer e proteger o Wi-Fi deve ser explicado de forma
          clara. O consentimento para receber ofertas e mensagens deve ser apresentado
          separadamente, ser opcional e poder ser revogado.
        </p>
      </LegalSection>
      <LegalSection title="5 Compartilhamento e fornecedores">
        <p>
          Para operar a plataforma, a Manos Tech utiliza fornecedores de hospedagem, banco de dados,
          armazenamento de backups, mensageria, inteligência artificial e pagamentos, conforme os
          recursos contratados e habilitados. A base principal da plataforma está hospedada no
          Supabase, na região do Canadá. Backups criptografados podem ser armazenados no Cloudflare
          R2. Telegram, PagBank e outros provedores recebem dados somente quando o recurso
          correspondente é utilizado.
        </p>
        <p>
          Alguns fornecedores podem processar dados fora do Brasil. Os países e mecanismos
          aplicáveis dependem do serviço contratado; solicite a relação atual e as garantias pelo
          canal de privacidade antes do tratamento. As transferências devem observar a LGPD e a
          regulamentação da ANPD.
        </p>
      </LegalSection>
      <LegalSection title="6 Retenção e eliminação">
        <p>
          Os dados são mantidos pelo período necessário às finalidades informadas, ao contrato, à
          segurança e às obrigações legais. Atualmente, os registros de auditoria do HotSpot são
          eliminados após 30 dias; o histórico do agente de IA é removido após 45 dias sem atividade
          relevante; e os backups do banco no R2 expiram após 35 dias. Esses prazos se aplicam a
          essas cópias e registros, não definem o prazo de conservação dos dados ativos de
          visitantes.
        </p>
        <p>
          Os prazos para dados ativos de visitantes, solicitações de privacidade, comprovantes de
          consentimento e registros financeiros dependem da finalidade e das obrigações aplicáveis.
          Ao terminar a necessidade de conservação, os dados são eliminados ou anonimizados, salvo
          hipótese legal de guarda.
        </p>
      </LegalSection>
      <LegalSection title="7 Segurança">
        <p>
          São utilizados controles de acesso, segregação entre organizações, proteção de
          credenciais, registros de eventos e medidas de continuidade proporcionais ao risco. Nenhum
          ambiente é totalmente imune a incidentes; ocorrências relevantes serão tratadas conforme a
          legislação aplicável.
        </p>
      </LegalSection>
      <LegalSection title="8 Direitos e contato">
        <p>
          O titular pode solicitar confirmação, acesso, correção, informação, anonimização,
          bloqueio, eliminação, portabilidade e revogação, quando aplicável. Solicitações podem ser
          iniciadas pela página Direitos do Titular ou pelos canais oficiais abaixo. A Manos Tech
          LTDA é o encarregado pelo tratamento de dados pessoais, com Gabriel Juvencio como pessoa
          natural responsável, e atende esses assuntos pelos canais informados a seguir. Confirmação
          e acesso em formato simplificado são tratados imediatamente; pedidos que exigem declaração
          completa seguem o prazo legal aplicável, que pode chegar a 15 dias. Outros direitos são
          avaliados conforme o tipo de pedido e as hipóteses legais de conservação.
        </p>
        <LegalCompanyDetails />
      </LegalSection>
    </LegalPageShell>
  );
}
