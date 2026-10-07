from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Image, KeepTogether, PageBreak, Paragraph, SimpleDocTemplate, Spacer

ROOT = Path("public/mikrotik")
LOGO = ROOT / "manos-tech-logo.jpg"
PDF_MAIN = ROOT / "guia-instalacao-mikrotik-manos-tech-v2.pdf"
PDF_ALIAS = ROOT / "guia-instalacao-mikrotik-manos-tech.pdf"

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
    canvas.drawString(18*mm, 11*mm, "Manual revisado em 07/10/2026 - RouterOS v7")
    canvas.drawRightString(192*mm, 11*mm, f"Página {doc.page}")
    canvas.restoreState()


story = [
    Spacer(1, 15*mm),
    Image(str(LOGO), width=58*mm, height=58*mm, hAlign="CENTER"),
    Spacer(1, 8*mm),
    P("Instalação de RB nova ou resetada", "cover"),
    P("MikroTik RouterOS v7 - HotSpot Manos Tech", "subtitle"),
    Spacer(1, 8*mm),
    P("Este manual apresenta um fluxo único e completo para configurar uma RB sem nenhuma configuração anterior.", "subtitle"),
    P("PARE AO PRIMEIRO ERRO", "h2"),
    P("Execute somente um arquivo por vez. Se o Terminal mostrar <b>Script Error</b>, <b>failure</b>, <b>MISSING</b> ou <b>FAILED</b>, não continue. Corrija a etapa e repita sua conferência.", "warn"),
    Spacer(1, 12*mm),
    P("Manutenção de RB já instalada está separada no final. Não use arquivos de atualização durante uma instalação limpa.", "ok"),

    PageBreak(),
    P("Visão geral da instalação", "h1"),
    P("Siga exatamente esta ordem. Não pule a instalação das páginas do HotSpot."),
    P("<b>0.</b> Backup, reset e reconexão local pelo MAC.", "step"),
    P("<b>1.</b> Executar MANOS-PREFLIGHT.rsc após o reset.", "step"),
    P("<b>2.</b> Importar MANOS-HOTSPOT-BASE.rsc.", "step"),
    P("<b>3.</b> Instalar login.html e alogin.html com MANOS-INSTALL-HOTSPOT-PAGES.rsc.", "step"),
    P("<b>4.</b> Importar a Ativação exclusiva da RB.", "step"),
    P("<b>5.</b> Importar o Heartbeat exclusivo da mesma RB.", "step"),
    P("<b>6.</b> Executar MANOS-POSTFLIGHT.rsc e corrigir todos os itens vermelhos.", "step"),
    P("<b>7.</b> Aplicar o endurecimento dos serviços.", "step"),
    P("<b>8.</b> Gerar e guardar a exportação final.", "step"),
    P("Topologia aplicada", "h2"),
    P("<b>ether1:</b> entrada do provedor.<br/><b>ether2 e ether3:</b> visitantes com HotSpot em 192.168.88.0/24.<br/><b>ether4:</b> funcionários em 192.168.89.0/24, com limite total de 60/60 Mbps.<br/><b>ether5:</b> extensão transparente da rede do provedor junto com ether1."),
    P("A instalação deve ser feita localmente pelo WinBox usando o endereço MAC. Não execute o procedimento por acesso remoto nem pela ether5.", "warn"),

    PageBreak(),
    P("0. Backup, reset e reconexão", "h1"),
    P("Antes de apagar a configuração, salve backup e exportação fora da RB. Confirme que existe autorização para reconfigurar o equipamento.", "warn"),
    C("/system reset-configuration no-defaults=yes"),
    P("Confirme o reset no Terminal. Após reiniciar, abra o WinBox, entre em <b>Neighbors</b>, selecione o endereço MAC da RB e conecte. Conclua qualquer aceite de licença ou troca de senha solicitada pelo RouterOS."),
    P("1. Pré-verificação após o reset", "h1"),
    P("Baixe MANOS-PREFLIGHT.rsc no painel, envie para a raiz de <b>Files</b> e execute:"),
    C("/import file-name=MANOS-PREFLIGHT.rsc"),
    P("A saída precisa começar em MANOS-PREFLIGHT|BEGIN|1, terminar em MANOS-PREFLIGHT|END|1 e mostrar ether1 até ether5 como <b>none</b>.", "ok"),
    P("Se ainda aparecer bridge, endereço IP, DHCP, PPPoE ou HotSpot, a RB não está limpa. Pare e revise o reset.", "warn"),

    PageBreak(),
    P("2. Importar o kit-base", "h1"),
    P("Baixe MANOS-HOTSPOT-BASE.rsc, envie para a raiz de Files e execute:"),
    C("/import file-name=MANOS-HOTSPOT-BASE.rsc"),
    P("A importação correta mostra MANOS-HOTSPOT-BASE|BEGIN|2, depois MANOS-HOTSPOT-BASE|END|2 e retorna ao prompt sem Script Error.", "ok"),
    P("O kit cria bridges, DHCP, HotSpot, NAT, isolamento, proteção de entrada, fila da ether4 e a pasta flash/hotspot."),
    P("Conferência rápida", "h2"),
    P("Execute os comandos abaixo <b>separadamente</b>:"),
    C("/interface bridge port print"),
    C("/ip address print"),
    C("/ip hotspot print detail"),
    P("Resultado esperado: ether1/ether5 em bridge-wan; ether2/ether3 em bridge-lan; ether4 em bridge-livre; endereços 192.168.88.1/24 e 192.168.89.1/24; hotspot1 em bridge-lan.", "ok"),

    PageBreak(),
    P("3. Instalar as páginas do HotSpot", "h1"),
    P("Baixe os três arquivos abaixo e envie todos para a raiz de Files:"),
    P("<b>1.</b> login.html", "step"),
    P("<b>2.</b> alogin.html", "step"),
    P("<b>3.</b> MANOS-INSTALL-HOTSPOT-PAGES.rsc", "step"),
    P("Depois execute:"),
    C("/import file-name=MANOS-INSTALL-HOTSPOT-PAGES.rsc"),
    P("A saída obrigatória deve conter as duas confirmações abaixo:", "body"),
    C("MANOS-HOTSPOT-PAGES|LOGIN|INSTALLED"),
    C("MANOS-HOTSPOT-PAGES|ALOGIN|INSTALLED"),
    P("Se aparecer MISSING ou FAILED, envie novamente os três arquivos e repita esta etapa. Não continue para a Ativação.", "warn"),
    P("O perfil hsprof1 utiliza o diretório completo /flash/hotspot. Os arquivos finais precisam existir em flash/hotspot/login.html e flash/hotspot/alogin.html.", "ok"),

    PageBreak(),
    P("4. Importar a Ativação", "h1"),
    P("Na lista de Clientes ativos homologados, localize a RB correta e baixe <b>Ativação</b>. O arquivo é exclusivo daquele equipamento e contém identidade e credenciais RADIUS."),
    C('/import file-name="NOME-EXATO-activation.rsc"'),
    P("Substitua pelo nome exato exibido em Files. Aguarde terminar sem erro antes de continuar.", "ok"),
    P("5. Importar o Heartbeat", "h1"),
    P("Na mesma linha da RB, baixe o Heartbeat e importe somente depois da Ativação:"),
    C('/import file-name="NOME-EXATO-heartbeat.rsc"'),
    P("Confira o script e o agendador com comandos separados:"),
    C('/system script print detail where name="MANOS-HEARTBEAT"'),
    C('/system scheduler print detail where name="MANOS-HEARTBEAT"'),
    P("O scheduler deve estar habilitado e com intervalo de 5 segundos. Aguarde a RB aparecer online no painel.", "ok"),
    P("Se permanecer offline, execute /system script run MANOS-HEARTBEAT e consulte /log print where message~\"Manos Tech\".", "warn"),

    PageBreak(),
    P("6. Conferência pós-instalação", "h1"),
    P("Baixe MANOS-POSTFLIGHT.rsc, envie para Files e execute:"),
    C("/import file-name=MANOS-POSTFLIGHT.rsc"),
    P("Cole no painel a saída completa entre BEGIN e END. A conferência verifica portas, endereços, fila da ether4, RADIUS, HotSpot, login.html, alogin.html, isolamento e firewall."),
    P("Não homologue a RB enquanto existir item vermelho, false ou missing.", "warn"),
    P("Testes físicos obrigatórios", "h2"),
    P("<b>1.</b> Conecte um cliente na rede de visitantes pela ether2 ou ether3.<br/><b>2.</b> Abra uma página HTTP e confirme o redirecionamento.<br/><b>3.</b> Faça cadastro/login e confirme navegação.<br/><b>4.</b> Confira a velocidade aplicada pelo RADIUS.<br/><b>5.</b> Teste a rede de funcionários pela ether4.<br/><b>6.</b> Confirme que o visitante não alcança 192.168.89.0/24 nem a administração da RB."),

    PageBreak(),
    P("7. Endurecimento dos serviços", "h1"),
    P("Conectado localmente pela ether4 ou pelo MAC, envie e importe:"),
    C("/import file-name=MANOS-MANAGEMENT-HARDENING.rsc"),
    P("O arquivo desativa FTP, Telnet, Bandwidth Test, API e API-SSL. WinBox e SSH continuam disponíveis."),
    P("8. Exportação final", "h1"),
    P("Envie e importe:"),
    C("/import file-name=MANOS-BACKUP-EXPORT.rsc"),
    P("Copie a exportação criada em flash para fora da RB e guarde em local seguro.", "ok"),
    P("Conclusão", "h2"),
    P("A instalação termina somente quando o POSTFLIGHT estiver aprovado, os testes físicos forem concluídos, a RB estiver online no painel e a exportação final estiver salva fora do equipamento.", "ok"),

    PageBreak(),
    P("Manutenção de RB já instalada", "h1"),
    P("Os arquivos abaixo não pertencem ao fluxo de uma RB zerada. Não importe o kit-base em uma RB produtiva apenas para corrigir uma função.", "warn"),
    P("<b>MANOS-ISOLATION-UPDATE.rsc</b><br/>Corrige somente o isolamento entre 192.168.88.0/24 e 192.168.89.0/24."),
    P("<b>MANOS-HOTSPOT-FIREWALL-UPDATE.rsc</b><br/>Protege visitantes contra a rede do provedor e os serviços de administração."),
    P("<b>MANOS-WAN-FIREWALL-UPDATE.rsc</b><br/>Protege a entrada pela bridge-wan. Aplique localmente, nunca pela ether5."),
    P("<b>MANOS-SECURITY-AUDIT.rsc</b><br/>Realiza somente leitura de segurança."),
    P("<b>login.html + alogin.html + instalador</b><br/>Restaura as páginas em flash/hotspot."),
    P("Comandos de diagnóstico", "h2"),
    C("/ip dhcp-client print detail"),
    C("/ip route print detail"),
    C("/radius print detail"),
    C("/ip hotspot active print detail"),
    C('/log print where message~"radius|hotspot|Manos Tech|failure"'),
    P("Referência: documentação oficial MikroTik de Configuration Management, First Time Configuration, Files e HotSpot Captive Portal.", "small"),
]

doc = SimpleDocTemplate(str(PDF_MAIN), pagesize=A4, leftMargin=18*mm, rightMargin=18*mm, topMargin=32*mm, bottomMargin=21*mm, title="Instalação de RB nova ou resetada - Manos Tech", author="Manos Tech")
doc.build(story, onFirstPage=header_footer, onLaterPages=header_footer)
PDF_ALIAS.write_bytes(PDF_MAIN.read_bytes())
print(PDF_MAIN)
print(PDF_ALIAS)
