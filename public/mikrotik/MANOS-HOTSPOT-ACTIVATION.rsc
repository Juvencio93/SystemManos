# Manos Tech - activation template (RouterOS v7)
# Replace only the three values below before importing.
:local routerIdentity "MT-IDENTIDADE"
:local radiusSecret "COLE_O_SEGREDO_RADIUS_AQUI"
:local radiusHost "***REMOVED***"

/system identity set name=$routerIdentity
/radius remove [find service=hotspot]
/radius add service=hotspot address=$radiusHost secret=$radiusSecret authentication-port=1812 accounting-port=1813 timeout=3s require-message-auth=no
/ip hotspot profile set [find name="hsprof1"] use-radius=yes radius-accounting=yes login-by=http-chap,http-pap html-directory=flash/hotspot html-directory-override=flash/hotspot
/ip hotspot enable [find name="hotspot1"]

# Heartbeat: replace MANOS_HEARTBEAT_TOKEN with the token issued for this installation.
/system scheduler add name="MANOS-HEARTBEAT" interval=5m on-event="/tool fetch http-method=post http-header-field=\"Content-Type: application/json,X-Manos-Heartbeat: MANOS_HEARTBEAT_TOKEN\" http-data=\"{\\\"routerIdentity\\\":\\\"MT-IDENTIDADE\\\",\\\"mac\\\":\\\"[ /interface ethernet get ether1 mac-address ]\\\",\\\"ip\\\":\\\"[ /ip address get [find interface=ether1] address ]\\\",\\\"version\\\":\\\"[ /system resource get version ]\\\"}\" url=\"https://manostech-system.com.br/api/internal/hotspot-heartbeat\" keep-result=no"
