# Manos Tech - protecao de entrada pela WAN para RBs ja instaladas.
# Use em Safe Mode a partir da ether4 ou acesso local. Nao importe pela ether5:
# este arquivo bloqueia a administracao da RB vinda da bridge-wan. Ele protege somente a propria RB de acessos que
# chegam pela bridge-wan (ether1 e ether5). Ele nao bloqueia a comunicacao
# entre equipamentos na ether5 e nao altera HotSpot, ether4, DHCP, NAT,
# RADIUS, filas ou Heartbeat.
#
# O DHCP do provedor continua permitido. Respostas de conexoes iniciadas pela
# RB, como RADIUS, DNS, NTP e Heartbeat, sao mantidas por estado.

:if ([:len [/ip firewall filter find where comment="MANOS-WAN-DROP-INPUT"]] = 0) do={
  /ip firewall filter add chain=input in-interface=bridge-wan action=drop comment="MANOS-WAN-DROP-INPUT"
} else={
  /ip firewall filter set [find where comment="MANOS-WAN-DROP-INPUT"] chain=input in-interface=bridge-wan action=drop disabled=no
}
:local manosFirstRule [:pick [/ip firewall filter find] 0]
:local manosRule [:pick [/ip firewall filter find where comment="MANOS-WAN-DROP-INPUT"] 0]
:if ($manosRule != $manosFirstRule) do={ /ip firewall filter move $manosRule destination=$manosFirstRule }

:if ([:len [/ip firewall filter find where comment="MANOS-WAN-ALLOW-DHCP"]] = 0) do={
  /ip firewall filter add chain=input in-interface=bridge-wan protocol=udp src-port=67 dst-port=68 action=accept comment="MANOS-WAN-ALLOW-DHCP"
} else={
  /ip firewall filter set [find where comment="MANOS-WAN-ALLOW-DHCP"] chain=input in-interface=bridge-wan protocol=udp src-port=67 dst-port=68 action=accept disabled=no
}
:set manosFirstRule [:pick [/ip firewall filter find] 0]
:set manosRule [:pick [/ip firewall filter find where comment="MANOS-WAN-ALLOW-DHCP"] 0]
:if ($manosRule != $manosFirstRule) do={ /ip firewall filter move $manosRule destination=$manosFirstRule }

:if ([:len [/ip firewall filter find where comment="MANOS-WAN-DROP-INVALID"]] = 0) do={
  /ip firewall filter add chain=input connection-state=invalid action=drop comment="MANOS-WAN-DROP-INVALID"
} else={
  /ip firewall filter set [find where comment="MANOS-WAN-DROP-INVALID"] chain=input connection-state=invalid action=drop disabled=no
}
:set manosFirstRule [:pick [/ip firewall filter find] 0]
:set manosRule [:pick [/ip firewall filter find where comment="MANOS-WAN-DROP-INVALID"] 0]
:if ($manosRule != $manosFirstRule) do={ /ip firewall filter move $manosRule destination=$manosFirstRule }

:if ([:len [/ip firewall filter find where comment="MANOS-WAN-ALLOW-ESTABLISHED"]] = 0) do={
  /ip firewall filter add chain=input in-interface=bridge-wan connection-state=established,related,untracked action=accept comment="MANOS-WAN-ALLOW-ESTABLISHED"
} else={
  /ip firewall filter set [find where comment="MANOS-WAN-ALLOW-ESTABLISHED"] chain=input in-interface=bridge-wan connection-state=established,related,untracked action=accept disabled=no
}
:set manosFirstRule [:pick [/ip firewall filter find] 0]
:set manosRule [:pick [/ip firewall filter find where comment="MANOS-WAN-ALLOW-ESTABLISHED"] 0]
:if ($manosRule != $manosFirstRule) do={ /ip firewall filter move $manosRule destination=$manosFirstRule }

:log info "Manos Tech WAN input firewall protection updated"
