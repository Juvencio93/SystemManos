# Endurecimento seguro dos servicos IP da RB.
# Nao altera HotSpot, RADIUS, DHCP, NAT, filas, ether4, ether5, bridge-wan ou Heartbeat.
# Mantenha WinBox e SSH para manutencao local pela ether4.
#
# HERMES: se a RB ja esta matriculada no Hermes (marcador
# hermes-enrolled), a API e o canal de monitoramento - NAO desligar.
# A config personalizada do Hermes liga a api restrita ao tunel
# (10.77.0.1/32) na aprovacao; desligar aqui DEPOIS disso deixaria a
# RB muda para o Hermes sem nenhum erro visivel (bug real,
# MT-IGREJAMAEC 20/10/2026). Sem matricula, api/api-ssl desligam
# normalmente, como sempre.
:local hermesAtivo ([:len [/system script find where name="hermes-enrolled"]] > 0)
:foreach serviceName in={"ftp";"telnet";"api";"api-ssl"} do={
  :if ($hermesAtivo && ($serviceName = "api" || $serviceName = "api-ssl")) do={
    :put ("MANOS-MANAGEMENT-HARDENING|SERVICE|" . $serviceName . "|kept-hermes")
  } else={
  :local serviceId [/ip service find where name=$serviceName]
  :if ([:len $serviceId] > 0) do={
    :do {
      /ip service set [:pick $serviceId 0] disabled=yes
      :put ("MANOS-MANAGEMENT-HARDENING|SERVICE|" . $serviceName . "|disabled")
    } on-error={
      :put ("MANOS-MANAGEMENT-HARDENING|SERVICE|" . $serviceName . "|unchanged")
    }
  }
  }
}
:do {
  /tool bandwidth-server set enabled=no
  :put "MANOS-MANAGEMENT-HARDENING|SERVICE|btest|disabled"
} on-error={
  :put "MANOS-MANAGEMENT-HARDENING|SERVICE|btest|unchanged"
}
:put "MANOS-MANAGEMENT-HARDENING|DONE|3"
