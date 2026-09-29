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
