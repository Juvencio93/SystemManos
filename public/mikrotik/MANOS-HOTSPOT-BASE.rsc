# Manos Tech - kit-base RouterOS v7
# Universal template. Import the device activation file after this one.
# Never put RADIUS/WireGuard secrets or certificate private keys in this file.

# WAN: ether1 is the provider input and ether5 is a direct provider-network
# extension. The DHCP client belongs to the WAN bridge, not to ether1.
:if ([:len [/interface bridge find name="bridge-wan"]] = 0) do={/interface bridge add name=bridge-wan protocol-mode=rstp}
:if ([:len [/interface bridge port find bridge="bridge-wan" interface=ether1]] = 0) do={/interface bridge port add bridge=bridge-wan interface=ether1}
:if ([:len [/interface bridge port find bridge="bridge-wan" interface=ether5]] = 0) do={/interface bridge port add bridge=bridge-wan interface=ether5}
:if ([:len [/ip dhcp-client find interface=bridge-wan]] = 0) do={/ip dhcp-client add interface=bridge-wan disabled=no comment="MANOS-WAN"}

# Portal files directory.
:if ([:len [/file find name="flash/hotspot"]] = 0) do={/file add name=flash/hotspot type=directory}

/interface bridge add name=bridge-lan protocol-mode=rstp
/interface bridge port add bridge=bridge-lan interface=ether2
/interface bridge port add bridge=bridge-lan interface=ether3
/interface bridge add name=bridge-livre protocol-mode=rstp
/interface bridge port add bridge=bridge-livre interface=ether4
/ip address add address=192.168.88.1/24 interface=bridge-lan
/ip address add address=192.168.89.1/24 interface=bridge-livre
/ip pool add name=pool-lan ranges=192.168.88.10-192.168.88.254
/ip pool add name=pool-livre ranges=192.168.89.10-192.168.89.254
/ip dhcp-server add name=dhcp-lan interface=bridge-lan address-pool=pool-lan lease-time=1h disabled=no
/ip dhcp-server add name=dhcp-livre interface=bridge-livre address-pool=pool-livre lease-time=1h disabled=no
/ip dhcp-server network add address=192.168.88.0/24 gateway=192.168.88.1 dns-server=192.168.88.1
/ip dhcp-server network add address=192.168.89.0/24 gateway=192.168.89.1 dns-server=192.168.89.1
/ip dns set allow-remote-requests=yes
/ip hotspot walled-garden ip add dst-host="manostech-system.com.br" action=accept
/ip hotspot walled-garden ip add dst-host="*.manostech-system.com.br" action=accept
/ip hotspot walled-garden ip add dst-host="idzvginmbesnkcaapehh.supabase.co" action=accept
/ip firewall nat add chain=srcnat out-interface=bridge-wan action=masquerade comment="MANOS-NAT-INTERNET"
/ip firewall nat add chain=srcnat src-address=192.168.89.0/24 out-interface=bridge-wan action=masquerade comment="MANOS-NAT-REDE-LIVRE"

# Captive portal base. The personalized activation file enables RADIUS later.
/ip hotspot profile add name=hsprof1 hotspot-address=192.168.88.1 html-directory=flash/hotspot html-directory-override=flash/hotspot login-by=http-pap
/ip hotspot add name=hotspot1 interface=bridge-lan address-pool=pool-lan profile=hsprof1 disabled=no
/ip hotspot set [find name="hotspot1"] idle-timeout=none keepalive-timeout=none login-timeout=none

# Guest aggregate cap for a 100 Mbps connection. ether4 is outside bridge-lan,
# and ether5 is a direct provider-network extension; therefore this cap never
# includes either free/internal or provider-side traffic. PCQ shares
# available guest bandwidth fairly among active visitor addresses.
/queue type add name=manos-pcq-upload kind=pcq pcq-classifier=src-address
/queue type add name=manos-pcq-download kind=pcq pcq-classifier=dst-address
/queue simple add name="MANOS-WIFI-TOTAL" target=192.168.88.0/24 max-limit=60M/60M queue=manos-pcq-upload/manos-pcq-download comment="Guest Wi-Fi aggregate cap; ether5 excluded"

# ether4 remains outside bridge-lan as the free 192.168.89.0/24 network.
# ether5 is bridged directly with ether1 as the provider-network extension and
# therefore has no HotSpot, DHCP or private NAT from the RB.
# Download this package's login.html as flash/hotspot/login.html and its
# alogin.html as flash/hotspot/alogin.html. The latter skips RouterOS's
# default "login successful" page and immediately opens the configured URL.
