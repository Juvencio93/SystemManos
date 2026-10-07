from pathlib import Path
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

OUT = Path("public/mikrotik")
PDF_V2 = OUT / "guia-instalacao-mikrotik-manos-tech-v2.pdf"
PDF_ALIAS = OUT / "guia-instalacao-mikrotik-manos-tech.pdf"
styles = getSampleStyleSheet()
styles.add(ParagraphStyle(name="Cover", parent=styles["Title"], textColor=colors.HexColor("#075985"), fontSize=24, leading=29, spaceAfter=8))
styles.add(ParagraphStyle(name="Sub", parent=styles["BodyText"], textColor=colors.HexColor("#475569"), fontSize=11, leading=16, spaceAfter=10))
styles.add(ParagraphStyle(name="H1x", parent=styles["Heading1"], textColor=colors.HexColor("#075985"), fontSize=18, leading=22, spaceBefore=4, spaceAfter=9))
styles.add(ParagraphStyle(name="H2x", parent=styles["Heading2"], textColor=colors.HexColor("#0e7490"), fontSize=13, leading=17, spaceBefore=9, spaceAfter=5))
styles.add(ParagraphStyle(name="Bodyx", parent=styles["BodyText"], fontSize=9.6, leading=13.5, spaceAfter=5))
styles.add(ParagraphStyle(name="Small", parent=styles["BodyText"], textColor=colors.HexColor("#475569"), fontSize=8.3, leading=11.5, spaceAfter=4))
styles.add(ParagraphStyle(name="CodeX", parent=styles["Code"], fontName="Courier", fontSize=8.1, leading=11, backColor=colors.HexColor("#eef2f7"), borderColor=colors.HexColor("#cbd5e1"), borderWidth=.5, borderPadding=7, spaceBefore=4, spaceAfter=7))
styles.add(ParagraphStyle(name="WarnX", parent=styles["BodyText"], fontSize=9.5, leading=13.5, textColor=colors.HexColor("#9a3412"), backColor=colors.HexColor("#fff7ed"), borderColor=colors.HexColor("#fb923c"), borderWidth=1, borderPadding=8, spaceBefore=5, spaceAfter=8))
styles.add(ParagraphStyle(name="OkX", parent=styles["BodyText"], fontSize=9.5, leading=13.5, textColor=colors.HexColor("#065f46"), backColor=colors.HexColor("#ecfdf5"), borderColor=colors.HexColor("#34d399"), borderWidth=1, borderPadding=8, spaceBefore=5, spaceAfter=8))

def footer(canvas, doc):
    canvas.saveState(); canvas.setStrokeColor(colors.HexColor("#cbd5e1")); canvas.line(18*mm, 16*mm, 192*mm, 16*mm)
    canvas.setFont("Helvetica", 7.5); canvas.setFillColor(colors.HexColor("#64748b"))
    canvas.drawString(18*mm, 11*mm, "Manos Tech - Instalação MikroTik HotSpot - revisão 07/10/2026")
    canvas.drawRightString(192*mm, 11*mm, f"Página {doc.page}"); canvas.restoreState()

def p(text, style="Bodyx"): return Paragraph(text, styles[style])
def command(text): return Paragraph(text, styles["CodeX"])
def checklist(rows):
    data = [[p("Etapa", "Small"), p("Arquivo ou ação", "Small"), p("Pode avançar quando", "Small")]]
    data += [[p(a, "Small"), p(b, "Small"), p(c, "Small")] for a, b, c in rows]
    table = Table(data, colWidths=[23*mm, 65*mm, 84*mm], repeatRows=1)
    table.setStyle(TableStyle([("BACKGROUND", (0,0), (-1,0), colors.HexColor("#e0f2fe")), ("TEXTCOLOR", (0,0), (-1,0), colors.HexColor("#075985")), ("GRID", (0,0), (-1,-1), .4, colors.HexColor("#cbd5e1")), ("VALIGN", (0,0), (-1,-1), "TOP"), ("LEFTPADDING", (0,0), (-1,-1), 6), ("RIGHTPADDING", (0,0), (-1,-1), 6), ("TOPPADDING", (0,0), (-1,-1), 5), ("BOTTOMPADDING", (0,0), (-1,-1), 5)]))
    return table

