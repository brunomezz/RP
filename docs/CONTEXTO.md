# Contexto do ERP Fasolo e Simon

ERP próprio para substituir o Sienge progressivamente, começando por engenharia e suprimentos, no computador. Notas privadas do Obsidian e outras conversas não são sincronizadas automaticamente pelo GitHub.

## Fluxo e regras preservadas

Almoxarifado solicita → engenharia valida necessidade e orçamento → suprimentos cota e sugere fornecedores → diretor de engenharia **decide** e aprova → pedido ou contrato → recebimento ou medição.

- Cada solicitação informa obra, finalidade e itens. Cada item tem material/serviço, quantidade, unidade, **data necessária e local próprios**. O autor vem da sessão no servidor.
- Materiais e fornecedores são cadastros da empresa; estoque e orçamento são separados por obra. Engenharia confirma o serviço orçamentário; despesa não prevista exige justificativa.
- Três fornecedores ou exceção justificada; comparar preços, escopo, frete, prazo e pagamento. Sugestão por item não substitui decisão explícita do diretor.
- Materiais geram pedidos e serviços geram contratos; contratação mista separa componentes. Documentos são emitidos por fornecedor escolhido. Frete aplicado uma vez por fornecedor; em contratação mista fica no pedido, caso exista.
- Chegada estimada por item, ajustável por suprimentos. Recebimentos parciais exigem nota fiscal, respeitam o saldo e atualizam estoque sem registrar pagamento.
- Anexos nas propostas, pedidos e recebimentos, até 10 MiB por arquivo, com download autorizado.
- Saída registra retirante e serviço de destino; o responsável pela operação é identificado separadamente pela sessão. Saldo negativo é bloqueado.
- Devolução exige motivo. Revisão antes da emissão arquiva cotações anteriores e reinicia a conferência técnica; não existe revisão contratual após emissão.
- Medição registra execução dentro do saldo contratual, pela engenharia, sem movimentar estoque. Fluxo financeiro, boletins, retenções e assinaturas ainda não definidos.

## Estado da próxima versão

Branch `codex/shared-erp`, versão 0.4, desenvolvida no checkout separado `/workspace/RP-shared`. Interface com navegação agrupada, filtros, materiais/fornecedores e identidade visual oficial preservada. O checkout anterior e o site da equipe não foram substituídos ou publicados.

A interface compartilhada lê/grava pela API; não usa localStorage/IndexedDB como banco e não importa registros ou anexos antigos. O protótipo offline com exemplos está separado em `prototype/`. Não há importação nesta versão.

## Arquitetura escolhida

Backend Fetch/Workers para Sites com D1 (`DB`), R2 privado (`BUCKET`) e Sign in with ChatGPT. Não depende do antigo servidor Node em produção. A identidade autenticada é adaptada pelo helper oficial e as permissões internas são consultadas em `memberships` por obra/função, no servidor.

`migrations/0001_shared.sql` cria estado operacional vazio, obras, funções, arquivos, auditoria e operações idempotentes. O estado inicial não contém exemplos nem pessoas de teste. Orçamentos reais são configurados por obra; `scripts/provision-sql.mjs` valida uma configuração administrativa explícita e gera SQL revisável, sem conectar ao banco. Campos de recursos e configuração estão em [IMPLANTACAO_SITES.md](IMPLANTACAO_SITES.md).

Comandos aceitam campos específicos e revisão esperada; rejeitam ações fora de função/obra/etapa. Um batch D1 transacional compara a revisão e grava operação, auditoria e finalização de anexos junto ao estado. A mesma chave idempotente não executa novamente; revisão desatualizada retorna 409. Identidade e horário do histórico vêm do servidor. Arquivos reservados são enviados ao R2 e ficam acessíveis somente depois de vinculados por comando autorizado.

## Verificação e configuração pendente

13 testes de domínio e 9 testes de integração passaram. Teste Chromium com cinco sessões isoladas passou. Incluem compartilhamento, restart/logout locais, permissões diretas na API, concorrência, anexos e autoria; detalhes em [TESTES_COMPARTILHADOS.md](TESTES_COMPARTILHADOS.md). Rodar `npm ci` e `npm run check`; `npm start` inicia apenas desenvolvimento local com D1/R2 e identidades fictícias de teste.

A documentação fornecida declara D1/R2 e helpers de autenticação no starter Sites. Ainda faltam o esquema oficial de `.openai/hosting.json`, import/assinatura/formato de identidade do helper e validação em um novo site de homologação. A consulta direta à documentação foi bloqueada pelo proxy deste ambiente. `hosting/sites-auth.mjs` recusa acesso com 503 enquanto não for conectado ao helper oficial. Portanto, **login e banco remoto funcionando no Sites não foram demonstrados**. Não usar a autenticação de teste como substituto.

Não incluir credenciais no código/GitHub. Se o starter exigir segredos, preenchê-los somente nas configurações seguras do Sites. Configurações locais e bancos de teste são ignorados pelo Git. Preservar bindings de banco/bucket nas futuras publicações para manter os dados; não recriar nem resetar recursos em deploy.

## Limites e próximos passos

O agregado operacional tem limite conservador de 1 MiB; novas escritas acima desse tamanho falham sem perda de dados. Esse modelo serializa escritas e precisa ser normalizado antes de uso volumoso. Ainda faltam paginação da auditoria além das 500 ações recentes por obra, limpeza automática de uploads abandonados e eventual importação explícita com validação/IDs de origem. Não existe integração fiscal/contábil, pagamento, reservas, devoluções de estoque, transferência entre obras ou administração de funções pela interface.

Conectar o adapter/manifesto reais, configurar obras/serviços e funções e repetir o roteiro na homologação. Avaliar backup e escala antes de operação real. Esta tarefa autoriza desenvolvimento/teste e entrega do código; **não** substituição ou publicação do site usado pela equipe.
