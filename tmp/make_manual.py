from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak, Table, TableStyle
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase import pdfmetrics
from pathlib import Path

out = Path('output/pdf'); out.mkdir(parents=True, exist_ok=True)
pdf = out / 'manual-configuracao-rb-mikrotik-manos-tech.pdf'
styles = getSampleStyleSheet()
styles.add(ParagraphStyle(name='TitleBlue', parent=styles['Title'], textColor=colors.HexColor('#075985'), fontSize=22, leading=27, spaceAfter=12))
styles.add(ParagraphStyle(name='H', parent=styles['Heading2'], textColor=colors.HexColor('#075985'), fontSize=14, leading=18, spaceBefore=10, spaceAfter=6))
styles.add(ParagraphStyle(name='Body2', parent=styles['BodyText'], fontSize=10.5, leading=15, spaceAfter=6))
styles.add(ParagraphStyle(name='Code2', parent=styles['Code'], fontName='Courier', fontSize=8.5, leading=12, backColor=colors.HexColor('#eef2f7'), borderPadding=7, spaceBefore=5, spaceAfter=8))

def footer(canvas, doc):
    canvas.saveState(); canvas.setFont('Helvetica', 8); canvas.setFillColor(colors.grey)
    canvas.drawString(18*mm, 12*mm, 'Manos Tech - Configuracao MikroTik HotSpot')
    canvas.drawRightString(192*mm, 12*mm, f'Pagina {doc.page}')
    canvas.restoreState()

story = [Paragraph('Configuracao do HotSpot MikroTik', styles['TitleBlue']), Paragraph('Passo a passo para a RB cadastrada no sistema Manos Tech', styles['Body2']), Spacer(1, 5*mm)]
story += [Paragraph('Antes de iniciar', styles['H']), Paragraph('No menu Hotspot, confirme que a RB aparece em <b>Clientes ativos homologados</b> com a identidade MT-EFRAIM e o MAC correto. Baixe o arquivo pelo botao <b>Ativacao</b>. Baixe tambem o kit-base, login.html e alogin.html. Nao use o arquivo de ativacao generico.', styles['Body2'])]
story += [Paragraph('1. Resetar a RB', styles['H']), Paragraph('Conecte-se pelo WinBox e abra o terminal. O reset apaga a configuracao atual.', styles['Body2']), Paragraph('/system reset-configuration no-defaults=yes skip-backup=yes', styles['Code2']), Paragraph('Confirme o reset e aguarde a RB reiniciar.', styles['Body2'])]
story += [Paragraph('2. Entrar novamente pelo WinBox', styles['H']), Paragraph('Depois do reinicio, conecte pelo endereco MAC. Entre como admin, defina uma senha forte e abra o menu <b>Files</b>.', styles['Body2'])]
story += [Paragraph('3. Resetar os arquivos HTML do Hotspot', styles['H']), Paragraph('Depois de o kit-base criar o perfil hsprof1, abra WinBox &gt; IP &gt; Hotspot &gt; Server Profiles, selecione hsprof1 e use <b>Reset HTML</b>. Isso recria a pasta flash/hotspot e todos os arquivos auxiliares padrão do RouterOS.', styles['Body2'])]
story += [Paragraph('4. Topologia das portas', styles['H']), Paragraph('<b>ether1</b> recebe a entrada do provedor. <b>ether2 e ether3</b> ficam no HotSpot para visitantes. <b>ether4</b> fica na rede livre dos funcionarios em 192.168.89.0/24. <b>ether5</b> fica na mesma rede de camada 2 do provedor, como extensao direta da ether1, sem HotSpot, DHCP ou NAT privado da RB. A faixa de IP da ether5 nao e fixa: ela vem do provedor.', styles['Body2'])]
story += [Paragraph('5. Enviar os arquivos', styles['H']), Paragraph('Envie MANOS-HOTSPOT-BASE.rsc, o arquivo de Ativacao e o arquivo de Heartbeat para a raiz da RB. Depois substitua somente flash/hotspot/login.html e flash/hotspot/alogin.html pelos arquivos personalizados.', styles['Body2'])]
story += [Paragraph('5. Importar o kit-base', styles['H']), Paragraph('/import file-name=MANOS-HOTSPOT-BASE.rsc', styles['Code2']), Paragraph('Aguarde o terminal terminar sem interromper.', styles['Body2'])]
story += [Paragraph('6. Importar a ativacao personalizada', styles['H']), Paragraph('/import file-name=NOME-EXATO-DA-ATIVACAO.rsc', styles['Code2']), Paragraph('Use o nome exato do arquivo baixado no botao Ativacao.', styles['Body2'])]
story += [Paragraph('7. Importar o heartbeat', styles['H']), Paragraph('/import file-name=NOME-EXATO-DO-HEARTBEAT.rsc', styles['Code2']), Paragraph('Use o nome exato do arquivo baixado no botao Heartbeat. A versao atual cria o scheduler com intervalo de 30 segundos.', styles['Body2']), PageBreak()]
story += [Paragraph('8. Validar a rede antes do RADIUS', styles['H']), Paragraph('/ip address print<br/>/ip route print<br/>/interface bridge port print', styles['Code2']), Paragraph('A bridge-wan deve receber o IP e a rota default do provedor. A ether5 deve aparecer em bridge-wan, sem IP privado proprio. A bridge-livre deve conter somente a ether4 e usar 192.168.89.1/24.', styles['Body2'])]
story += [Paragraph('9. Conferir a configuracao HotSpot e RADIUS', styles['H']), Paragraph('/system identity print<br/>/ip hotspot print detail<br/>/ip hotspot profile print detail<br/>/radius print detail', styles['Code2']), Paragraph('Confirme a identidade, hsprof1 com use-radius=yes, o servidor RADIUS ***REMOVED*** e o servidor hotspot1 com idle-timeout=none, keepalive-timeout=none e login-timeout=none. Assim, tempo e inatividade ficam sob controle exclusivo dos atributos RADIUS definidos na politica do cliente.', styles['Body2'])]
story += [Paragraph('10. Confirmar os arquivos do portal', styles['H']), Paragraph('/file print<br/>/system scheduler print detail', styles['Code2']), Paragraph('Confirme os arquivos em flash/hotspot e o scheduler MANOS-HEARTBEAT sem a flag X.', styles['Body2'])]
story += [Paragraph('11. Verificar no painel e testar', styles['H']), Paragraph('Atualize o menu Hotspot. Conecte um visitante nas ether2 ou ether3; o portal deve abrir automaticamente. Teste a ether4 separadamente como rede livre. Use a ether5 somente para equipamentos que precisam permanecer na rede do provedor. O cadastro só e confirmado depois da aceitacao RADIUS e da liberacao da internet.', styles['Body2'])]
story += [Paragraph('Comandos de diagnostico', styles['H']), Paragraph('/radius monitor [find address=***REMOVED***] once<br/>/ip hotspot active print detail<br/>/log print where message~"radius|hotspot|login|failure"', styles['Code2'])]
story += [Paragraph('Importante', styles['H']), Paragraph('Se o monitor mostrar timeouts ou bad-replies, nao repita o cadastro do visitante. Pare o teste e envie a tela do monitor para diagnostico. O status do painel so muda para online quando o heartbeat real chegar.', styles['Body2'])]
SimpleDocTemplate(str(pdf), pagesize=A4, rightMargin=18*mm, leftMargin=18*mm, topMargin=16*mm, bottomMargin=20*mm, title='Configuracao HotSpot MikroTik Manos Tech').build(story, onFirstPage=footer, onLaterPages=footer)
print(pdf)
