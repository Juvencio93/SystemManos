# Manos Tech - protecao adicional do HotSpot para RBs ja instaladas.
# Use em Safe Mode. Este arquivo nao altera ether4, ether5, WAN, DHCP,
# HotSpot, RADIUS, NAT, filas ou Heartbeat.
#
# Ele bloqueia apenas:
# - visitantes (.88) acessando a faixa do provedor (.0), onde ficam sistemas
#   e impressoras do cliente;
# - visitantes (.88) acessando servicos de administracao IP da propria RB.
# A navegacao na internet e a rede de funcionarios (.89) permanecem como estao.

:if ([:len [/ip firewall filter find comment="MANOS-GUEST-BLOCK-PROVIDER"]] = 0) do={
  /ip firewall filter add chain=forward src-address=192.168.88.0/24 dst-address=192.168.0.0/24 action=drop comment="MANOS-GUEST-BLOCK-PROVIDER"
} else={
  /ip firewall filter set [find comment="MANOS-GUEST-BLOCK-PROVIDER"] chain=forward src-address=192.168.88.0/24 dst-address=192.168.0.0/24 action=drop disabled=no
  :local firstRule [:pick [/ip firewall filter find] 0]
  :local managedRule [:pick [/ip firewall filter find comment="MANOS-GUEST-BLOCK-PROVIDER"] 0]
  :if ($managedRule != $firstRule) do={ /ip firewall filter move $managedRule destination=$firstRule }
}

:if ([:len [/ip firewall filter find comment="MANOS-GUEST-BLOCK-MANAGEMENT-TCP"]] = 0) do={
  /ip firewall filter add chain=input src-address=192.168.88.0/24 protocol=tcp dst-port=21,22,23,8291,8728,8729 action=drop comment="MANOS-GUEST-BLOCK-MANAGEMENT-TCP"
} else={
  /ip firewall filter set [find comment="MANOS-GUEST-BLOCK-MANAGEMENT-TCP"] chain=input src-address=192.168.88.0/24 protocol=tcp dst-port=21,22,23,8291,8728,8729 action=drop disabled=no
  :local firstRule [:pick [/ip firewall filter find] 0]
  :local managedRule [:pick [/ip firewall filter find comment="MANOS-GUEST-BLOCK-MANAGEMENT-TCP"] 0]
  :if ($managedRule != $firstRule) do={ /ip firewall filter move $managedRule destination=$firstRule }
}

:if ([:len [/ip firewall filter find comment="MANOS-GUEST-BLOCK-MANAGEMENT-UDP"]] = 0) do={
  /ip firewall filter add chain=input src-address=192.168.88.0/24 protocol=udp dst-port=161 action=drop comment="MANOS-GUEST-BLOCK-MANAGEMENT-UDP"
} else={
  /ip firewall filter set [find comment="MANOS-GUEST-BLOCK-MANAGEMENT-UDP"] chain=input src-address=192.168.88.0/24 protocol=udp dst-port=161 action=drop disabled=no
  :local firstRule [:pick [/ip firewall filter find] 0]
  :local managedRule [:pick [/ip firewall filter find comment="MANOS-GUEST-BLOCK-MANAGEMENT-UDP"] 0]
  :if ($managedRule != $firstRule) do={ /ip firewall filter move $managedRule destination=$firstRule }
}

:log info "Manos Tech HotSpot firewall protection updated"