story = [
 p("Instalação de RB nova ou resetada", "Cover"), p("MikroTik RouterOS v7 - HotSpot Manos Tech", "Sub"),
 p("Este manual descreve um único fluxo completo para uma RB sem configuração. Arquivos de manutenção de RB antiga aparecem somente no final e não fazem parte da instalação nova."),
 p("REGRA PRINCIPAL", "H2x"), p("Execute um arquivo por vez e leia toda a saída do Terminal. Se aparecer <b>Script Error</b>, <b>failure</b>, <b>MISSING</b> ou <b>FAILED</b>, pare. Não importe a etapa seguinte até corrigir a atual.", "WarnX"),
 p("Ordem obrigatória", "H2x"), checklist([
  ("0", "Backup, reset e reconexão por MAC", "A RB reiniciou e o WinBox conectou pelo MAC"),
  ("1", "MANOS-PREFLIGHT.rsc", "ether1 a ether5 aparecem como none"),
  ("2", "MANOS-HOTSPOT-BASE.rsc", "Terminou sem Script Error"),
  ("3", "login.html, alogin.html e instalador", "LOGIN e ALOGIN retornam INSTALLED"),
  ("4", "Arquivo exclusivo *-activation.rsc", "Ativação terminou sem erro"),
  ("5", "Arquivo exclusivo *-heartbeat.rsc", "Scheduler MANOS-HEARTBEAT ativo"),
  ("6", "MANOS-POSTFLIGHT.rsc", "Todos os itens obrigatórios confirmados"),
  ("7", "MANOS-MANAGEMENT-HARDENING.rsc", "Serviços desnecessários desativados"),
  ("8", "MANOS-BACKUP-EXPORT.rsc", "Exportação copiada para fora da RB"),
 ]), Spacer(1, 4*mm), p("Topologia aplicada", "H2x"),
 p("<b>ether1:</b> entrada do provedor. <b>ether2 e ether3:</b> visitantes com HotSpot em 192.168.88.0/24. <b>ether4:</b> funcionários em 192.168.89.0/24, limitada a 60/60 Mbps. <b>ether5:</b> extensão transparente da rede do provedor junto com ether1; não recebe DHCP, HotSpot ou NAT privado da RB."),
 PageBreak(), p("0. Backup, reset e acesso local", "H1x"),
 p("Use este procedimento somente com autorização para apagar a configuração. Salve antes um backup/export fora da RB. Mantenha um computador conectado localmente e use WinBox por MAC; não faça a instalação por acesso remoto ou pela ether5.", "WarnX"),
 command("/system reset-configuration no-defaults=yes"),
 p("Após reiniciar, abra WinBox, selecione a RB pela aba Neighbors usando o endereço MAC e conecte. Se o RouterOS solicitar aceite de licença ou troca de senha, conclua antes de enviar os arquivos."),
 p("1. Pré-verificação após o reset", "H1x"), p("Baixe <b>MANOS-PREFLIGHT.rsc</b>, envie para a raiz de <b>Files</b> e execute:"), command("/import file-name=MANOS-PREFLIGHT.rsc"),
 p("A saída deve começar em <b>MANOS-PREFLIGHT|BEGIN|1</b>, terminar em <b>MANOS-PREFLIGHT|END|1</b> e mostrar ether1 a ether5 como <b>none</b>. Se ainda houver bridge, IP, DHCP, PPPoE ou HotSpot, pare e revise o reset.", "OkX"),
 p("Confirmações", "H2x"), p("- O provedor entrega IP por DHCP.<br/>- O cabo do provedor será ligado na ether1.<br/>- ether5 pode compartilhar a rede do provedor.<br/>- Você continua conectado localmente pelo MAC.<br/>- Os arquivos foram baixados novamente do painel atual."),
 PageBreak(), p("2. Instalar o kit-base", "H1x"), p("Baixe <b>MANOS-HOTSPOT-BASE.rsc</b>, envie para a raiz de Files e execute somente este comando:"), command("/import file-name=MANOS-HOTSPOT-BASE.rsc"),
 p("Aguarde o Terminal voltar ao prompt. Não avance se aparecer erro. O kit cria bridges, DHCP, HotSpot, NAT, isolamento, proteção da RB, fila da ether4 e a pasta flash/hotspot."),
 p("Verificação rápida", "H2x"), command("/interface bridge port print\n/ip address print\n/ip hotspot print detail"), p("Execute cada linha separadamente. O esperado é ether1/ether5 em bridge-wan, ether2/ether3 em bridge-lan, ether4 em bridge-livre, endereços 192.168.88.1/24 e 192.168.89.1/24 e hotspot1 em bridge-lan.", "OkX"),
 p("3. Instalar login.html e alogin.html", "H1x"), p("Baixe <b>login.html</b>, <b>alogin.html</b> e <b>MANOS-INSTALL-HOTSPOT-PAGES.rsc</b>. Envie os três para a raiz de Files e execute:"), command("/import file-name=MANOS-INSTALL-HOTSPOT-PAGES.rsc"),
 p("A saída obrigatória é:<br/><b>MANOS-HOTSPOT-PAGES|LOGIN|INSTALLED</b><br/><b>MANOS-HOTSPOT-PAGES|ALOGIN|INSTALLED</b><br/>Se aparecer MISSING ou FAILED, envie novamente os três arquivos e repita esta etapa.", "OkX"),
 p("O perfil hsprof1 usa o caminho completo <b>/flash/hotspot</b>. As páginas devem existir como flash/hotspot/login.html e flash/hotspot/alogin.html."),
 PageBreak(), p("4. Importar a Ativação exclusiva", "H1x"), p("No painel, localize a RB correta em Clientes ativos homologados e baixe <b>Ativação</b>. Esse arquivo contém a identidade e as credenciais RADIUS daquela RB; não reutilize em outro equipamento."), command('/import file-name="NOME-EXATO-activation.rsc"'), p("Use o nome exato mostrado em Files. A Ativação exige hotspot1 e hsprof1 criados pelo kit-base."),
 p("5. Importar o Heartbeat exclusivo", "H1x"), p("Baixe o <b>Heartbeat</b> da mesma linha e importe somente após a Ativação concluir:"), command('/import file-name="NOME-EXATO-heartbeat.rsc"'),
 p("Confirme script e agendador, um comando por vez:"), command('/system script print detail where name="MANOS-HEARTBEAT"\n/system scheduler print detail where name="MANOS-HEARTBEAT"'), p("O scheduler deve estar habilitado com intervalo de 5 segundos. Aguarde a RB aparecer online no painel.", "OkX"),
 p("Se não ficar online", "H2x"), p("Confira IP e rota na bridge-wan, relógio da RB e execute <b>/system script run MANOS-HEARTBEAT</b>. Depois consulte <b>/log print where message~\"Manos Tech\"</b>."),
 PageBreak(), p("6. Conferência obrigatória", "H1x"), p("Baixe <b>MANOS-POSTFLIGHT.rsc</b>, envie para Files e execute:"), command("/import file-name=MANOS-POSTFLIGHT.rsc"),
 p("Cole no painel a saída completa entre BEGIN e END. A conferência verifica portas, endereços, fila da ether4, RADIUS, HotSpot, os dois HTMLs, isolamento, proteção do visitante e firewall da WAN."), p("Não homologue a RB se houver item obrigatório false, missing ou aviso vermelho. Corrija a etapa indicada e execute o POSTFLIGHT novamente.", "WarnX"),
 p("Testes físicos obrigatórios", "H2x"), p("1. Conecte um cliente pela rede de visitantes em ether2 ou ether3.<br/>2. Abra uma página HTTP e confirme o redirecionamento.<br/>3. Faça cadastro/login e confirme navegação.<br/>4. Confira a velocidade aplicada pelo RADIUS.<br/>5. Teste a rede de funcionários pela ether4.<br/>6. Confirme que visitante não alcança 192.168.89.0/24 nem a administração da RB."),
 p("7. Endurecimento", "H1x"), p("Conectado localmente pela ether4 ou MAC, importe o endurecimento. Ele desativa FTP, Telnet, Bandwidth Test, API e API-SSL e mantém WinBox e SSH."), command("/import file-name=MANOS-MANAGEMENT-HARDENING.rsc"),
 p("8. Exportação final", "H1x"), p("Importe o arquivo e copie a exportação criada em flash para fora da RB."), command("/import file-name=MANOS-BACKUP-EXPORT.rsc"),
 PageBreak(), p("Manutenção de RB já instalada", "H1x"), p("Esta seção não pertence à instalação de uma RB zerada. Não use o kit-base em uma RB produtiva apenas para corrigir uma regra.", "WarnX"),
 checklist([
  ("Isolamento", "MANOS-ISOLATION-UPDATE.rsc", "Corrigir somente isolamento .88 x .89"),
  ("Visitantes", "MANOS-HOTSPOT-FIREWALL-UPDATE.rsc", "Bloquear provedor e administração"),
  ("WAN", "MANOS-WAN-FIREWALL-UPDATE.rsc", "Proteger bridge-wan; aplicar localmente"),
  ("Páginas", "HTMLs + instalador", "Restaurar flash/hotspot"),
  ("Auditoria", "MANOS-SECURITY-AUDIT.rsc", "Somente leitura"),
 ]),
 p("Diagnóstico", "H2x"), command('/ip dhcp-client print detail\n/ip route print detail\n/radius print detail\n/ip hotspot active print detail\n/system script run MANOS-HEARTBEAT\n/log print where message~"radius|hotspot|Manos Tech|failure"'),
 p("Referência técnica", "H2x"), p("O fluxo segue as operações documentadas no RouterOS v7: reset sem configuração padrão, conexão local por MAC, diretório completo do HotSpot em /flash/hotspot e cópia de arquivos com /file copy. Consulte a documentação oficial MikroTik de Configuration Management, First Time Configuration, Files e HotSpot Captive Portal."),
]

doc = SimpleDocTemplate(str(PDF_V2), pagesize=A4, rightMargin=18*mm, leftMargin=18*mm, topMargin=16*mm, bottomMargin=21*mm, title="Instalação de RB nova ou resetada - Manos Tech", author="Manos Tech")
doc.build(story, onFirstPage=footer, onLaterPages=footer)
PDF_ALIAS.write_bytes(PDF_V2.read_bytes())
print(PDF_V2); print(PDF_ALIAS)
