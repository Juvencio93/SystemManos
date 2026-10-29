from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Image, KeepTogether, PageBreak, Paragraph, SimpleDocTemplate, Spacer

ROOT = Path("public/mikrotik")
LOGO = ROOT / "manos-tech-logo.jpg"
PDF_MAIN = ROOT / "MANUAL DE INSTALAÇÃO.pdf"

base = getSampleStyleSheet()
styles = {
    "cover": ParagraphStyle("cover", parent=base["Title"], fontName="Helvetica-Bold", fontSize=25, leading=31, textColor=colors.HexColor("#075985"), alignment=1, spaceAfter=9),
    "subtitle": ParagraphStyle("subtitle", parent=base["BodyText"], fontSize=13, leading=18, textColor=colors.HexColor("#475569"), alignment=1, spaceAfter=12),
    "h1": ParagraphStyle("h1", parent=base["Heading1"], fontName="Helvetica-Bold", fontSize=19, leading=24, textColor=colors.HexColor("#075985"), spaceAfter=10),
    "h2": ParagraphStyle("h2", parent=base["Heading2"], fontName="Helvetica-Bold", fontSize=14, leading=18, textColor=colors.HexColor("#0e7490"), spaceBefore=8, spaceAfter=6),
    "body": ParagraphStyle("body", parent=base["BodyText"], fontSize=11.2, leading=16, textColor=colors.HexColor("#172033"), spaceAfter=8),
    "step": ParagraphStyle("step", parent=base["BodyText"], fontSize=11.2, leading=16, leftIndent=8, firstLineIndent=-8, spaceAfter=7),
    "code": ParagraphStyle("code", parent=base["Code"], fontName="Courier-Bold", fontSize=10.2, leading=15, textColor=colors.HexColor("#0f172a"), backColor=colors.HexColor("#eef2f7"), borderColor=colors.HexColor("#94a3b8"), borderWidth=.8, borderPadding=9, splitLongWords=True),
    "warn": ParagraphStyle("warn", parent=base["BodyText"], fontSize=11, leading=16, textColor=colors.HexColor("#9a3412"), backColor=colors.HexColor("#fff7ed"), borderColor=colors.HexColor("#fb923c"), borderWidth=1, borderPadding=10),
    "ok": ParagraphStyle("ok", parent=base["BodyText"], fontSize=11, leading=16, textColor=colors.HexColor("#065f46"), backColor=colors.HexColor("#ecfdf5"), borderColor=colors.HexColor("#34d399"), borderWidth=1, borderPadding=10),
    "small": ParagraphStyle("small", parent=base["BodyText"], fontSize=9, leading=12, textColor=colors.HexColor("#64748b")),
}


def P(text, style="body"):
    paragraph = Paragraph(text, styles[style])
    if style in {"warn", "ok"}:
        return KeepTogether([Spacer(1, 4*mm), paragraph, Spacer(1, 7*mm)])
    return paragraph


def C(text):
    paragraph = Paragraph(text.replace("&", "&amp;"), styles["code"])
    return KeepTogether([Spacer(1, 4*mm), paragraph, Spacer(1, 7*mm)])


def block(title, body, command=None, result=None):
    items = [P(title, "h2"), P(body)]
    if command:
        items.append(C(command))
    if result:
        items.append(P(f"<b>Resultado esperado:</b> {result}", "ok"))
    return KeepTogether(items)


def header_footer(canvas, doc):
    canvas.saveState()
    if doc.page > 1:
        canvas.drawImage(str(LOGO), 18*mm, 270*mm, width=18*mm, height=18*mm, preserveAspectRatio=True, mask="auto")
        canvas.setFont("Helvetica-Bold", 9)
        canvas.setFillColor(colors.HexColor("#075985"))
        canvas.drawString(40*mm, 280*mm, "MANOS TECH - INSTALAÇÃO MIKROTIK HOTSPOT")
        canvas.setStrokeColor(colors.HexColor("#cbd5e1"))
        canvas.line(18*mm, 268*mm, 192*mm, 268*mm)
    canvas.setStrokeColor(colors.HexColor("#cbd5e1"))
    canvas.line(18*mm, 16*mm, 192*mm, 16*mm)
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(colors.HexColor("#64748b"))
    canvas.drawString(18*mm, 11*mm, "Manual revisado em 29/10/2026 - RouterOS v7")
    canvas.drawRightString(192*mm, 11*mm, f"Página {doc.page}")
    canvas.restoreState()


