# =====================================================================
# MANOS-HERMES-SETUP.rsc
# Manos Tech - Hermes Fase 1 (monitoramento proativo, SOMENTE LEITURA)
#
# Arquivo UNIVERSAL: o MESMO arquivo, sem editar NADA, em todas as
# RBs. Importou, a RB se cadastra sozinha na VPS e aguarda a
# aprovacao do operador no Telegram. Nenhuma configuracao de
# monitoramento e aplicada antes dessa aprovacao.
#
# COMO FUNCIONA (fluxo de cadastro com aprovacao):
#   1. Na importacao, se a interface wg-manos nao existe, ela e
#      criada e o PROPRIO RouterOS gera o par de chaves WireGuard
#      desta RB. A chave privada NUNCA sai da RB.
#   2. A RB le a sua chave PUBLICA, a identidade (/system identity),
#      o modelo e a versao, e envia um pedido de cadastro:
#        POST https://186.202.57.104:8443/enroll
#        JSON: {"pubkey":"...","identity":"...","model":"...",
#               "version":"..."}
#   3. O servico de cadastro da VPS guarda o pedido como PENDENTE e
#      avisa o operador no Telegram, com botoes Aprovar / Rejeitar.
#   4. A RB consulta o status a cada 60s (agendador
#      hermes-enroll-poll):
#        GET https://186.202.57.104:8443/status?pubkey=<url-encoded>
#      - "pending": nada muda; continua aguardando.
#      - "rejected": registra o erro no log e remove o agendador.
#      - aprovado: a resposta E o script de configuracao
#        personalizado desta RB (primeira linha "# HERMES-CONFIG-
#        APROVADO"), que a RB importa na hora. O script traz o IP do
#        tunel atribuido, o usuario hermes-ro com a senha gerada na
#        VPS e o servico de API. Depois de aplicar, a RB cria o
#        marcador "hermes-enrolled" e remove o agendador.
#
# USO:
#   /import file-name=MANOS-HERMES-SETUP.rsc
#   So isso. NAO ha variavel para preencher neste arquivo.
#
# Pre-requisitos:
#   - RouterOS v7 (WireGuard nao existe no v6)
#   - Rodar DEPOIS do MANOS-MANAGEMENT-HARDENING.rsc: a API so e
#     ligada na etapa pos-aprovacao, e nada pode desligar depois.
#   - A RB precisa de saida para a internet (para falar com o
#     servico de cadastro em 186.202.57.104:8443).
#   - Relogio NAO e mais pre-requisito: este proprio script ajusta
#     o fuso para America/Sao_Paulo e ativa o cliente NTP com os
#     servidores brasileiros (pool.ntp.br, a.ntp.br, b.ntp.br) em
#     toda importacao - ver a secao 7, fora do bloco de cadastro.
#
# SEGURANCA:
#   - O pedido de cadastro carrega SOMENTE a chave publica, a
#     identidade, o modelo e a versao. Nenhuma senha, nenhuma chave
#     privada e nenhuma configuracao sai da RB nesse pedido.
#   - NADA e aplicado na RB ate o operador aprovar no Telegram.
#     Quem nao for aprovado recebe, no maximo, um "pending" eterno
#     ou um "rejected" - nem IP de tunel, nem usuario, nem API.
#   - A configuracao personalizada so e entregue pelo /status para
#     a chave publica aprovada, e so depois da aprovacao.
#   - O servico de cadastro roda no IP fixo da VPS, porta 8443, com
#     certificado proprio: por isso o fetch usa check-certificate=no.
#     A barreira real e a aprovacao manual, nao o certificado.
#   - A senha do hermes-ro e gerada na VPS, e unica por RB: fica no
#     .env da VPS (HERMES_SECRET_<VAULT_REF>) e na configuracao
#     entregue a esta RB. NUNCA reutilize senha entre RBs.
#
# NOTA SOBRE API SIMPLES x API-SSL: o TLS do RouterOS nao negocia
# handshake com o OpenSSL moderno do coletor (testado em producao:
# SSLV3_ALERT_HANDSHAKE_FAILURE mesmo com SECLEVEL=1). Por isso o
# padrao do Hermes e a API simples na 8728. A seguranca NAO depende
# do TLS aqui: a porta so aceita conexao de 10.77.0.1/32, que so e
# alcancavel DENTRO do tunel WireGuard - e o tunel ja e criptografado
# de ponta a ponta. O api-ssl (8729) fica DESLIGADO.
#
# IDEMPOTENCIA:
#   - Importar de novo com o cadastro PENDENTE: a interface e a
#     chave existentes sao mantidas (a chave NUNCA e trocada), o
#     pedido e reenviado (a VPS deduplica pela chave publica) e o
#     agendador e atualizado no lugar, sem duplicar nada.
#   - Importar de novo DEPOIS de aprovado (marcador hermes-enrolled
#     presente): o bloco de cadastro apenas informa que o Hermes ja
#     esta ativo nesta RB e nao toca em cadastro/tunel/usuario.
#     As secoes FORA do bloco de cadastro continuam rodando em toda
#     importacao: o grupo hermes-rw (secao 6) e o relogio/NTP
#     (secao 7) - ambas idempotentes, so garantem o padrao.
# =====================================================================
# =====================================================================
# CONTRATO DO SERVICO DE CADASTRO (lado da VPS - referencia)
# O servico em si NAO faz parte deste arquivo; esta secao documenta
# o que a VPS precisa fazer para este script funcionar.
#
# Endpoints (HTTPS, 186.202.57.104:8443):
#   POST /enroll  - recebe o JSON da RB; se a pubkey ja existir,
#                   devolve o status atual sem duplicar (dedupe por
#                   pubkey). Pedido novo fica "pending" e dispara a
#                   mensagem no Telegram com botoes inline
#                   Aprovar / Rejeitar (o callback carrega a pubkey).
#   GET /status?pubkey=<url-encoded>
#                 - pendente: corpo "pending"
#                 - rejeitado: corpo "rejected"
#                 - aprovado: corpo = o script .rsc personalizado
#                   desta RB, comecando com a linha
#                   "# HERMES-CONFIG-APROVADO"
#
# Ao APROVAR no Telegram, a VPS faz, nesta ordem:
#   1. Atribui o proximo IP livre do tunel, a partir de 10.77.0.4:
#        10.77.0.1 = VPS | 10.77.0.2 = peer antigo (pre-Hermes)
#        10.77.0.3 = MT-EFRAIM (Efraim Padaria, Joinville-SC)
#   2. Adiciona o peer em /etc/wireguard/wg-manos.conf:
#        [Peer]  # <identity da RB>
#        PublicKey = <pubkey recebida no cadastro>
#        AllowedIPs = <IP do tunel>/32
#      E recarrega sem derrubar os outros peers:
#        wg-quick strip /etc/wireguard/wg-manos.conf > /tmp/wg.strip
#        wg syncconf wg-manos /tmp/wg.strip
#   3. Gera uma senha forte e UNICA para o hermes-ro desta RB.
#   4. Cadastra a RB no banco do Hermes:
#        INSERT INTO hermes_rbs (cliente, local, modelo, host,
#        api_port, api_user, vault_ref, prioridade, status,
#        coleta_ativa) VALUES ('<CLIENTE>', '<LOCAL>', '<modelo>',
#        '<IP do tunel>', 8728, 'hermes-ro', '<VAULT_REF>', 'Alta',
#        'Pronto', true);
#      vault_ref: codigo unico da RB, ex.: MT_EFRAIM, MT_<NOME>.
#   5. Adiciona a senha ao ~/hermes/.env e recria o coletor:
#        HERMES_API_TLS=false
#        HERMES_SECRET_<VAULT_REF>=<senha gerada no passo 3>
#        cd ~/hermes && docker compose up -d hermes
#   6. Monta o script personalizado que o /status vai entregar:
#        - /ip address <IP do tunel>/24 na interface wg-manos
#        - grupo hermes-ro (policy read,api) e usuario hermes-ro
#          com a senha do passo 3
#        - /ip service api: disabled=no, port=8728,
#          address=10.77.0.1/32 (SOMENTE o IP do tunel da VPS)
#        - /ip service api-ssl: disabled=yes (porta 8729 desligada)
#        (o peer para a VPS e a interface ja sao criados por ESTE
#         script universal; a config da VPS so completa o payload)
# Ao REJEITAR: marca o pedido como "rejected" e nada mais acontece
# (sem peer, sem IP, sem banco, sem senha).
# =====================================================================

