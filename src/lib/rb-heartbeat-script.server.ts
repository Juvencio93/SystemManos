const baseUrl = "https://manostech-system.com.br";

export function heartbeatScript(identity: string, token: string) {
  const kitVersion = "2026.10.28.1";
  const scriptSource = `
  :local routerIdentity "${identity}"
  :local heartbeatToken "${token}"
  :local wanIpRaw ""
  :local wanAddressId [/ip address find where interface="bridge-wan" dynamic=yes]
  :if ([:len $wanAddressId] > 0) do={ :set wanIpRaw [/ip address get $wanAddressId address] }
  :local wanIp $wanIpRaw
  :if ([:find $wanIpRaw "/"] != nil) do={ :set wanIp [:pick $wanIpRaw 0 [:find $wanIpRaw "/"]] }
  :local routerVersion [/system resource get version]
  :local uptime [/system resource get uptime]
  :local routerMac ""
  :local ether5Id [/interface ethernet find where name="ether5"]
  :if ([:len $ether5Id] > 0) do={ :set routerMac [/interface ethernet get $ether5Id mac-address] }
  :local sessions [/ip hotspot active print count-only]
  :local rxBytes 0
  :local txBytes 0
  :foreach activeId in=[/ip hotspot active find] do={
    :set rxBytes ($rxBytes + [/ip hotspot active get $activeId bytes-in])
    :set txBytes ($txBytes + [/ip hotspot active get $activeId bytes-out])
  }
  :local pingSent 3
  :local pingReceived 0
  :local latencyMs ""
  :do {
    # RouterOS 7 returns one result per probe for count>1; each successful
    # result carries its RTT as a time value. Aggregate those replies locally.
    :local pingResults [/ping address=1.1.1.1 count=$pingSent as-value proplist=time]
    :local totalRttNanoseconds 0
    :foreach pingResult in=$pingResults do={
      :local roundTripTime ($pingResult->"time")
      :if ([:typeof $roundTripTime] = "time") do={
        :set totalRttNanoseconds ($totalRttNanoseconds + [:tonsec $roundTripTime])
        :set pingReceived ($pingReceived + 1)
      }
    }
    :if ($pingReceived > 0) do={ :set latencyMs ($totalRttNanoseconds / $pingReceived / 1000000) }
  } on-error={ :set pingReceived 0; :set latencyMs "" }
  :local packetLossPct ""
  :if ($pingSent > 0) do={ :set packetLossPct (100 - (($pingReceived * 100) / $pingSent)) }
  :local schedulerId [/system scheduler find where name="MANOS-HEARTBEAT"]
  :local schedulerComment ""
  :if ([:len $schedulerId] > 0) do={ :set schedulerComment [/system scheduler get $schedulerId comment] }
  :local firewallBlocked ""
  :if ([:pick $schedulerComment 0 9] = "MANOS-FW-") do={ :set firewallBlocked [:pick $schedulerComment 9 [:len $schedulerComment]] }
  :local heartbeatScriptId [/system script find where name="MANOS-HEARTBEAT"]
  :local rebootComment ""
  :if ([:len $heartbeatScriptId] > 0) do={ :set rebootComment [/system script get $heartbeatScriptId comment] }
  :local rebootCommandId ""
  :local rebootPrefix "MANOS-REBOOT-"
  :if ([:pick $rebootComment 0 [:len $rebootPrefix]] = $rebootPrefix) do={
    :set rebootCommandId [:pick $rebootComment [:len $rebootPrefix] [:len $rebootComment]]
  }
  # RouterOS can truncate a POST URL assembled with many query parameters.
  # Send telemetry as headers instead, so the heartbeat remains valid even
  # when the installed RouterOS formats version or uptime differently.
  :local heartbeatUrl "${baseUrl}/api/internal/hotspot-heartbeat"
  :local heartbeatHeaders ("X-Manos-Heartbeat: " . $heartbeatToken . ",X-Manos-Router: " . $routerIdentity . ",X-Manos-Mac: " . $routerMac . ",X-Manos-IP: " . $wanIp . ",X-Manos-Version: " . $routerVersion . ",X-Manos-Kit-Version: ${kitVersion}" . ",X-Manos-Uptime: " . $uptime . ",X-Manos-Sessions: " . $sessions . ",X-Manos-RX-Bytes: " . $rxBytes . ",X-Manos-TX-Bytes: " . $txBytes . ",X-Manos-Latency-MS: " . $latencyMs . ",X-Manos-Packet-Loss: " . $packetLossPct . ",X-Manos-Firewall: " . $firewallBlocked . ",X-Manos-Reboot-Command: " . $rebootCommandId)
  :do {
    /tool fetch url=$heartbeatUrl http-method=post http-header-field=$heartbeatHeaders check-certificate=yes keep-result=no
  } on-error={ :log warning "Manos Tech heartbeat failed" }
  :local commandFile "flash/manos-command.rsc"
  :local commandFileId [/file find where name=$commandFile]
  :if ([:len $commandFileId] > 0) do={ /file remove $commandFileId }
  :local commandUrl ("${baseUrl}/api/internal/hotspot-command?routerIdentity=" . $routerIdentity . "&rebootCommandId=" . $rebootCommandId)
  :do {
    :local fetchResult [/tool fetch url=$commandUrl http-header-field=("X-Manos-Heartbeat: " . $heartbeatToken) check-certificate=yes dst-path=$commandFile as-value]
    :if (($fetchResult->"status") = "finished") do={
      :local fetchedFileId [/file find where name=$commandFile]
      :if ([:len $fetchedFileId] > 0) do={ /import file-name=$commandFile }
    }
  } on-error={ :log warning "Manos Tech command fetch/import failed" }
`;
  return `# Personalized Manos Tech heartbeat for RouterOS v7; safe to import again.
:if ([:len [/system script find where name="MANOS-HEARTBEAT"]] = 0) do={
  /system script add name="MANOS-HEARTBEAT" policy=ftp,reboot,read,write,policy,test,password,sniff,sensitive,romon source={${scriptSource}}
} else={
  /system script set [find where name="MANOS-HEARTBEAT"] policy=ftp,reboot,read,write,policy,test,password,sniff,sensitive,romon source={${scriptSource}}
}
:if ([:len [/system scheduler find where name="MANOS-HEARTBEAT"]] = 0) do={
  /system scheduler add name="MANOS-HEARTBEAT" interval=120s on-event="MANOS-HEARTBEAT" policy=ftp,reboot,read,write,policy,test,password,sniff,sensitive,romon disabled=no
} else={
  /system scheduler set [find where name="MANOS-HEARTBEAT"] interval=120s on-event="MANOS-HEARTBEAT" policy=ftp,reboot,read,write,policy,test,password,sniff,sensitive,romon disabled=no
}
:log info "Manos Tech heartbeat configured (120s)"
`;
}
