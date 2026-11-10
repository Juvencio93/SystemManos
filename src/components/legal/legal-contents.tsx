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
      <LegalSection title="8 Cancelamento e arrependimento">
        <p>
          O cliente pode cancelar a assinatura quando quiser, pelos canais oficiais da Manos Tech
          (telefone e e-mail abaixo). O pedido de cancelamento é confirmado imediatamente. O
          arrependimento em até 7 dias corridos da contratação, sem motivo e sem ônus, a troca e a
          devolução de valores seguem a Política de Reembolso, disponível em /reembolso.
        </p>
      </LegalSection>
      <LegalSection title="9 Contato">
        <p>Questões sobre estes Termos podem ser encaminhadas pelos canais oficiais abaixo.</p>
        <LegalCompanyDetails />
      </LegalSection>
    </>
  );
}

export function CookiePolicyContent() {
  return (
    <>
      <LegalSection title="1 O que são cookies">
        <p>
          Cookies são pequenos arquivos que o navegador guarda para lembrar informações entre
          visitas. A Manos Tech usa apenas cookies necessários para o login e o funcionamento do
          Wi-Fi. Não usamos cookies de análise nem de publicidade. Quando uma tecnologia não
          essencial for ativada, o consentimento será pedido antes do uso (LGPD, arts. 7º e 8º).
        </p>
      </LegalSection>
      <LegalSection title="2 Cookies necessários">
        <LegalList
          items={[
            "sb-manostech-auth-token — sessão do login na plataforma. Cookie httpOnly (não é lido por scripts da página), válido por 30 dias e renovado a cada acesso. Sem ele, não é possível entrar no sistema.",
            "manos_hotspot_context — contexto do check-in no portal Wi-Fi (qual portal e qual liberação de acesso). Cookie httpOnly, Secure e SameSite=Lax, válido por 10 minutos. Sem ele, o portal não consegue liberar o Wi-Fi.",
          ]}
        />
      </LegalSection>
      <LegalSection title="3 Armazenamento local">
        <p>
          Além dos cookies, o navegador pode guardar preferências no próprio aparelho, sem enviar
          esses dados para a Manos Tech: som do chat, status manual de presença, notificações já
          lidas e os dados do formulário do portal (nome, telefone e cidade) para pré-preencher a
          próxima visita no mesmo aparelho, por até 90 dias. Os consentimentos nunca voltam
          marcados: o aceite é sempre uma ação nova do visitante. Nada disso autoriza comunicações
          de marketing.
        </p>
      </LegalSection>
      <LegalSection title="4 Terceiros">
        <p>
          As fontes de texto da plataforma são carregadas dos servidores do Google (Google Fonts).
          Ao carregar a página, o navegador do visitante faz uma requisição a esses servidores, que
          podem ver o endereço IP — o Google não recebe cookies da Manos Tech nem dados do
          cadastro. Não há ferramentas de análise ou publicidade de terceiros ativas hoje.
        </p>
      </LegalSection>
      <LegalSection title="5 Como controlar">
        <p>
          Os cookies necessários não podem ser desativados sem impedir o login e o Wi-Fi, porque
          são eles que mantêm a sessão e a liberação de acesso. O armazenamento local pode ser
          limpo nas configurações do navegador, a qualquer momento, sem afetar o cadastro. Quando
          cookies não essenciais existirem, será possível aceitar ou recusar cada categoria no
          banner, e retirar o consentimento será tão fácil quanto dá-lo (LGPD, art. 8º, § 5º).
        </p>
      </LegalSection>
      <LegalSection title="6 Contato">
        <p>Dúvidas sobre cookies e armazenamento local podem ser encaminhadas pelos canais oficiais abaixo.</p>
        <LegalCompanyDetails />
      </LegalSection>
    </>
  );
}

