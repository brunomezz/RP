# Auditoria funcional · ERP compartilhado 0.4

## Atualização da versão 0.5

A continuidade desta auditoria entregou a aba Segurança, administração de vínculos/poderes, suspensão/reativação, cadastro de obras, histórico administrativo, proteção do último administrador e revogação validada no commit operacional. Também foram acrescentados estados de configuração pendente/suspensão, tempo limite de conexão e preservação dos rascunhos dos outros formulários do pedido. Ver [SEGURANCA.md](SEGURANCA.md) e [TESTES_COMPARTILHADOS.md](TESTES_COMPARTILHADOS.md).

Os resultados abaixo descrevem a rodada original da 0.4. Os itens de gestão de acesso e preservação de rascunhos citados como sugestões foram implementados na 0.5. Reservas, divergências estruturadas, orçamento, negociação, alçadas e escala continuam pendentes; exigem evolução dos respectivos fluxos.

## Alcance e resultado

Auditoria em ambiente separado, na branch `codex/shared-erp`, com dados fictícios, D1/R2 locais no Miniflare e Chromium. Foram percorridas as **14 telas** e os fluxos principais de almoxarifado, engenharia, suprimentos e diretor. **14 testes de domínio/filtros, 9 de integração e 3 roteiros de navegador passaram.** Build Fetch/Workers gerado sem publicar.

O usuário relatou uma homologação com servidor e login conectados no Sites. Não recebemos sua URL nem a implementação do adapter desse site. Esta auditoria comprova os resultados locais descritos, não a operação real da homologação, nem uma revisão exaustiva de segurança, carga ou todos os casos possíveis. Nenhum site da equipe foi substituído. Ver [TESTES_COMPARTILHADOS.md](TESTES_COMPARTILHADOS.md) para as evidências e limites.

## Problemas confirmados e corrigidos

| Problema observado | Correção e evidência |
| --- | --- |
| Login reconhecido sem cadastro no ERP deixava “Conectando…” visível | Estados distintos para login necessário (401), acesso pendente (403) e servidor indisponível. Identidade consultada sem conceder acesso ao ERP. Botão Verificar acesso, limpeza dos dados carregados e controles desabilitados enquanto bloqueado; roteiro `browser_access.py`. |
| Quantidades como 0,3 recebidas/medidas em 0,1 + 0,2 deixavam resíduos ou impediam a última parcela | Soma decimal nas quantidades, saldos e limites dos formulários. Teste de domínio e fluxo real de recebimento, medição e saída; excesso continua recusado. |
| Saída de estoque com catálogo vazio causava erro JavaScript | Orientação para cadastrar material antes da saída; regressão de interface com catálogo vazio simulado. |
| Botão Cancelar de formulário para consulta era desabilitado junto dos campos | Fechar/cancelar continua disponível, mantendo campos e ações de gravação bloqueados; verificado em contrato consultado por suprimentos. |
| Unidade cadastrada com markup era inserida como HTML em estoque e indicação de saldo | Escape do texto da unidade e dos cabeçalhos dinâmicos. Teste cadastra `<svg/onload=alert(1)>` pela API: aparece como texto, sem elemento SVG nem diálogo. Não representa revisão completa de todos os campos. |

As telas e o CSV das movimentações também passaram a mostrar **retirante/responsável** e **operador autenticado** separadamente. As permissões e regras de aprovação existentes foram preservadas. Nenhuma função é atribuída automaticamente para resolver um 403.

A correção decimal evita resíduos em novos cálculos. Não reescreve automaticamente quantidades já persistidas com resíduos; eventual reconciliação precisa de análise e execução explícitas.

## Rodada por setor

| Setor | Funções exercitadas |
| --- | --- |
| Almoxarifado | Nova solicitação mista, data/local por item, revisão após devolução, recebimentos parcial e completo com NF/anexo, saída em duas parcelas e saldo final zero, estoque/movimentações/CSV. |
| Engenharia | Devolução com motivo, confirmação de vínculo orçamentário, aprovação da necessidade, medições parciais até o saldo contratual. Testes de API verificam serviço inválido/de outra obra e autoria. |
| Suprimentos | Material, fornecedor e edição de contato; três propostas; bloqueio de envio com uma proposta sem exceção; sugestão de fornecedor; anexos de proposta e pedido; reenvio após devolução; atualização de chegada. |
| Diretor de engenharia | Bloqueio sem previsão ou sem decisão; devolução com motivo; escolha diferente da sugestão; emissão de pedido e contrato a partir da mesma solicitação. Testes de API verificam função errada e aprovações concorrentes. |
| Acompanhamento | Painel, listas por etapa, orçamento, relatórios de atraso, filtros e limpeza, exportações e histórico com autores. |

