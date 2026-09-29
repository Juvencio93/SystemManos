# Manos Tech - kit-base RouterOS v7
# This file is reusable. Do NOT place a campaign slug, RADIUS secret,
# WireGuard private key or certificate private key in this file.
#
# Import only after the device-specific activation file has been generated.
# Default topology: ether1 WAN, ether2-ether4 captive LAN, ether5 free LAN.

/interface bridge add name=bridge-lan protocol-mode=rstp
/interface bridge port add bridge=bridge-lan interface=ether2
/interface bridge port add bridge=bridge-lan interface=ether3
/interface bridge port add bridge=bridge-lan interface=ether4
/ip address add address=192.168.88.1/24 interface=bridge-lan
/ip pool add name=pool-lan ranges=192.168.88.10-192.168.88.254
/ip dhcp-server add name=dhcp-lan interface=bridge-lan address-pool=pool-lan lease-time=1h disabled=no
/ip dhcp-server network add address=192.168.88.0/24 gateway=192.168.88.1 dns-server=192.168.88.1
/ip dns set allow-remote-requests=yes
/ip firewall nat add chain=srcnat out-interface=ether1 action=masquerade comment="MANOS-NAT-INTERNET"

# The activation file imports the certificate, sets the unique RouterOS
# identity, creates WireGuard/RADIUS and enables this HotSpot profile.
# Upload artifacts/login.html as flash/hotspot/login.html and
# artifacts/alogin.html as flash/hotspot/alogin.html before enabling.