export function RefundPolicyContent() {
  return (
    <>
      <LegalSection title="1 Arrependimento em 7 dias">
        <p>
          Quem contrata a assinatura fora do estabelecimento comercial pode desistir em até 7 dias
          corridos da contratação, sem precisar dar motivo e sem nenhum ônus. Nesse caso, a Manos
          Tech devolve imediatamente e com atualização monetária tudo o que foi pago, inclusive
          valores de eventuais serviços acessórios contratados junto com a assinatura (CDC, art.
          49 e parágrafo único; Decreto 7.962/2013, art. 5º).
        </p>
      </LegalSection>
      <LegalSection title="2 Como exercer o arrependimento">
        <p>
          O pedido pode ser feito pelos canais oficiais da Manos Tech — telefone (47) 99704-9730
          ou e-mail contato@manostech-system.com.br — e é confirmado imediatamente. A Manos Tech
          comunica o cancelamento à operadora do cartão na mesma hora, para que o valor não seja
          lançado ou seja estornado, e rescinde sem ônus os contratos acessórios (Decreto
          7.962/2013, art. 5º, §§ 1º a 4º).
        </p>
      </LegalSection>
      <LegalSection title="3 Defeito no serviço">
        <p>
          Se o serviço apresentar defeito, o cliente pode reclamar em até 30 dias (serviços) e a
          Manos Tech tem 30 dias para sanar o problema. Sem solução nesse prazo, o cliente escolhe
          entre a reexecução do serviço, a restituição imediata e atualizada do valor pago ou o
          abatimento proporcional do preço (CDC, arts. 18, § 1º, e 26). Em caso de serviço
          essencial indisponível, a escolha é imediata (CDC, art. 18, § 3º).
        </p>
      </LegalSection>
      <LegalSection title="4 Oferta não cumprida">
        <p>
          Se a oferta anunciada não for cumprida, o cliente pode exigir o cumprimento forçado, um
          serviço equivalente ou a rescisão do contrato com restituição atualizada do valor pago e
          perdas e danos (CDC, art. 35). A oferta anunciada obriga e integra o contrato (CDC, art.
          30).
        </p>
      </LegalSection>
      <LegalSection title="5 Cobrança indevida">
        <p>
          Valor cobrado indevidamente é devolvido em dobro, com correção monetária, salvo engano
          justificável (CDC, art. 42, parágrafo único).
        </p>
      </LegalSection>
      <LegalSection title="6 Cancelamento da assinatura">
        <p>
          Fora do prazo de arrependimento, a assinatura pode ser cancelada a qualquer momento
          pelos canais oficiais, sem multa. O acesso continua até o fim do período já pago. Valores
          de períodos já utilizados não são devolvidos, salvo nas hipóteses de arrependimento (item
          1) e defeito (item 3).
        </p>
      </LegalSection>
      <LegalSection title="7 Prazo e forma do reembolso">
        <p>
          O reembolso é feito no mesmo meio usado no pagamento (estorno no cartão ou Pix). A Manos
          Tech comunica o estorno à operadora imediatamente; o prazo para o valor aparecer na
          fatura ou na conta depende da operadora do cartão ou do banco, não da Manos Tech. A
          garantia contratual soma-se à garantia legal e não a substitui (CDC, art. 50).
        </p>
      </LegalSection>
      <LegalSection title="8 Contato">
        <p>
          Pedidos de reembolso, troca e cancelamento são atendidos pelos canais oficiais abaixo,
          com resposta em até 5 dias (Decreto 7.962/2013, art. 4º, V).
        </p>
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
          Dados de visitantes: enquanto a empresa cliente estiver ativa e por até 90 dias após o
          fim do contrato. Comprovantes de consentimento e solicitações de privacidade: 5 anos após
          a revogação ou o fim do tratamento, para prova do consentimento e das respostas dadas
          (CDC, art. 27). Registros financeiros e fiscais: pelo prazo das obrigações legais
          aplicáveis. Ao terminar a necessidade de conservação, os dados são eliminados ou
          anonimizados, salvo hipótese legal de guarda.
        </p>
      </LegalSection>
      <LegalSection title="8 Cookies e armazenamento local">
        <p>
          A plataforma usa cookies e armazenamento local necessários para manter sessões seguras,
          permitir o funcionamento do portal Wi-Fi e guardar preferências da interface. O portal
          pode lembrar nome, telefone e cidade neste aparelho para pré-preencher a próxima visita,
          por até 90 dias; os consentimentos nunca voltam marcados. Esses recursos não autorizam
          comunicações de marketing. Se forem ativadas tecnologias não essenciais de análise ou
          publicidade, as informações e os controles correspondentes serão apresentados antes do seu
          uso, quando exigido.
        </p>
      </LegalSection>
      <LegalSection title="9 Crianças e adolescentes">
        <p>
          O portal Wi-Fi pergunta se o visitante tem 18 anos ou mais antes do cadastro. Quem tem
          menos de 18 anos só conecta com o nome do responsável e a autorização dele, registrada
          junto ao cadastro (nome do responsável e momento do aceite). Para dados de crianças, é
          observado o consentimento específico e em destaque de pelo menos um dos pais ou
          responsável legal, ressalvadas as hipóteses legais (LGPD, art. 14; ECA Digital, Lei
          15.211/2025). O portal não deve ser usado para coletar dados além do necessário para a
          finalidade informada.
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