Telas percorridas: painel, solicitações, cotações, aprovações, pedidos, recebimentos, contratos, medições, estoque, movimentações, materiais, fornecedores, relatórios e orçamento. A ausência de exceções JavaScript nesses roteiros não mede desempenho com muitos registros.

## Sugestões por setor — ainda não implementadas

**P1:** próxima evolução operacional. **P2:** conveniência e expansão. As sugestões abaixo exigem definição e implementação próprias; não mudam as regras atuais.

| Setor | P1 | P2 |
| --- | --- | --- |
| Almoxarifado | Conferência de entrega com divergência de quantidade, material/unidade ou avaria; tratar devolução e transferência com histórico; reservas e estoque mínimo. | Localização física do material, checklist e leitura de código. |
| Engenharia | Comparar contratado/executado/consumido com quantidades e valores do orçamento real; alertar desvios para decisão; definir aprovação de medição e evidências da execução. | Importação validada do orçamento e visão do consumo por serviço/pavimento. |
| Suprimentos | Comparativo por item do custo com frete e condições; explicitar o frete após dividir fornecedores; propostas parciais e versões de negociação; preservar alterações/anexos ainda não salvos ao atualizar outro formulário do mesmo pedido. | Alertas de prazo, desempenho dos fornecedores e modelos de solicitação de proposta. |
| Diretor de engenharia | Resumo da decisão com custo, impacto no orçamento, alternativas, exceções e anexos; definir eventuais alçadas por valor com a empresa. | Indicadores de decisões pendentes e comparação histórica de contratação. |
| Administração e relatórios | Gestão de funções/obras, paginação do histórico e limpeza de uploads abandonados com política definida; distinguir contratação de conclusão da execução. | Quantidades no padrão brasileiro, códigos curtos para consulta e paginação/busca das listas. |

Foi observado que salvar uma previsão reconstrói o diálogo do pedido. Uma seleção de arquivo feita durante essa gravação pode se perder antes de ser enviada. O teste aguarda a conclusão da gravação antes de selecionar o arquivo; a versão 0.5 passou a preservar os rascunhos dos outros formulários e bloqueia temporariamente a edição durante a gravação, com regressão no navegador.

## Prioridades técnicas antes de ampliar o uso

1. Na homologação real, confirmar o helper oficial de autenticação, DB/R2 persistentes, sessões de duas pessoas e acesso às obras. Trazer a adaptação real para o repositório; o adapter de produção desta branch continua pendente e retorna 503. Preservar a integração já realizada pelo Sites ao incorporar estas correções.
2. Configurar funções reais e orçamento por obra, revisar backup/restauração e repetir a validação após publicação da homologação. O acesso ao site não substitui as funções do ERP.
3. Normalizar o agregado operacional antes de volume elevado: o limite atual é 1 MiB e as escritas são serializadas. Avaliar revisões por entidade no estoque; a revisão global hoje pode gerar conflitos entre ações independentes, mas impede gravações inconsistentes.
4. Definir retenção/paginação da auditoria (consulta atual de até 500 ações por obra), limpeza de anexos abandonados e importação explícita, caso necessária. Não migrar automaticamente dados do navegador.

## Reproduzir sem publicar

Com Node 22+ e Python/Playwright/Chromium disponíveis:

```sh
npm ci
npm run check
FES_DEV_DATA_DIR=/tmp/fes-auditoria-isolada npm start
```

Em outro terminal, com o servidor local ativo na porta padrão 3010:

```sh
python tests/browser_access.py
python tests/browser_shared.py
python tests/browser_audit.py
```

Os roteiros criam dados fictícios nesse ambiente. `PORT` e `FES_CHROMIUM` permitem ajustar porta/executável. Não apontar os roteiros para produção. A recuperação de acesso concedido/revogado e erros de conexão é simulada exclusivamente para testar a interface; compartilhamento, comandos, anexos e autorização usam o backend local real.
