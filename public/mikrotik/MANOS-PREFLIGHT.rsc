# Manos Tech - leitura antes da instalacao. Nao altera a configuracao.
:put "MANOS-PREFLIGHT|BEGIN|1"
:put ("MANOS-PREFLIGHT|VERSION|" . [/system resource get version])
:foreach port in={"ether1";"ether2";"ether3";"ether4";"ether5"} do={
  :local bridge "none"
  :if ([:len [/interface ethernet find where name=$port]] = 0) do={
    :set bridge "missing"
  } else={
    :local memberships [/interface bridge port find where interface=$port]
    :if ([:len $memberships] > 0) do={ :set bridge [/interface bridge port get [:pick $memberships 0] bridge] }
  }
  :put ("MANOS-PREFLIGHT|PORT|" . $port . "|" . $bridge)
}
:foreach item in=[/ip address find] do={
  :put ("MANOS-PREFLIGHT|ADDRESS|" . [/ip address get $item address] . "|" . [/ip address get $item interface])
}
:foreach item in=[/ip dhcp-client find where disabled=no] do={
  :put ("MANOS-PREFLIGHT|DHCP-CLIENT|" . [/ip dhcp-client get $item interface])
}
:foreach item in=[/interface pppoe-client find where disabled=no] do={
  :put ("MANOS-PREFLIGHT|PPPOE|" . [/interface pppoe-client get $item interface])
}
:foreach item in=[/ip dhcp-server find where disabled=no] do={
  :put ("MANOS-PREFLIGHT|DHCP-SERVER|" . [/ip dhcp-server get $item name] . "|" . [/ip dhcp-server get $item interface])
}
:foreach item in=[/ip hotspot find where disabled=no] do={
  :put ("MANOS-PREFLIGHT|HOTSPOT|" . [/ip hotspot get $item name] . "|" . [/ip hotspot get $item interface])
}
:put "MANOS-PREFLIGHT|END|1"