story = [
    Spacer(1, 15*mm),
    Image(str(LOGO), width=58*mm, height=58*mm, hAlign="CENTER"),
    Spacer(1, 8*mm),
    P("Instalação padrão de RB", "cover"),
    P("MikroTik RouterOS v7 - HotSpot Manos Tech", "subtitle"),
    Spacer(1, 8*mm),
    P("Um kit individual por equipamento. Depois da primeira preparação, as transferências de empresa são feitas pelo sistema.", "subtitle"),
    P("PARE AO PRIMEIRO ERRO", "h2"),
    P("Se aparecer Script Error, failure ou FAILED, interrompa a instalação e registre a mensagem antes de importar qualquer outro arquivo.", "warn"),

    PageBreak(),
    P("Antes de instalar", "h1"),
    P("A limpeza da RB e a limpeza do cadastro no sistema são ações diferentes. O reset físico não remove a identidade, a atribuição ou o histórico registrados na plataforma.", "warn"),
    P("Se a RB já foi usada, anote sua identidade e MAC. Confira seu registro em Hotspot &gt; Estoque e transferência de RBs antes de criar outro, para não duplicar o mesmo equipamento. Devolva a RB ao estoque quando ela ainda estiver vinculada a uma empresa. O histórico do sistema não é apagado automaticamente.", "body"),
    P("Guarde backup e exportação fora da RB antes de limpar o equipamento. Faça o procedimento presencialmente e mantenha acesso pelo MAC no WinBox.", "body"),
    P("Limpeza física", "h2"),
    P("Para uma limpeza completa dos arquivos e da configuração, reinstale pelo Netinstall sem Keep old configuration. O Netinstall formata o armazenamento e elimina os arquivos do usuário. Não habilite uma configuração antiga ou script antigo após a reinstalação.", "body"),
    P("O reset comum limpa a configuração, mas pode deixar arquivos antigos em Files. Se escolher esse caminho, use:", "body"),
    C("/system reset-configuration no-defaults=yes skip-backup=yes"),
    P("Aguarde reiniciar, conecte-se pelo MAC e conclua as exigências iniciais do RouterOS. O comando acima não formata o armazenamento; não trate esse resultado como uma RB fisicamente nova.", "warn"),

    PageBreak(),
    P("Topologia exigida pelo kit", "h1"),
    P("Verifique o modelo, RouterOS v7 e as portas físicas antes de importar. O kit atual pressupõe:", "body"),
    P("ether1: entrada do provedor, com DHCP.<br/>ether2 e ether3: visitantes, HotSpot na faixa 192.168.88.0/24.<br/>ether4: rede livre na faixa 192.168.89.0/24.<br/>ether5: extensão transparente da WAN do provedor.", "body"),
    P("Se o provedor usa PPPoE, IP fixo ou as portas do equipamento não seguem esse desenho, adapte a preparação antes de executar o kit. Não importe o arquivo esperando que ele detecte outra topologia.", "warn"),
    P("Arquivo necessário", "h2"),
    P("No ManosTech System, abra Hotspot &gt; Estoque e transferência de RBs com perfil administrador ou revenda. Cadastre ou selecione a RB física correta e clique em Kit inicial · uma vez. O arquivo gerado é individual e contém base, ativação RADIUS e heartbeat.", "body"),
    P("Não reutilize o kit de outra RB. Ele contém a identidade e credenciais específicas do equipamento. Guarde-o em local seguro.", "warn"),

    PageBreak(),
    P("Importação única", "h1"),
    P("Envie o arquivo MT-IDENTIDADE-setup.rsc para a raiz de Files no WinBox. No Terminal, substitua pelo nome exato exibido em Files e execute:", "body"),
    C('/import file-name="MT-IDENTIDADE-setup.rsc"'),
    P("Aguarde o prompt retornar sem erro. O arquivo configura bridges, DHCP, HotSpot, RADIUS, regras de rede e o heartbeat a cada 2 minutos (120 segundos).", "body"),
    P("Não importe novamente o kit nem os arquivos de recuperação (Ativação e Heartbeat) na mesma instalação: eles são gerados por RB no sistema, em Hotspot &gt; Monitoramento, e servem apenas para recuperar uma RB já instalada. Também não é necessário enviar login.html ou alogin.html manualmente: a sincronização busca as páginas quando houver internet.", "warn"),
    P("Se a RB não ficar Online", "h2"),
    P("Confira se ether1 recebeu internet por DHCP, se DNS e relógio estão corretos e se o scheduler MANOS-HEARTBEAT está habilitado. Para iniciar uma tentativa manual, execute:", "body"),
    C('/system script run MANOS-HEARTBEAT'),
    C('/log print where message~"Manos Tech"'),
    P("Corrija a conectividade antes de atribuir uma empresa. Não repita a importação às cegas.", "body"),

    PageBreak(),
    P("Atribuição e homologação", "h1"),
    P("No sistema, confirme que a empresa ou filial possui configuração MikroTik salva. Escolha Atribuir destino para essa RB. Se ela estiver Offline, a transferência ficará pendente até voltar a se comunicar.", "body"),
    P("O sistema revoga o vínculo anterior, aplica a nova atribuição e aguarda confirmação da RB. Quando a RB estiver em verificação, conecte um aparelho à rede de visitantes e complete um check-in real. A validação via RADIUS conclui a homologação.", "body"),
    P("Para a próxima empresa, use Transferir / devolver. Não faça novo reset ou importação. Ao atribuir um novo destino, a RB é renomeada automaticamente para a identidade do destino (ex.: MT-NOME-DO-LOCAL); o campo Nova identidade (opcional) permite definir outro nome dentro do padrão MT-XXXXXX.", "ok"),
    P("Conferência opcional da instalação", "h2"),
    P("Se desejar conferir portas, arquivos de login, isolamento e firewall, envie MANOS-POSTFLIGHT.rsc para Files e execute após a RB sincronizar:", "body"),
    C('/import file-name=MANOS-POSTFLIGHT.rsc'),
    P("Confirme a presença de login.html e alogin.html em flash/hotspot e faça um acesso real à internet pelos segmentos esperados.", "body"),

    PageBreak(),
    P("Proteção, backup e manutenção", "h1"),
    P("Após a instalação, com acesso local, aplique a proteção de serviços e gere uma exportação. Esses dois arquivos não substituem o kit individual:", "body"),
    C('/import file-name=MANOS-MANAGEMENT-HARDENING.rsc'),
    C('/import file-name=MANOS-BACKUP-EXPORT.rsc'),
    P("Copie a exportação final de flash para fora da RB. O arquivo de proteção desativa FTP, Telnet, Bandwidth Test, API e API-SSL; mantém WinBox e SSH.", "body"),
    P("MANOS-PREFLIGHT.rsc e MANOS-SECURITY-AUDIT.rsc são diagnósticos. MANOS-ISOLATION-UPDATE.rsc, MANOS-HOTSPOT-FIREWALL-UPDATE.rsc, MANOS-WAN-FIREWALL-UPDATE.rsc e MANOS-INSTALL-HOTSPOT-PAGES.rsc são arquivos de manutenção ou recuperação. Não compõem a instalação padrão pelo kit individual.", "body"),

    PageBreak(),
    P("Monitoramento ManosTech IA (agente IA)", "h1"),
    P("A ManosTech IA é o agente IA da Manos Tech que monitora as RBs de forma proativa. A cada 5 minutos ele coleta CPU, memória, sessões PPPoE, interfaces, temperatura e logs, e envia alertas no Telegram. É somente leitura: nenhuma ação de escrita acontece sem a sua aprovação.", "body"),
    P("Instalador do agente na RB", "h2"),
    P("Baixe o arquivo MANOS-IA-SETUP.rsc no sistema, em Hotspot &gt; Monitoramento. É um arquivo universal: o mesmo em todas as RBs, sem editar nada.", "body"),
    P("Envie o arquivo para a raiz de Files no WinBox. No Terminal, execute:", "body"),
    C('/import file-name=MANOS-IA-SETUP.rsc'),
    P("Na importação, a RB gera o próprio par de chaves WireGuard (a chave privada nunca sai da RB) e se cadastra sozinha na central. Nada é aplicado antes da sua aprovação.", "body"),
    P("Aprove o cadastro no Telegram: chega uma mensagem com os botões Aprovar e Rejeitar. Aprovada, a RB recebe o endereço do túnel e o usuário de leitura, e entra no monitoramento.", "ok"),
    P("Para conferir, execute:", "body"),
    C('/log print where message~"MANOS-IA"'),
    C('/ping 10.77.0.1 count=3'),
    P("Pré-requisitos: RouterOS v7 e RB com saída para a internet. Importe o instalador da ManosTech IA depois do MANOS-MANAGEMENT-HARDENING.rsc.", "warn"),
    P("Referências oficiais", "h2"),
    P("MikroTik: Configuration Management (reset e importação) e Netinstall (reinstalação e formatação do armazenamento).", "small"),
]

doc = SimpleDocTemplate(str(PDF_MAIN), pagesize=A4, leftMargin=18*mm, rightMargin=18*mm, topMargin=32*mm, bottomMargin=21*mm, title="Instalação padrão de RB - Manos Tech", author="Manos Tech")
doc.build(story, onFirstPage=header_footer, onLaterPages=header_footer)
print(PDF_MAIN)
