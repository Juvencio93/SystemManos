# Manos Tech - leitura apos a instalacao. Nao altera a configuracao.
:put "MANOS-POSTFLIGHT|BEGIN|1"
:foreach port in={"ether1";"ether2";"ether3";"ether4";"ether5"} do={
  :local bridge "none"
  :local memberships [/interface bridge port find where interface=$port]
  :if ([:len $memberships] > 0) do={ :set bridge [/interface bridge port get [:pick $memberships 0] bridge] }
  :put ("MANOS-POSTFLIGHT|PORT|" . $port . "|" . $bridge)
}
:foreach address in={"192.168.88.1/24";"192.168.89.1/24"} do={
  :local addresses [/ip address find where address=$address disabled=no]
  :local state "missing"
  :if ([:len $addresses] > 0) do={ :set state [/ip address get [:pick $addresses 0] interface] }
  :put ("MANOS-POSTFLIGHT|ADDRESS|" . $address . "|" . $state)
}
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
:put ("MANOS-POSTFLIGHT|LOGIN|" . ([:len [/file find where name="flash/manos-login-v3.marker"]] > 0))
:foreach rule in={"MANOS-ISOLATE-HOTSPOT-LIVRE";"MANOS-ISOLATE-LIVRE-HOTSPOT"} do={
  :local rules [/ip firewall filter find where comment=$rule disabled=no]
  :put ("MANOS-POSTFLIGHT|ISOLATION|" . $rule . "|" . ([:len $rules] > 0))
}
:put "MANOS-POSTFLIGHT|END|1"
