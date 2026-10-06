# Manos Tech - kit-base RouterOS v7
# Universal template. Import the device activation file after this one.
# Never put RADIUS/WireGuard secrets or certificate private keys in this file.

# WAN: ether1 is the provider input and ether5 is a direct provider-network
# extension. The DHCP client belongs to the WAN bridge, not to ether1.
:if ([:len [/interface bridge find name="bridge-wan"]] = 0) do={/interface bridge add name=bridge-wan protocol-mode=rstp}
:if ([:len [/interface bridge port find bridge="bridge-wan" interface=ether1]] = 0) do={/interface bridge port add bridge=bridge-wan interface=ether1}
:if ([:len [/interface bridge port find bridge="bridge-wan" interface=ether5]] = 0) do={/interface bridge port add bridge=bridge-wan interface=ether5}
:if ([:len [/ip dhcp-client find interface=bridge-wan]] = 0) do={/ip dhcp-client add interface=bridge-wan use-peer-dns=yes use-peer-ntp=yes disabled=no comment="MANOS-WAN"} else={/ip dhcp-client set [find interface=bridge-wan] use-peer-dns=yes use-peer-ntp=yes disabled=no}

# TLS heartbeat verification requires a correct clock. Prefer the provider's
# DHCP NTP servers, with a public fallback when the provider sends none.
:if ([:len [/system ntp client servers find where address="time.cloudflare.com"]] = 0) do={/system ntp client servers add address=time.cloudflare.com comment="MANOS-NTP"}
/system ntp client set enabled=yes

# Portal files directory.
:if ([:len [/file find name="flash/hotspot"]] = 0) do={/file add name=flash/hotspot type=directory}

/interface bridge
:if ([:len [find name="bridge-lan"]] = 0) do={add name=bridge-lan protocol-mode=rstp}
:if ([:len [find name="bridge-livre"]] = 0) do={add name=bridge-livre protocol-mode=rstp}
/interface bridge port
:if ([:len [find bridge="bridge-lan" interface=ether2]] = 0) do={add bridge=bridge-lan interface=ether2}
:if ([:len [find bridge="bridge-lan" interface=ether3]] = 0) do={add bridge=bridge-lan interface=ether3}
:if ([:len [find bridge="bridge-livre" interface=ether4]] = 0) do={add bridge=bridge-livre interface=ether4}
/ip address
:if ([:len [find address="192.168.88.1/24" interface=bridge-lan]] = 0) do={add address=192.168.88.1/24 interface=bridge-lan comment="MANOS-LAN"}
:if ([:len [find address="192.168.89.1/24" interface=bridge-livre]] = 0) do={add address=192.168.89.1/24 interface=bridge-livre comment="MANOS-LIVRE"}
/ip pool
:if ([:len [find name="pool-lan"]] = 0) do={add name=pool-lan ranges=192.168.88.10-192.168.88.254}
:if ([:len [find name="pool-livre"]] = 0) do={add name=pool-livre ranges=192.168.89.10-192.168.89.254}
/ip dhcp-server
:if ([:len [find name="dhcp-lan"]] = 0) do={add name=dhcp-lan interface=bridge-lan address-pool=pool-lan lease-time=1h disabled=no}
:if ([:len [find name="dhcp-livre"]] = 0) do={add name=dhcp-livre interface=bridge-livre address-pool=pool-livre lease-time=1h disabled=no}
/ip dhcp-server network
:if ([:len [find address="192.168.88.0/24"]] = 0) do={add address=192.168.88.0/24 gateway=192.168.88.1 dns-server=192.168.88.1}
:if ([:len [find address="192.168.89.0/24"]] = 0) do={add address=192.168.89.0/24 gateway=192.168.89.1 dns-server=192.168.89.1}
/ip dns set allow-remote-requests=yes
:foreach host in={"manostech-system.com.br";"*.manostech-system.com.br";"idzvginmbesnkcaapehh.supabase.co"} do={
  :if ([:len [/ip hotspot walled-garden ip find dst-host=$host]] = 0) do={/ip hotspot walled-garden ip add dst-host=$host action=accept comment="MANOS-PORTAL"}
}
:if ([:len [/ip firewall nat find comment="MANOS-NAT-INTERNET"]] = 0) do={/ip firewall nat add chain=srcnat out-interface=bridge-wan action=masquerade comment="MANOS-NAT-INTERNET"}
# One WAN masquerade covers both RB-routed client networks; ether5 is bridged
# at layer 2 and is intentionally not routed/NATed by the RB.

# Captive portal base. The personalized activation file enables RADIUS later.
/ip hotspot profile
:if ([:len [find name="hsprof1"]] = 0) do={add name=hsprof1 hotspot-address=192.168.88.1 html-directory=flash/hotspot html-directory-override=flash/hotspot login-by=http-pap}
:if ([:len [/ip hotspot find name="hotspot1"]] = 0) do={/ip hotspot add name=hotspot1 interface=bridge-lan address-pool=pool-lan profile=hsprof1 disabled=no}
/ip hotspot set [find name="hotspot1"] idle-timeout=none keepalive-timeout=none login-timeout=none

# Per-visitor rate limits, session timeout and idle timeout are delivered by
# FreeRADIUS from the saved company/branch policy. No fixed aggregate cap here.

