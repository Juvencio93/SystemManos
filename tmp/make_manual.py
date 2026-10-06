from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, KeepTogether, PageBreak
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase import pdfmetrics
from pathlib import Path

out = Path('output/pdf'); out.mkdir(parents=True, exist_ok=True)
pdf = Path('public/mikrotik/guia-instalacao-mikrotik-manos-tech-v2.pdf')
styles = getSampleStyleSheet()
styles.add(ParagraphStyle(name='TitleBlue', parent=styles['Title'], textColor=colors.HexColor('#075985'), fontSize=22, leading=27, spaceAfter=12))
styles.add(ParagraphStyle(name='H', parent=styles['Heading2'], textColor=colors.HexColor('#075985'), fontSize=14, leading=18, spaceBefore=10, spaceAfter=6))
styles.add(ParagraphStyle(name='Body2', parent=styles['BodyText'], fontSize=10, leading=14, spaceAfter=5))
styles.add(ParagraphStyle(name='Code2', parent=styles['Code'], fontName='Courier', fontSize=8.5, leading=12, backColor=colors.HexColor('#eef2f7'), borderPadding=7, spaceBefore=5, spaceAfter=8))
styles.add(ParagraphStyle(name='Warning', parent=styles['BodyText'], fontSize=10.5, leading=15, textColor=colors.HexColor('#9a3412'), backColor=colors.HexColor('#fff7ed'), borderColor=colors.HexColor('#fb923c'), borderWidth=1, borderPadding=8, spaceBefore=5, spaceAfter=8))

def footer(canvas, doc):
    canvas.saveState(); canvas.setFont('Helvetica', 8); canvas.setFillColor(colors.grey)
    canvas.drawString(18*mm, 12*mm, 'Manos Tech - Configuração MikroTik HotSpot')
    canvas.drawRightString(192*mm, 12*mm, f'Página {doc.page}')
    canvas.restoreState()

def command_step(label, command):
    return [Paragraph(label, styles['Body2']), Paragraph(command, styles['Code2'])]

