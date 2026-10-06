# Endurecimento seguro dos servicos IP da RB.
# Nao altera HotSpot, RADIUS, DHCP, NAT, filas, ether4, ether5, bridge-wan ou Heartbeat.
# Mantenha WinBox e SSH para manutencao local pela ether4.
:foreach serviceName in={"ftp";"telnet";"btest";"api";"api-ssl"} do={
  :local serviceId [/ip service find where name=$serviceName]
  :if ([:len $serviceId] > 0) do={ /ip service set [:pick $serviceId 0] disabled=yes }
}
:put "MANOS-MANAGEMENT-HARDENING|DONE|1"