# ether4 remains outside bridge-lan as the employee 192.168.89.0/24 network.
# Its aggregate upload/download limit is 60M/60M.
# ether5 is bridged directly with ether1 as the provider-network extension and
# therefore has no HotSpot, DHCP or private NAT from the RB.
# Download this package's login.html as flash/hotspot/login.html and its
# alogin.html as flash/hotspot/alogin.html. The latter skips RouterOS's
# default "login successful" page and immediately opens the configured URL.

# Remove only obsolete objects created by the former Manos Tech templates.
:if ([:len [/queue simple find name="MANOS-WIFI-TOTAL"]] > 0) do={/queue simple remove [find name="MANOS-WIFI-TOTAL"]}
:if ([:len [/queue type find name="manos-pcq-upload"]] > 0) do={/queue type remove [find name="manos-pcq-upload"]}
:if ([:len [/queue type find name="manos-pcq-download"]] > 0) do={/queue type remove [find name="manos-pcq-download"]}
:if ([:len [/ip firewall nat find comment="MANOS-NAT-ETHER5-LIVRE"]] > 0) do={/ip firewall nat remove [find comment="MANOS-NAT-ETHER5-LIVRE"]}
:if ([:len [/ip firewall filter find comment="MANOS-BLOCK-ETHER5"]] > 0) do={/ip firewall filter remove [find comment="MANOS-BLOCK-ETHER5"]}

# Keep HotSpot guests and the employee network separate. These rules affect
# only traffic routed between the two private Manos networks; internet access
# through bridge-wan and the ether1/ether5 provider bridge remains unchanged.
:if ([:len [/ip firewall filter find comment="MANOS-ISOLATE-HOTSPOT-LIVRE"]] = 0) do={
  /ip firewall filter add chain=forward src-address=192.168.88.0/24 dst-address=192.168.89.0/24 action=drop place-before=0 comment="MANOS-ISOLATE-HOTSPOT-LIVRE"
} else={
  /ip firewall filter set [find comment="MANOS-ISOLATE-HOTSPOT-LIVRE"] chain=forward src-address=192.168.88.0/24 dst-address=192.168.89.0/24 action=drop disabled=no
  :local firstRule [:pick [/ip firewall filter find] 0]
  :local isolationRule [:pick [/ip firewall filter find comment="MANOS-ISOLATE-HOTSPOT-LIVRE"] 0]
  :if ($isolationRule != $firstRule) do={ /ip firewall filter move $isolationRule destination=$firstRule }
}
:if ([:len [/ip firewall filter find comment="MANOS-ISOLATE-LIVRE-HOTSPOT"]] = 0) do={
  /ip firewall filter add chain=forward src-address=192.168.89.0/24 dst-address=192.168.88.0/24 action=drop place-before=0 comment="MANOS-ISOLATE-LIVRE-HOTSPOT"
} else={
  /ip firewall filter set [find comment="MANOS-ISOLATE-LIVRE-HOTSPOT"] chain=forward src-address=192.168.89.0/24 dst-address=192.168.88.0/24 action=drop disabled=no
  :local firstRule [:pick [/ip firewall filter find] 0]
  :local isolationRule [:pick [/ip firewall filter find comment="MANOS-ISOLATE-LIVRE-HOTSPOT"] 0]
  :if ($isolationRule != $firstRule) do={ /ip firewall filter move $isolationRule destination=$firstRule }
}

# Guests cannot reach the provider subnet (systems and printers) or the
# RouterOS IP administration services. The employee network remains allowed
# to use the provider subnet through ether5/bridge-wan.
:if ([:len [/ip firewall filter find comment="MANOS-GUEST-BLOCK-PROVIDER"]] = 0) do={
  /ip firewall filter add chain=forward src-address=192.168.88.0/24 dst-address=192.168.0.0/24 action=drop place-before=0 comment="MANOS-GUEST-BLOCK-PROVIDER"
}
:if ([:len [/ip firewall filter find comment="MANOS-GUEST-BLOCK-MANAGEMENT-TCP"]] = 0) do={
  /ip firewall filter add chain=input src-address=192.168.88.0/24 protocol=tcp dst-port=21,22,23,8291,8728,8729 action=drop place-before=0 comment="MANOS-GUEST-BLOCK-MANAGEMENT-TCP"
}
:if ([:len [/ip firewall filter find comment="MANOS-GUEST-BLOCK-MANAGEMENT-UDP"]] = 0) do={
  /ip firewall filter add chain=input src-address=192.168.88.0/24 protocol=udp dst-port=161 action=drop place-before=0 comment="MANOS-GUEST-BLOCK-MANAGEMENT-UDP"
}

# Shared 60/60 Mbps cap for ether4 only. The guest (.88) and WAN bridge
# (ether1/ether5) are outside this queue.
:if ([:len [/queue simple find name="MANOS-ETHER4-TOTAL"]] = 0) do={
  /queue simple add name="MANOS-ETHER4-TOTAL" target=192.168.89.0/24 max-limit=60M/60M comment="MANOS-ETHER4-60M"
} else={
  /queue simple set [find name="MANOS-ETHER4-TOTAL"] target=192.168.89.0/24 max-limit=60M/60M disabled=no comment="MANOS-ETHER4-60M"
}