# --- Parametros fixos da VPS do Hermes (iguais em todas as RBs) -----
:local hermesVpsIp        "186.202.57.104"
:local hermesEnrollBase   "https://186.202.57.104:8443"
:local hermesVpsPubKey    "lg7ZFA233ykRqkaYdW/LsnwxCgPJl7O7CUoIC53GGWs="
:local hermesVpsWgPort    51820
:local hermesVpsTunnelIp  "10.77.0.1"

# --- Trava: WireGuard exige RouterOS v7 -------------------------------
:if ([:tonum [:pick [/system resource get version] 0 1]] < 7) do={
    :log error "HERMES: RouterOS v6 detectado - WireGuard exige v7"
    :error "HERMES: atualize para RouterOS v7 antes de importar"
}

# =====================================================================
# Se o marcador hermes-enrolled existe, esta RB ja foi aprovada e
# configurada: sai sem tocar em nada.
# =====================================================================
:if ([:len [/system script find where name="hermes-enrolled"]] > 0) do={
    :log info "HERMES: cadastro ja concluido nesta RB - nada a fazer"
    :put "HERMES: ja ativo nesta RB (marcador hermes-enrolled). Nada foi alterado."
} else={

# =====================================================================
# 1) Interface WireGuard wg-manos. Sem private-key no add, o
#    RouterOS gera o par de chaves na hora. Se a interface ja existe
#    (reimportacao com cadastro pendente), a chave e MANTIDA.
# =====================================================================
:if ([:len [/interface wireguard find where name="wg-manos"]] = 0) do={
    /interface wireguard add name=wg-manos comment="HERMES"
    :log info "HERMES: interface wg-manos criada (chaves geradas pela RB)"
} else={
    /interface wireguard set [find where name="wg-manos"] disabled=no
}

# =====================================================================
# 2) Peer para a VPS (a RB disca; a VPS so ouve). O handshake so
#    completa depois que a VPS aprovar e adicionar o peer dela.
#    persistent-keepalive mantem o tunel aberto atras de NAT/modem.
# =====================================================================
:if ([:len [/interface wireguard peers find where interface="wg-manos" and public-key=$hermesVpsPubKey]] = 0) do={
    /interface wireguard peers add interface=wg-manos public-key=$hermesVpsPubKey endpoint-address=$hermesVpsIp endpoint-port=$hermesVpsWgPort allowed-address=($hermesVpsTunnelIp . "/32") persistent-keepalive=25s comment="HERMES-VPS"
} else={
    /interface wireguard peers set [find where interface="wg-manos" and public-key=$hermesVpsPubKey] endpoint-address=$hermesVpsIp endpoint-port=$hermesVpsWgPort allowed-address=($hermesVpsTunnelIp . "/32") persistent-keepalive=25s disabled=no
}

# =====================================================================
# 3) Chave publica desta RB + codificacao para URL.
#    A pubkey WireGuard usa base64 e pode conter + / = , que precisam
#    virar %2B %2F %3D na query do /status.
# =====================================================================
:local hermesPubKey [/interface wireguard get wg-manos public-key]
:local hermesUrlEnc do={
    :local in $1
    :local out ""
    :for i from=0 to=([:len $in] - 1) do={
        :local c [:pick $in $i ($i + 1)]
        :if ($c = "+") do={ :set c "%2B" }
        :if ($c = "/") do={ :set c "%2F" }
        :if ($c = "=") do={ :set c "%3D" }
        :set out ($out . $c)
    }
    :return $out
}
:local hermesPubKeyEnc [$hermesUrlEnc $hermesPubKey]

# =====================================================================
# 4) Pedido de cadastro para a VPS. Vai SOMENTE a chave publica, a
#    identidade, o modelo e a versao - nenhuma credencial.
#    Se a VPS nao responder agora (internet fora do ar, etc.), nao
#    tem problema: o agendador do passo 5 fica responsavel por
#    concluir o processo, e a VPS deduplica o pedido pela pubkey.
# =====================================================================
:local hermesIdentity [/system identity get name]
:local hermesModel    [/system resource get board-name]
:local hermesVersion  [/system resource get version]
:local hermesJson ("{\"pubkey\":\"" . $hermesPubKey . "\",\"identity\":\"" . $hermesIdentity . "\",\"model\":\"" . $hermesModel . "\",\"version\":\"" . $hermesVersion . "\"}")
:do {
    /tool fetch mode=https check-certificate=no http-method=post http-header-field="Content-Type: application/json" http-data=$hermesJson url=($hermesEnrollBase . "/enroll") output=none
    :log info "HERMES: pedido de cadastro enviado - aguardando aprovacao no Telegram"
} on-error={
    :log warning "HERMES: servico de cadastro nao respondeu agora; o agendador hermes-enroll-poll assume as tentativas"
}

# =====================================================================
# 5) Agendador de consulta de status (a cada 60s).
#    O script hermes-enroll-poll:
#      - baixa GET /status?pubkey=<url-encoded> para hermes-status.txt
#      - "rejected" -> log de erro e remove agendador e script
#      - corpo comecando com "# HERMES-CONFIG-APROVADO" -> importa o
#        arquivo (e a configuracao personalizada desta RB), cria o
#        marcador hermes-enrolled e remove agendador e script
#      - "pending" (ou VPS fora do ar) -> nao muda nada; tenta de
#        novo em 60s
#    A URL do servico e fixa e esta dentro do proprio script; a
#    pubkey ele rele da interface wg-manos a cada execucao.
# =====================================================================
:local hermesPollSrc ":local pk [/interface wireguard get wg-manos public-key]; :local enc \"\"; :for i from=0 to=([:len \$pk] - 1) do={ :local c [:pick \$pk \$i (\$i + 1)]; :if (\$c = \"+\") do={ :set c \"%2B\" }; :if (\$c = \"/\") do={ :set c \"%2F\" }; :if (\$c = \"=\") do={ :set c \"%3D\" }; :set enc (\$enc . \$c) }; :do { /tool fetch mode=https check-certificate=no url=(\"https://186.202.57.104:8443/status?pubkey=\" . \$enc) dst-path=\"hermes-status.txt\" } on-error={ :log warning \"HERMES: servico de cadastro indisponivel; nova tentativa em 60s\" }; :if ([:len [/file find where name=\"hermes-status.txt\"]] > 0) do={ :local st [/file get hermes-status.txt contents]; :if ([:typeof [:find \$st \"rejected\"]] != \"nil\") do={ :log error \"HERMES: cadastro REJEITADO na VPS - monitoramento nao sera ativado\"; /system scheduler remove [find where name=\"hermes-enroll-poll\"]; /system script remove [find where name=\"hermes-enroll-poll\"] }; :if ([:typeof [:find \$st \"HERMES-CONFIG-APROVADO\"]] != \"nil\") do={ :do { /import file-name=\"hermes-status.txt\"; :if ([:len [/system script find where name=\"hermes-enrolled\"]] = 0) do={ /system script add name=hermes-enrolled policy=read source=\":log info \\\"HERMES: cadastro concluido\\\"\" }; :log info \"HERMES: configuracao aprovada aplicada - monitoramento ativo\"; /system scheduler remove [find where name=\"hermes-enroll-poll\"]; /system script remove [find where name=\"hermes-enroll-poll\"] } on-error={ :log error \"HERMES: falha ao aplicar a configuracao recebida; nova tentativa em 60s\" } } }"
:if ([:len [/system script find where name="hermes-enroll-poll"]] = 0) do={
    /system script add name=hermes-enroll-poll policy=ftp,read,write,policy,test,password,sensitive source=$hermesPollSrc
} else={
    /system script set [find where name="hermes-enroll-poll"] policy=ftp,read,write,policy,test,password,sensitive source=$hermesPollSrc
}
:if ([:len [/system scheduler find where name="hermes-enroll-poll"]] = 0) do={
    /system scheduler add name=hermes-enroll-poll interval=60s start-time=startup on-event=hermes-enroll-poll policy=ftp,read,write,policy,test,password,sensitive comment="HERMES"
} else={
    /system scheduler set [find where name="hermes-enroll-poll"] interval=60s on-event=hermes-enroll-poll policy=ftp,read,write,policy,test,password,sensitive disabled=no
}
:do { /system script run hermes-enroll-poll } on-error={
    :log warning "HERMES: primeira consulta de status falhou; o agendador segue tentando a cada 60s"
}

:log info "HERMES: cadastro em andamento - aguardando aprovacao no Telegram (consulta a cada 60s)"
:put "HERMES: pedido enviado. Aprove no Telegram para ativar o monitoramento nesta RB."
:put "HERMES: acompanhe com /log print where topics~\"hermes\" ou /system scheduler print"

} ;# fim do bloco de cadastro (RB ainda nao aprovada)

