# Manos Tech - instala as paginas do portal na pasta do HotSpot.
# Antes de importar, envie login.html e alogin.html para a raiz de Files.

:put "MANOS-HOTSPOT-PAGES|BEGIN|1"
:if ([:len [/file find where name="flash/hotspot"]] = 0) do={
  /file add name="/flash/hotspot" type=directory
}

:local loginSource [/file find where name="login.html"]
:if ([:len $loginSource] = 0) do={
  :put "MANOS-HOTSPOT-PAGES|LOGIN|MISSING"
} else={
  :if ([:len [/file find where name="flash/hotspot/login.html"]] > 0) do={
    /file remove [find where name="flash/hotspot/login.html"]
  }
  /file copy [:pick $loginSource 0] name="flash/hotspot/login.html"
  :if ([:len [/file find where name="flash/hotspot/login.html"]] > 0) do={
    /file remove [:pick $loginSource 0]
    :put "MANOS-HOTSPOT-PAGES|LOGIN|INSTALLED"
  } else={
    :put "MANOS-HOTSPOT-PAGES|LOGIN|FAILED"
  }
}

:local aloginSource [/file find where name="alogin.html"]
:if ([:len $aloginSource] = 0) do={
  :put "MANOS-HOTSPOT-PAGES|ALOGIN|MISSING"
} else={
  :if ([:len [/file find where name="flash/hotspot/alogin.html"]] > 0) do={
    /file remove [find where name="flash/hotspot/alogin.html"]
  }
  /file copy [:pick $aloginSource 0] name="flash/hotspot/alogin.html"
  :if ([:len [/file find where name="flash/hotspot/alogin.html"]] > 0) do={
    /file remove [:pick $aloginSource 0]
    :put "MANOS-HOTSPOT-PAGES|ALOGIN|INSTALLED"
  } else={
    :put "MANOS-HOTSPOT-PAGES|ALOGIN|FAILED"
  }
}

:put "MANOS-HOTSPOT-PAGES|END|1"
