# SisFat — Manual do Usuário (versão fictícia 3.2)

O SisFat é o sistema de faturamento da empresa Aurora Serviços. Ele reúne o cadastro de clientes, o cálculo das cobranças, a emissão de notas fiscais e o acompanhamento de chamados de suporte. Este manual descreve os principais recursos e as regras de operação.

## 1. Visão geral

O SisFat organiza o trabalho em quatro módulos: Cadastro, Contratos, Faturamento e Atendimento. Cada módulo tem um responsável designado na área financeira, e todas as alterações ficam registradas em uma trilha de auditoria que pode ser consultada por 24 meses.

O acesso é feito pelo navegador, com autenticação em dois fatores. Os perfis disponíveis são Operador, Analista e Administrador. Somente o perfil Administrador pode alterar parâmetros de cálculo e regras de rateio.

## 2. Contratos e centros de custo

Cada contrato possui um ou mais centros de custo, que representam as áreas do cliente que consomem o serviço, como Operações, Comercial e Tecnologia. O valor mensal do contrato é dividido entre esses centros por meio do rateio por centro de custo.

O rateio por centro de custo pode ser configurado de duas formas. Na forma percentual, o Administrador informa a fatia de cada centro, e a soma deve ser exatamente 100%. Na forma proporcional ao consumo, o SisFat usa as horas de serviço registradas no mês em cada centro. Quando um centro não tem consumo no período, ele recebe apenas a taxa mínima de 2% do valor do contrato.

Mudanças no rateio só valem a partir do próximo ciclo de faturamento. Alterações feitas depois do fechamento do lote não afetam cobranças já geradas.

## 3. Lote de faturamento

O lote de faturamento é o conjunto de cobranças calculadas de uma só vez para todos os contratos ativos. O lote roda automaticamente no quinto dia útil de cada mês, às 22h, no horário de Brasília. Antes disso, no terceiro dia útil, o SisFat gera uma prévia do lote para conferência pelo Analista.

Durante a conferência, o Analista pode corrigir lançamentos, aplicar descontos aprovados e bloquear contratos em disputa. Contratos bloqueados ficam fora do lote e são faturados no ciclo seguinte. Depois do fechamento, o lote só pode ser reaberto pelo Administrador, com justificativa registrada.

## 4. Emissão de NF-e

Ao fechar o lote de faturamento, o SisFat emite a NF-e de cada cobrança de forma automática, sem necessidade de aprovação manual. A comunicação com a Secretaria da Fazenda acontece em segundo plano, e o status de cada nota aparece na tela de Faturamento como Autorizada, Pendente ou Rejeitada.

Notas rejeitadas normalmente têm problema no cadastro do cliente, como CNPJ inválido ou endereço incompleto. Após corrigir o cadastro, use a ação Reemitir. O SisFat tenta reenviar notas pendentes a cada 15 minutos por até 24 horas. O cancelamento de uma NF-e é permitido em até 24 horas após a autorização e exige perfil Administrador.

## 5. Atendimento e SLA

Os chamados de suporte são classificados em três prioridades: crítica, alta e normal. O SLA de atendimento 4 h vale para chamados críticos, ou seja, a primeira resposta deve ocorrer em até 4 horas corridas, a qualquer hora do dia. Para chamados de prioridade alta, o prazo é de 8 horas úteis, e para os normais, de 2 dias úteis.

Chamados críticos são aqueles que impedem a emissão de notas ou a execução do lote de faturamento. Quando o prazo está perto de vencer, o SisFat avisa o responsável por e-mail e no painel. Se o SLA for descumprido, o contrato recebe crédito de 3% do valor mensal, aplicado automaticamente no lote seguinte.

## 6. Relatórios e integrações

O SisFat oferece relatórios de faturamento por cliente, por centro de custo e por período, que podem ser exportados em planilha ou PDF. A integração com o ERP financeiro é feita por arquivo diário, gerado à 1h da manhã. Integrações por API estão disponíveis a partir do plano Empresarial.

## 7. Boas práticas

Mantenha o cadastro dos clientes sempre atualizado, revise a prévia do lote no terceiro dia útil e registre qualquer exceção de rateio com justificativa. Em caso de dúvida sobre cobrança, consulte primeiro a trilha de auditoria antes de abrir um chamado.