# =====================================================================
# 6) Grupo hermes-rw (usuario de ESCRITA do Hermes).
#    Grupo usado pelo usuario de escrita que o Hermes usa para as
#    acoes aprovadas no Telegram (reiniciar RB, firewall, etc.).
#    Este bloco fica FORA do fluxo de cadastro acima de proposito:
#    roda em TODA importacao, inclusive em RB ja aprovada (marcador
#    hermes-enrolled presente), e e idempotente - cria o grupo se
#    nao existir e, se ja existir, apenas garante a policy exata,
#    sem duplicar e sem tocar em usuario nenhum.
#    Policy: read,api,write,test,reboot
#    O "reboot" e uma policy SEPARADA no RouterOS v7: sem ela,
#    mesmo com write, o comando /system/reboot e negado.
#    Nao inclui policy, ssh, telnet, web, ftp, winbox nem sniff:
#    escrita fica limitada ao necessario para as acoes aprovadas.
# =====================================================================
:if ([:len [/user group find where name="hermes-rw"]] = 0) do={
    /user group add name=hermes-rw policy=read,api,write,test,reboot comment="HERMES-RW"
    :log info "HERMES: grupo hermes-rw criado (policy read,api,write,test,reboot)"
} else={
    /user group set [find where name="hermes-rw"] policy=read,api,write,test,reboot
    :log info "HERMES: grupo hermes-rw ja existia - policy garantida (read,api,write,test,reboot)"
}

