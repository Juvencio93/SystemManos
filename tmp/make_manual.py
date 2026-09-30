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
story += [Paragraph('3. Resetar os arquivos HTML do Hotspot', styles['H']), Paragraph('Antes de enviar os arquivos personalizados, abra WinBox &gt; IP &gt; Hotspot &gt; Server Profiles, selecione hsprof1 e use <b>Reset HTML</b>. Isso recria a pasta flash/hotspot e todos os arquivos auxiliares padrão do RouterOS.', styles['Body2']), Paragraph('4. Enviar os arquivos', styles['H']), Paragraph('Envie para a raiz da RB: MANOS-HOTSPOT-BASE.rsc e o arquivo baixado em Ativacao. Depois substitua somente flash/hotspot/login.html e flash/hotspot/alogin.html pelos arquivos personalizados.', styles['Body2'])]
story += [Paragraph('4. Importar o kit-base', styles['H']), Paragraph('/import file-name=MANOS-HOTSPOT-BASE.rsc', styles['Code2']), Paragraph('Aguarde o terminal terminar sem interromper.', styles['Body2'])]
story += [Paragraph('5. Importar a ativacao personalizada', styles['H']), Paragraph('/import file-name=NOME-EXATO-DO-ARQUIVO.rsc', styles['Code2']), Paragraph('Substitua pelo nome exato do arquivo baixado no botao Ativacao.', styles['Body2']), PageBreak()]
story += [Paragraph('6. Validar a rede antes do RADIUS', styles['H']), Paragraph('/ip address print<br/>/ip route print<br/>/interface print', styles['Code2']), Paragraph('A ether1 deve estar ativa, com IP do provedor e rota default 0.0.0.0/0. Sem rota, a RB nao alcancara o RADIUS. Confirme tambem o cabo de internet na ether1.', styles['Body2'])]
story += [Paragraph('7. Conferir a configuracao HotSpot e RADIUS', styles['H']), Paragraph('/system identity print<br/>/ip hotspot profile print detail<br/>/radius print detail', styles['Code2']), Paragraph('Confirme a identidade MT-EFRAIM, a existencia do perfil hsprof1 com use-radius=yes e o servidor RADIUS ***REMOVED***. Se aparecer connect:Network unreachable, volte ao passo 6.', styles['Body2'])]
story += [Paragraph('7. Confirmar os arquivos do portal', styles['H']), Paragraph('/file print', styles['Code2']), Paragraph('Confirme que flash/hotspot/login.html e flash/hotspot/alogin.html existem.', styles['Body2'])]
story += [Paragraph('8. Verificar no painel', styles['H']), Paragraph('Volte ao menu Hotspot e clique em <b>Atualizar dados</b>. A RB deve aparecer como pendente/offline até enviar o primeiro heartbeat. Depois da importacao e do agendamento, o status deve mostrar a ultima comunicacao, IP e versao RouterOS.', styles['Body2'])]
story += [Paragraph('9. Teste do portal', styles['H']), Paragraph('Conecte um celular ao Wi-Fi de visitantes. O navegador deve abrir o portal de check-in. Preencha os dados e envie. O cadastro so deve ser confirmado depois que a autorizacao RADIUS for aceita e a internet for liberada.', styles['Body2'])]
story += [Paragraph('Comandos de diagnostico', styles['H']), Paragraph('/radius monitor [find address=***REMOVED***] once<br/>/ip hotspot active print detail<br/>/log print where message~"radius|hotspot|login|failure"', styles['Code2'])]
story += [Paragraph('Importante', styles['H']), Paragraph('Se o monitor mostrar timeouts ou bad-replies, nao repita o cadastro do visitante. Pare o teste e envie a tela do monitor para diagnostico. O status do painel so muda para online quando o heartbeat real chegar.', styles['Body2'])]
SimpleDocTemplate(str(pdf), pagesize=A4, rightMargin=18*mm, leftMargin=18*mm, topMargin=16*mm, bottomMargin=20*mm, title='Configuracao HotSpot MikroTik Manos Tech').build(story, onFirstPage=footer, onLaterPages=footer)
print(pdf)
