import { createFileRoute } from "@tanstack/react-router";
import {
  LegalCompanyDetails,
  LegalList,
  LegalPageShell,
  LegalSection,
} from "@/components/legal/legal-page-shell";
import { LEGAL_DOCUMENTS } from "@/lib/legal-document-versions";

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
      updatedAt={LEGAL_DOCUMENTS.privacyPolicy.updatedAt}
      version={LEGAL_DOCUMENTS.privacyPolicy.version}
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
            "Em solicitações de privacidade, nome, e-mail, telefone, estabelecimento informado, detalhes do pedido, endereço IP e dados técnicos do navegador enviados no formulário para registrar, proteger e atender a solicitação.",
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
      <LegalSection title="4 Bases legais">
        <p>
          A base legal depende da finalidade e do papel de cada empresa na operação. Conforme o
          caso, o tratamento pode se apoiar na execução de contrato ou de procedimentos
          relacionados ao serviço, no cumprimento de obrigação legal ou regulatória, no
          consentimento ou no legítimo interesse, observados os direitos e as expectativas do
          titular. O consentimento para ofertas é opcional e pode ser revogado. A empresa que
          controla cada campanha deve definir e informar a base legal aplicável ao seu uso dos
          dados.
        </p>
      </LegalSection>
      <LegalSection title="5 Consentimento e comunicações">
        <p>
          O tratamento necessário para fornecer e proteger o Wi-Fi deve ser explicado de forma
          clara. O consentimento para receber ofertas deve ser apresentado separadamente, ser
          opcional e poder ser revogado. No portal, a opção de marketing cobre ofertas pelo
          WhatsApp informado no cadastro; ela não autoriza automaticamente outros canais.
        </p>
      </LegalSection>
      <LegalSection title="6 Compartilhamento e fornecedores">
        <p>
          Para operar a plataforma, a Manos Tech utiliza fornecedores de hospedagem, banco de dados,
          armazenamento de backups, mensageria, inteligência artificial e pagamentos, conforme os
          recursos contratados e habilitados. A base principal da plataforma está hospedada no
          Supabase, na região do Canadá. Backups criptografados podem ser armazenados no Cloudflare
          R2. Telegram, PagBank e Asaas v2 podem receber os dados necessários quando a integração
          correspondente é usada. O endpoint legado Asaas v1 foi descontinuado. O compartilhamento
          depende da operação e da integração configurada.
        </p>
        <p>
          Alguns fornecedores podem processar dados fora do Brasil. Os países e mecanismos
          aplicáveis dependem do serviço contratado; solicite a relação atual e as garantias pelo
          canal de privacidade antes do tratamento. As transferências devem observar a LGPD e a
          regulamentação da ANPD.
        </p>
      </LegalSection>
      <LegalSection title="7 Retenção e eliminação">
        <p>
          Os dados são mantidos pelo período necessário às finalidades informadas, ao contrato, à
          segurança e às obrigações legais. Os registros de auditoria do HotSpot são eliminados por
          rotina diária após 30 dias. O histórico de conversas do agente operacional é removido por
          rotina programada após 45 dias sem atividade. Backups criptografados podem ser armazenados
          no Cloudflare R2; a retenção depende da regra de ciclo de vida configurada para o bucket e
          não define o prazo de conservação dos dados ativos de visitantes.
        </p>
        <p>
          Os prazos para dados ativos de visitantes, solicitações de privacidade, comprovantes de
          consentimento e registros financeiros dependem da finalidade e das obrigações aplicáveis.
          Ao terminar a necessidade de conservação, os dados são eliminados ou anonimizados, salvo
          hipótese legal de guarda.
        </p>
      </LegalSection>
      <LegalSection title="8 Cookies e armazenamento local">
        <p>
          A plataforma usa cookies e armazenamento local necessários para manter sessões seguras,
          permitir o funcionamento do portal Wi-Fi e guardar preferências da interface. Esses
          recursos não autorizam comunicações de marketing. Se forem ativadas tecnologias não
          essenciais de análise ou publicidade, as informações e os controles correspondentes
          serão apresentados antes do seu uso, quando exigido.
        </p>
      </LegalSection>
      <LegalSection title="9 Crianças e adolescentes">
        <p>
          Quando o tratamento envolver crianças ou adolescentes, ele deverá atender ao melhor
          interesse e às regras aplicáveis. Para dados de crianças, será observado o consentimento
          específico e em destaque de pelo menos um dos pais ou responsável legal, ressalvadas as
          hipóteses legais. O portal Wi-Fi não deve ser usado para coletar dados além do necessário
          para a finalidade informada.
        </p>
      </LegalSection>
      <LegalSection title="10 Segurança">
        <p>
          São utilizados controles de acesso, segregação entre organizações, proteção de
          credenciais, registros de eventos e medidas de continuidade proporcionais ao risco. Nenhum
          ambiente é totalmente imune a incidentes; ocorrências relevantes serão tratadas conforme a
          legislação aplicável.
        </p>
      </LegalSection>
      <LegalSection title="11 Direitos e contato">
        <p>
          O titular pode solicitar confirmação, acesso, correção, informação, anonimização,
          bloqueio, eliminação, portabilidade e revogação, quando aplicável. Solicitações podem ser
          iniciadas pela página Direitos do Titular ou pelos canais oficiais abaixo. A Manos Tech
          LTDA indicou a própria empresa como encarregada para os tratamentos sob sua responsabilidade,
          com Gabriel Juvencio como pessoa natural para contato. Confirmação e acesso em formato
          simplificado são providenciados imediatamente; a declaração completa de confirmação ou
          acesso é fornecida em até 15 dias, ressalvada regra específica da ANPD. Os demais pedidos
          são tratados conforme o direito exercido, a necessidade de proteger os dados e as hipóteses
          legais de conservação. O protocolo confirma o recebimento; não é, por si só, a resposta
          material ao pedido.
        </p>
        <LegalCompanyDetails />
      </LegalSection>
    </LegalPageShell>
  );
}