# =====================================================================
# 6b) Grupo hermes-ro (usuario de LEITURA do Hermes).
#    Mesmo padrao da secao 6: roda em TODA importacao, idempotente.
#    Sem este grupo, o "/user add name=hermes-ro group=hermes-ro" da
#    configuracao personalizada FALHA - e falhava em silencio
#    (on-error vazio), deixando a RB matriculada mas sem coleta
#    (bug real, MT-IGREJAMAEC 20/10/2026). O grupo NAO pode ficar so
#    na configuracao personalizada: ela e importada pelo script de
#    consulta, e qualquer falha ali precisa ser visivel no log.
#    Policy: read,api - somente leitura, nada de escrita.
# =====================================================================
:if ([:len [/user group find where name="hermes-ro"]] = 0) do={
    /user group add name=hermes-ro policy=read,api comment="HERMES-RO"
    :log info "HERMES: grupo hermes-ro criado (policy read,api)"
} else={
    /user group set [find where name="hermes-ro"] policy=read,api
    :log info "HERMES: grupo hermes-ro ja existia - policy garantida (read,api)"
}

# =====================================================================
# 7) Relogio padrao Manos Tech: fuso horario + cliente NTP.
#    Este bloco fica FORA do fluxo de cadastro, igual a secao 6:
#    roda em TODA importacao, inclusive em RB ja aprovada (marcador
#    hermes-enrolled presente), para deixar toda RB 100% no padrao.
#    - Fuso: America/Sao_Paulo (/system clock set) - o set e
#      idempotente por natureza: reaplicar o mesmo valor nao muda
#      nada alem de garantir o padrao.
#    - Cliente NTP: ativado (/system ntp client set enabled=yes).
#    - Servidores NTP brasileiros, adicionados UM A UM e de forma
#      idempotente: cada servidor so e adicionado se ainda nao
#      existir em /system ntp client servers (find por address),
#      sem duplicar em reimportacoes e sem remover servidores que
#      ja existam na RB.
#        pool.ntp.br | a.ntp.br | b.ntp.br
#    Relogio certo importa para logs, certificados e para o
#    agendamento/coleta do Hermes baterem com a VPS.
# =====================================================================
/system clock set time-zone-name=America/Sao_Paulo
/system ntp client set enabled=yes
:if ([:len [/system ntp client servers find where address="pool.ntp.br"]] = 0) do={
    /system ntp client servers add address=pool.ntp.br comment="HERMES-NTP"
    :log info "HERMES: servidor NTP pool.ntp.br adicionado"
}
:if ([:len [/system ntp client servers find where address="a.ntp.br"]] = 0) do={
    /system ntp client servers add address=a.ntp.br comment="HERMES-NTP"
    :log info "HERMES: servidor NTP a.ntp.br adicionado"
}
:if ([:len [/system ntp client servers find where address="b.ntp.br"]] = 0) do={
    /system ntp client servers add address=b.ntp.br comment="HERMES-NTP"
    :log info "HERMES: servidor NTP b.ntp.br adicionado"
}
:log info "HERMES: relogio padronizado - fuso America/Sao_Paulo, NTP ativo (pool.ntp.br, a.ntp.br, b.ntp.br)"

