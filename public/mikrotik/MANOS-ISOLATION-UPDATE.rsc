# Manos Tech - atualizacao minima para RBs ja instaladas.
# Use em Safe Mode. Este arquivo cria ou corrige somente o isolamento entre
# visitantes (192.168.88.0/24) e funcionarios (192.168.89.0/24).
# Ele nao altera WAN, ether5, DHCP, HotSpot, RADIUS, filas ou NAT.
:if ([:len [/ip firewall filter find comment="MANOS-ISOLATE-HOTSPOT-LIVRE"]] = 0) do={
  /ip firewall filter add chain=forward src-address=192.168.88.0/24 dst-address=192.168.89.0/24 action=drop place-before=0 comment="MANOS-ISOLATE-HOTSPOT-LIVRE"
} else={
  /ip firewall filter set [find comment="MANOS-ISOLATE-HOTSPOT-LIVRE"] chain=forward src-address=192.168.88.0/24 dst-address=192.168.89.0/24 action=drop disabled=no
  /ip firewall filter move [find comment="MANOS-ISOLATE-HOTSPOT-LIVRE"] destination=0
}
:if ([:len [/ip firewall filter find comment="MANOS-ISOLATE-LIVRE-HOTSPOT"]] = 0) do={
  /ip firewall filter add chain=forward src-address=192.168.89.0/24 dst-address=192.168.88.0/24 action=drop place-before=0 comment="MANOS-ISOLATE-LIVRE-HOTSPOT"
} else={
  /ip firewall filter set [find comment="MANOS-ISOLATE-LIVRE-HOTSPOT"] chain=forward src-address=192.168.89.0/24 dst-address=192.168.88.0/24 action=drop disabled=no
  /ip firewall filter move [find comment="MANOS-ISOLATE-LIVRE-HOTSPOT"] destination=0
}
:log info "Manos Tech guest/employee isolation updated"
