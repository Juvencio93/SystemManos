import type { ReactNode } from "react";
import {
  LegalCompanyDetails,
  LegalList,
  LegalSection,
} from "@/components/legal/legal-page-shell";

/**
 * Conteúdo integral dos documentos jurídicos, separado das páginas para
 * também poder ser exibido dentro do portal Wi-Fi (modal que não tira o
 * visitante do fluxo de check-in). Páginas públicas e portal leem daqui:
 * este arquivo é a fonte única dos textos.
 */

export function TermsOfUseContent() {
  return (
    <>
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
          PagBank e Asaas v2 podem processar pagamentos quando a integração correspondente estiver
          configurada. A rota legada Asaas v1 foi descontinuada. Cada provedor aplica seus próprios
          termos e requisitos. A Manos Tech organiza as cobranças e recebe notificações, mas não
          atua como instituição financeira.
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
        <p>Questões sobre estes Termos podem ser encaminhadas pelos canais oficiais abaixo.</p>
        <LegalCompanyDetails />
      </LegalSection>
    </>
  );
}

export function PrivacyPolicyContent() {
  return (
    <>
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
          iniciadas pela página Direitos do Titular ou pelos canais oficiais abaixo. Confirmação e acesso em formato
          simplificado são providenciados imediatamente; a declaração completa de confirmação ou
          acesso é fornecida em até 15 dias, ressalvada regra específica da ANPD. Os demais pedidos
          são tratados conforme o direito exercido, a necessidade de proteger os dados e as hipóteses
          legais de conservação. O protocolo confirma o recebimento; não é, por si só, a resposta
          material ao pedido.
        </p>
        <LegalCompanyDetails />
      </LegalSection>
    </>
  );
}

export function PrivacyCenterRequestsContent() {
  return (
    <LegalSection title="1 Solicitações disponíveis">
      <LegalList
        items={[
          "Confirmar se seus dados pessoais são tratados.",
          "Solicitar acesso e informações sobre finalidades e compartilhamentos.",
          "Corrigir dados incompletos, inexatos ou desatualizados.",
          "Solicitar anonimização, bloqueio ou eliminação quando aplicável.",
          "Revogar consentimento e interromper comunicações de marketing.",
          "Solicitar portabilidade ou revisão de decisão automatizada, quando cabível.",
        ]}
      />
    </LegalSection>
  );
}

/**
 * Seção "Como solicitar" da Central de Privacidade. Na página pública, o
 * formulário de solicitação entra como `children`, entre o texto inicial
 * e a observação final; no portal Wi-Fi, a seção aparece só com o texto.
 */
export function PrivacyCenterHowToContent({ children }: { children?: ReactNode }) {
  return (
    <LegalSection title="2 Como solicitar">
      <p>
        Confirmação da existência de tratamento e acesso em formato simplificado devem ser
        providenciados imediatamente. Quando você pedir uma declaração completa de confirmação ou
        acesso, o prazo é de até 15 dias, ressalvada regra específica da ANPD. Para os demais
        direitos, a resposta deve seguir a regra aplicável; se não for possível atender de
        imediato, a equipe informará o motivo. Podemos confirmar sua identidade quando necessário.
        O protocolo comprova o recebimento, mas não substitui a resposta material ao pedido.
      </p>
      {children}
      <p className="text-xs text-slate-400">
        Para proteger o titular, poderá ser necessário confirmar a identidade antes de fornecer,
        corrigir ou excluir dados. O pedido de interrupção de ofertas é aplicado quando os dados
        enviados correspondem ao cadastro; se não for localizado, a equipe analisará a
        solicitação. O atendimento também pode ser solicitado pelo e-mail
        contato@manostech-system.com.br.
      </p>
    </LegalSection>
  );
}

export function PrivacyCenterContactContent() {
  return (
    <LegalSection title="3 Responsável pelo atendimento">
      <p>
        Quando o pedido se referir a uma campanha ou portal Wi-Fi de um estabelecimento, a Manos
        Tech poderá encaminhá-lo à empresa responsável pela finalidade do tratamento e acompanhar
        o atendimento da solicitação.
      </p>
      <LegalCompanyDetails />
    </LegalSection>
  );
}

/**
 * Seção final da Central de Privacidade na versão do portal Wi-Fi: mesmo
 * conteúdo informativo da página pública, sem os links que tirariam o
 * visitante do fluxo (lá, os links continuam na página).
 */
export function PrivacyCenterMoreContent() {
  return (
    <LegalSection title="4 Informações adicionais">
      <p>
        Consulte também a Política de Privacidade, disponível aqui neste bloco de privacidade.
        Informações oficiais sobre os direitos previstos na LGPD estão disponíveis no portal da
        ANPD (www.gov.br/anpd).
      </p>
    </LegalSection>
  );
}
