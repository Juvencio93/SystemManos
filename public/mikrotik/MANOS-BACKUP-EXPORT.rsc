# Exportacao local de recuperacao Manos Tech. Nao envia arquivos ao sistema.
# Execute localmente ou pela ether4, antes de uma alteracao de rede.
:local baseName "flash/manos-backup-latest"
/export hide-sensitive file=$baseName
:put ("MANOS-BACKUP|EXPORT|" . $baseName . ".rsc")
:put "MANOS-BACKUP|NOTE|O arquivo nao contem senhas; guarde uma copia fora da RB."