story = [Paragraph('Configuração do HotSpot MikroTik', styles['TitleBlue']), Paragraph('Passo a passo para a RB cadastrada no sistema Manos Tech', styles['Body2']), Spacer(1, 5*mm)]
story += [Paragraph('Antes de iniciar', styles['H']), Paragraph('Confirme a RB e a identidade cadastrada no painel. Antes de qualquer reset, faça backup/export da configuração e confirme que a unidade pode ser reconfigurada: o reset apaga configurações existentes e não é necessário para atualizar uma RB já preparada.', styles['Body2'])]
story += [Paragraph('Ordem correta dos arquivos', styles['H']), Paragraph('<b>1. MANOS-PREFLIGHT.rsc:</b> diagnóstico padrão, sem alteração. <b>2. MANOS-HOTSPOT-BASE.rsc:</b> instalação inicial para RB nova aprovada no diagnóstico. <b>3. Ativação:</b> arquivo exclusivo da RB, com identidade e RADIUS. <b>4. Heartbeat:</b> arquivo exclusivo da RB, com telemetria a cada 5 segundos. <b>5. MANOS-POSTFLIGHT.rsc:</b> conferência padrão, sem alteração. Esta é a ordem de instalação.', styles['Body2']), Paragraph('<b>Arquivos padrão:</b> Pré-verificação, Kit-base, Atualização de isolamento, Proteção do HotSpot, Proteção WAN, Conferência, login.html e alogin.html. <b>Arquivos exclusivos:</b> Ativação e Heartbeat, baixados na linha da RB correta. Nunca reutilize Ativação ou Heartbeat em outra empresa, filial ou RB.', styles['Warning'])]
story += [Paragraph('1. Preparar acesso e backup', styles['H']), Paragraph('Use RouterOS v7 atualizado e WinBox por MAC em uma rede local. Salve um backup pelo WinBox e exporte a configuração atual. Se for uma RB reutilizada, identifique pontes, DHCP, endereços, firewall e serviços existentes antes de importar o kit; não apague a configuração sem janela de manutenção e autorização do responsável.', styles['Body2'])]
story += [Paragraph('2. Reset (somente RB nova/autorizada)', styles['H']), Paragraph('Este comando é destrutivo. Use somente após salvar o backup e confirmar que a configuração atual pode ser apagada. Prefira confirmar a operação manualmente no prompt do RouterOS.', styles['Body2']), Paragraph('/system reset-configuration no-defaults=yes', styles['Code2']), Paragraph('Após reiniciar, reconecte pelo endereço MAC, defina senha forte e mantenha a sessão local de recuperação disponível.', styles['Body2'])]
story += [Paragraph('3. Separar os arquivos corretos', styles['H']), Paragraph('Use somente o Kit-base e os arquivos personalizados de Ativação e Heartbeat baixados agora para esta RB. login.html e alogin.html são arquivos padrão de recuperação: a sincronização normal os atualiza automaticamente e eles só devem ser enviados manualmente para flash/hotspot quando for necessário restaurar a página. manos-command.rsc e manos-login-v3.marker são internos e automáticos; não copie nem reutilize esses arquivos.', styles['Body2'])]
story += [Paragraph('4. Topologia das portas', styles['H']), Paragraph('<b>ether1</b> recebe a entrada do provedor. <b>ether2 e ether3</b> ficam no HotSpot para visitantes. <b>ether4</b> fica na rede livre dos funcionários em 192.168.89.0/24. <b>ether5</b> fica na mesma rede de camada 2 do provedor, como extensão direta da ether1, sem HotSpot, DHCP ou NAT privado da RB. A faixa de IP da ether5 não é fixa: ela vem do provedor.', styles['Body2'])]
story += [Paragraph('5. Enviar arquivos e importar o kit-base', styles['H']), Paragraph('Envie MANOS-HOTSPOT-BASE.rsc e os arquivos personalizados de Ativação e Heartbeat para a raiz da RB. Importe primeiro o kit-base. Os HTMLs não fazem parte da etapa normal: a sincronização os atualiza automaticamente.', styles['Body2']), Paragraph('/import file-name=MANOS-HOTSPOT-BASE.rsc', styles['Code2']), Paragraph('Aguarde o terminal concluir e confira erros antes de prosseguir. Não avance se houver erro de importação.', styles['Body2'])]
story += [KeepTogether([Paragraph('6. Importar ativação e heartbeat personalizados', styles['H']), Paragraph('<b>ATENÇÃO — não cole os dois comandos juntos.</b> Importe a Ativação, aguarde o terminal finalizar sem erros e só então importe o Heartbeat. Cada arquivo é aplicado em uma etapa separada.', styles['Warning']), Paragraph('6.1 Ativação personalizada', styles['H']), Paragraph('/import file-name=NOME-EXATO-DA-ATIVACAO.rsc', styles['Code2']), Paragraph('A ativação configura a identidade e o RADIUS. Aguarde a conclusão antes de seguir.', styles['Body2']), Paragraph('6.2 Heartbeat personalizado', styles['H']), Paragraph('/import file-name=NOME-EXATO-DO-HEARTBEAT.rsc', styles['Code2']), Paragraph('O heartbeat cria/atualiza o script MANOS-HEARTBEAT e o scheduler de 5 segundos. Use os arquivos baixados agora para a identidade desta RB. Eles contêm credenciais operacionais: não os compartilhe nem os reutilize em outra RB.', styles['Body2'])])]
story += [Paragraph('7. Validar a rede antes do RADIUS', styles['H']), Paragraph('<b>Execute cada comando abaixo individualmente.</b> Aguarde o resultado de um comando antes de enviar o próximo.', styles['Warning'])]
story += command_step('7.1 Conferir endereços IP', '/ip address print')
story += command_step('7.2 Conferir rota do provedor', '/ip route print')
story += command_step('7.3 Conferir as portas nas bridges', '/interface bridge port print')
story += [Paragraph('A bridge-wan deve receber o IP e a rota default do provedor. A ether5 deve aparecer em bridge-wan, sem IP privado próprio. A bridge-livre deve conter somente a ether4 e usar 192.168.89.1/24.', styles['Body2'])]
story += [Paragraph('8. Conferir HotSpot, RADIUS e heartbeat', styles['H']), Paragraph('<b>Execute cada comando abaixo individualmente.</b> São comandos de consulta e não alteram a RB.', styles['Warning'])]
story += command_step('8.1 Conferir a identidade', '/system identity print')
story += command_step('8.2 Conferir o HotSpot', '/ip hotspot print detail')
story += command_step('8.3 Conferir o perfil do HotSpot', '/ip hotspot profile print detail')
story += command_step('8.4 Conferir o RADIUS', '/radius print detail')
story += command_step('8.5 Conferir o script do heartbeat', '/system script print detail where name="MANOS-HEARTBEAT"')
story += command_step('8.6 Conferir o agendador do heartbeat', '/system scheduler print detail where name="MANOS-HEARTBEAT"')
story += [Paragraph('Confirme a identidade correta, use-radius=yes, timeouts sem limite local e scheduler habilitado em 5s. O host/segredo RADIUS são personalizados no servidor; não fixe um IP neste manual. O sistema aplica os limites de sessão e velocidade salvos para a empresa/filial.', styles['Body2'])]
story += [Paragraph('9. Verificar no painel e testar', styles['H']), Paragraph('Aguarde o primeiro heartbeat, confira comunicação e versão da RB no painel e teste portal e internet em ether2/ether3. Valide a rede livre em ether4 (192.168.89.0/24). A ether5 é uma extensão bridge da rede do provedor junto com ether1; não recebe a faixa 192.168.89.0/24 da RB. O bloqueio gerenciado afeta as redes roteadas .88/.89, não a bridge transparente ether5.', styles['Body2'])]
story += [Paragraph('9.1 RB já instalada e funcionando', styles['H']), Paragraph('Não importe o Kit-base novamente em uma RB já instalada somente para corrigir uma função. Use MANOS-ISOLATION-UPDATE.rsc apenas quando precisar criar ou corrigir o isolamento entre 192.168.88.0/24 e 192.168.89.0/24. Esse arquivo não altera WAN, ether5, DHCP, HotSpot, RADIUS, NAT ou filas.', styles['Body2']), Paragraph('/import file-name=MANOS-ISOLATION-UPDATE.rsc', styles['Code2']), Paragraph('Para impedir visitantes de alcançar a faixa do provedor (sistemas e impressoras) e os serviços IP de administração da RB, use também a atualização abaixo. Ela não altera ether4, ether5, WAN, filas, RADIUS ou Heartbeat; a rede de funcionários continua alcançando a faixa do provedor.', styles['Body2']), Paragraph('/import file-name=MANOS-HOTSPOT-FIREWALL-UPDATE.rsc', styles['Code2']), Paragraph('Para proteger a própria RB contra acessos que cheguem pela bridge-wan (ether1 e ether5), aplique a proteção WAN em Safe Mode, conectado pela ether4 ou por acesso local. Não execute esta etapa pela ether5, porque a administração da RB por essa rede será bloqueada. Ela mantém DHCP do provedor e respostas de RADIUS, DNS, NTP e Heartbeat; equipamentos ligados à ether5 continuam se comunicando entre si.', styles['Body2']), Paragraph('/import file-name=MANOS-WAN-FIREWALL-UPDATE.rsc', styles['Code2']), Paragraph('Depois execute a Conferência pós-instalação. A fila RADIUS da RB é exibida em ordem upload/download: 5M/20M significa 5 Mbps de upload e 20 Mbps de download.', styles['Body2'])]
story += [Paragraph('9.2 Conferência pós-instalação', styles['H']), Paragraph('Baixe MANOS-POSTFLIGHT.rsc somente nesta etapa. Ele consulta portas, IPs, fila da ether4, RADIUS, login e isolamento; não altera a RB.', styles['Body2']), Paragraph('/import file-name=MANOS-POSTFLIGHT.rsc', styles['Code2'])]
story += [PageBreak(), Paragraph('10. Diagnóstico individual', styles['H']), Paragraph('<b>Use um comando por vez.</b> O teste manual do heartbeat deve ser executado sozinho; depois consulte o log.', styles['Warning'])]
story += command_step('Consultar sessões ativas', '/ip hotspot active print detail')
story += command_step('Executar teste manual do heartbeat', '/system script run MANOS-HEARTBEAT')
story += command_step('Consultar o log após o teste', '/log print where message~"radius|hotspot|login|failure|Manos Tech"')
SimpleDocTemplate(str(pdf), pagesize=A4, rightMargin=18*mm, leftMargin=18*mm, topMargin=16*mm, bottomMargin=20*mm, title='Configuração HotSpot MikroTik Manos Tech').build(story, onFirstPage=footer, onLaterPages=footer)
Path('public/mikrotik/guia-instalacao-mikrotik-manos-tech.pdf').write_bytes(pdf.read_bytes())
print(pdf)
