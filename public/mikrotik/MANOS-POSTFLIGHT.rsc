# Manos Tech - leitura apos a instalacao. Nao altera a configuracao.
:put "MANOS-POSTFLIGHT|BEGIN|1"
:put "MANOS-POSTFLIGHT|VERSION|6"
:foreach port in={"ether1";"ether2";"ether3";"ether4";"ether5"} do={
  :local bridge "none"
  :local memberships [/interface bridge port find where interface=$port]
  :if ([:len $memberships] > 0) do={ :set bridge [/interface bridge port get [:pick $memberships 0] bridge] }
  :put ("MANOS-POSTFLIGHT|PORT|" . $port . "|" . $bridge)
}
:local lanAddress [/ip address find where address="192.168.88.1/24" disabled=no]
:local lanState "missing"
:if ([:len $lanAddress] > 0) do={ :set lanState [/ip address get [:pick $lanAddress 0] interface] }
:put ("MANOS-POSTFLIGHT|ADDRESS|192.168.88.1/24|" . $lanState)
:local livreAddress [/ip address find where address="192.168.89.1/24" disabled=no]
:local livreState "missing"
:if ([:len $livreAddress] > 0) do={ :set livreState [/ip address get [:pick $livreAddress 0] interface] }
:put ("MANOS-POSTFLIGHT|ADDRESS|192.168.89.1/24|" . $livreState)
:local queueId [/queue simple find where name="MANOS-ETHER4-TOTAL" disabled=no]
:if ([:len $queueId] = 0) do={
  :put "MANOS-POSTFLIGHT|QUEUE|MANOS-ETHER4-TOTAL|missing"
} else={
  :local queue [:pick $queueId 0]
  :put ("MANOS-POSTFLIGHT|QUEUE|MANOS-ETHER4-TOTAL|" . [/queue simple get $queue target] . "|" . [/queue simple get $queue max-limit])
}
:local radiusId [/radius find where service=hotspot comment~"^MANOS-RADIUS" disabled=no]
:put ("MANOS-POSTFLIGHT|RADIUS|" . ([:len $radiusId] > 0))
:local hotspotId [/ip hotspot find where name="hotspot1" disabled=no]
:if ([:len $hotspotId] = 0) do={ :put "MANOS-POSTFLIGHT|HOTSPOT|missing" } else={ :put ("MANOS-POSTFLIGHT|HOTSPOT|" . [/ip hotspot get [:pick $hotspotId 0] interface]) }
:local loginFileOk ([:len [/file find where name="flash/hotspot/login.html"]] > 0)
:local aloginFileOk ([:len [/file find where name="flash/hotspot/alogin.html"]] > 0)
:put ("MANOS-POSTFLIGHT|LOGIN-FILE|flash/hotspot/login.html|" . $loginFileOk)
:put ("MANOS-POSTFLIGHT|LOGIN-FILE|flash/hotspot/alogin.html|" . $aloginFileOk)
:put ("MANOS-POSTFLIGHT|LOGIN|" . ($loginFileOk && $aloginFileOk))
# Assinatura da pagina PROPRIA Manos Tech: o login.html da Manos tem
# ~23 KB; o padrao MikroTik (ex.: apos um "Reset HTML") tem ~3 KB.
# Arquivo existir NAO basta - sem esta checagem, um portal padrao
# passava no postflight como se estivesse tudo certo.
:local loginSize 0
:if ($loginFileOk) do={ :set loginSize [/file get [:pick [/file find where name="flash/hotspot/login.html"] 0] size] }
:put ("MANOS-POSTFLIGHT|LOGIN-SIZE|" . $loginSize)
:put ("MANOS-POSTFLIGHT|LOGIN-CUSTOM|" . ($loginSize > 10000))
# Prontidao Hermes: API ligada e restrita ao tunel + usuarios criados.
# Sem isso a RB fica "matriculada" mas o Hermes nao coleta nada.
:local apiId [/ip service find where name="api"]
:local apiOn false
:local apiAddr ""
:if ([:len $apiId] > 0) do={
  :local apiRow [:pick $apiId 0]
  :if (![/ip service get $apiRow disabled]) do={ :set apiOn true }
  :set apiAddr [/ip service get $apiRow address]
}
:put ("MANOS-POSTFLIGHT|HERMES-API|" . $apiOn . "|" . $apiAddr)
:put ("MANOS-POSTFLIGHT|HERMES-USER-RO|" . ([:len [/user find where name="hermes-ro"]] > 0))
:put ("MANOS-POSTFLIGHT|HERMES-USER-RW|" . ([:len [/user find where name="hermes-rw"]] > 0))
:foreach rule in={"MANOS-ISOLATE-HOTSPOT-LIVRE";"MANOS-ISOLATE-LIVRE-HOTSPOT"} do={
  :local rules [/ip firewall filter find where comment=$rule disabled=no]
  :put ("MANOS-POSTFLIGHT|ISOLATION|" . $rule . "|" . ([:len $rules] > 0))
}
:foreach rule in={"MANOS-GUEST-BLOCK-PROVIDER";"MANOS-GUEST-BLOCK-MANAGEMENT-TCP";"MANOS-GUEST-BLOCK-MANAGEMENT-UDP"} do={
  :local rules [/ip firewall filter find where comment=$rule]
  :local active false
  :if ([:len $rules] > 0) do={
    :local ruleId [:pick $rules 0]
    :if (![/ip firewall filter get $ruleId disabled]) do={ :set active true }
  }
  :put ("MANOS-POSTFLIGHT|SECURITY|" . $rule . "|" . $active)
}
:foreach rule in={"MANOS-WAN-ALLOW-ESTABLISHED";"MANOS-WAN-DROP-INVALID";"MANOS-WAN-ALLOW-DHCP";"MANOS-WAN-DROP-INPUT"} do={
  :local rules [/ip firewall filter find where comment=$rule]
  :local active false
  :if ([:len $rules] > 0) do={
    :local ruleId [:pick $rules 0]
    :if (![/ip firewall filter get $ruleId disabled]) do={ :set active true }
  }
  :put ("MANOS-POSTFLIGHT|WAN-FIREWALL|" . $rule . "|" . $active)
}
:put "MANOS-POSTFLIGHT|END|1"