# =====================================================================
# VERIFICACAO NESTA RB (rode no terminal apos importar):
#   /interface wireguard print          (anote a public-key gerada)
#   /system scheduler print where name="hermes-enroll-poll"
#   /log print                        (procure as linhas HERMES)
# Depois da aprovacao no Telegram (ate ~60s para a RB perceber):
#   /ip address print where interface="wg-manos"   (IP do tunel)
#   /ping 10.77.0.1 count=3
#   /ip service print where name~"api"  (api 8728 so p/ 10.77.0.1/32)
#   /user print where name="hermes-ro"
#   /user group print where name="hermes-rw"  (policy read,api,write,test,reboot)
#   /system clock print                 (time-zone-name=America/Sao_Paulo)
#   /system ntp client print            (enabled=yes)
#   /system ntp client servers print    (pool.ntp.br, a.ntp.br, b.ntp.br - sem duplicar)
#   /system script print where name="hermes-enrolled"  (marcador)
#
# NOTA DE FIREWALL: se o firewall desta RB bloquear a entrada pela
# interface do tunel, libere a 8728 vinda do tunel ANTES da regra de
# drop do chain input (ajuste o place-before para a sua RB):
#   /ip firewall filter add chain=input action=accept protocol=tcp dst-port=8728 src-address=10.77.0.1 in-interface=wg-manos place-before=<NUMERO_DA_REGRA_DE_DROP>
#
# ROLLBACK - remover o Hermes desta RB (rode manualmente):
#   /system scheduler remove [find where name="hermes-enroll-poll"]
#   /system script remove [find where name="hermes-enroll-poll"]
#   /system script remove [find where name="hermes-enrolled"]
#   /interface wireguard peers remove [find where comment="HERMES-VPS"]
#   /interface wireguard remove [find where name="wg-manos"]
#   /user remove [find where name="hermes-ro"]
#   /user group remove [find where name="hermes-ro"]
#   /user group remove [find where name="hermes-rw"]
#   /ip service set api disabled=yes
#   /ip service set api-ssl disabled=yes
#   /file remove [find where name="hermes-status.txt"]
# (E na VPS: remover o peer da RB, a linha do banco e o
#  HERMES_SECRET_<VAULT_REF> do .env.)
# =====================================================================
