# Diagnostico de seguranca Manos Tech. Somente leitura: nao altera a RB.
:put "MANOS-SECURITY|BEGIN|1"
:put ("MANOS-SECURITY|ROUTEROS|" . [/system resource get version])
:foreach serviceId in=[/ip service find] do={
  :local disabled [/ip service get $serviceId disabled]
  :local enabled false
  :if ($disabled = false) do={ :set enabled true }
  :put ("MANOS-SECURITY|SERVICE|" . [/ip service get $serviceId name] . "|" . $enabled)
}
:do {
  :local ipv6Disabled [/ipv6 settings get disable-ipv6]
  :local ipv6Enabled false
  :if ($ipv6Disabled = false) do={ :set ipv6Enabled true }
  :put ("MANOS-SECURITY|IPV6|" . $ipv6Enabled)
} on-error={ :put "MANOS-SECURITY|IPV6|unknown" }
:foreach userId in=[/user find] do={
  :put ("MANOS-SECURITY|USER|" . [/user get $userId name] . "|" . [/user get $userId group])
}
:local backupCount [:len [/file find where name~"manos-backup"]]
:local backupAvailable false
:if ($backupCount > 0) do={ :set backupAvailable true }
:put ("MANOS-SECURITY|BACKUP|" . $backupAvailable)
:put "MANOS-SECURITY|AP-ISOLATION|manual-check"
:put "MANOS-SECURITY|END|1"
