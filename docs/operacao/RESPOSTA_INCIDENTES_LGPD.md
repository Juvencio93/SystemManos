# Procedimento de resposta a incidentes e vazamento de dados

Revisão: 7 de outubro de 2026.

## Quando abrir um incidente

Abrir registro ao detectar acesso indevido, vazamento, perda, alteração, indisponibilidade relevante, credencial exposta, envio de dados ao destinatário errado ou suspeita consistente de comprometimento.

## Primeiras ações

### De 0 a 1 hora

1. Registrar data, origem do alerta, sistemas afetados e pessoa responsável.
2. Preservar logs e evidências; não apagar registros para “limpar” o ambiente.
3. Conter o incidente: revogar sessão, token ou chave comprometida; bloquear a rota afetada; isolar a integração quando necessário.
4. Informar imediatamente o responsável técnico e o encarregado de privacidade.

### De 1 a 4 horas

1. Identificar categorias de dados, titulares, quantidade estimada e período exposto.
2. Verificar se houve extração, alteração ou apenas possibilidade de acesso.
3. Corrigir a causa inicial e impedir recorrência imediata.
4. Classificar severidade e impacto operacional.

### Até 24 horas

1. Consolidar a linha do tempo.
2. Avaliar risco ou dano relevante aos titulares.
3. Preparar comunicação clara, sem especulações, com natureza dos dados, medidas adotadas, riscos e canal de contato.
4. Acionar assessoria jurídica ou encarregado quando houver dúvida sobre notificação.

## Comunicação externa

Quando o incidente puder causar risco ou dano relevante, a decisão de comunicação deve ser tratada como urgente. A regulamentação da ANPD estabelece comunicação à ANPD e aos titulares em até 3 dias úteis, ressalvadas regras legais específicas.

Não enviar nomes, CPF, tokens, senhas ou dados completos pelo Telegram. O alerta operacional deve conter apenas o identificador do incidente, severidade e orientação para abrir o painel seguro.

## Encerramento

1. Confirmar contenção e correção.
2. Trocar as credenciais afetadas e revisar acessos relacionados.
3. Validar o sistema com teste técnico e teste de permissão.
4. Registrar causa raiz, impacto confirmado, comunicações, responsáveis e lições aprendidas.
5. Criar tarefas corretivas com prazo e responsável.
6. Manter o registro do incidente por pelo menos 5 anos.

## Modelo de registro

- Identificador:
- Data e hora da detecção:
- Responsável:
- Origem do alerta:
- Sistemas e fornecedores envolvidos:
- Categorias de dados:
- Quantidade estimada de titulares:
- Período do incidente:
- Evidências preservadas:
- Ações de contenção:
- Avaliação de risco ou dano relevante:
- Decisão sobre comunicação à ANPD e titulares:
- Data das comunicações:
- Causa raiz:
- Correções permanentes:
- Data de encerramento:

## Contatos a manter atualizados

- Responsável técnico da Manos Tech.
- Encarregado ou canal de privacidade.
- Suporte do Supabase e do provedor de hospedagem.
- Assessoria jurídica.
- Responsável pela comunicação aos clientes.
