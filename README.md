# ERP Fasolo e Simon · 0.4 em desenvolvimento

Esta branch implementa registros compartilhados, permissões no servidor, histórico e anexos para a próxima versão. Preserva o fluxo de suprimentos e a identidade visual descritos em [docs/CONTEXTO.md](docs/CONTEXTO.md) e [docs/IDENTIDADE_VISUAL.md](docs/IDENTIDADE_VISUAL.md).

**Nenhum site existente foi substituído ou publicado.** O backend foi validado com D1/R2 no runtime local da Cloudflare. A conexão ao login real do ChatGPT e o manifesto do Sites ainda dependem do starter oficial: o adapter de produção falha com 503 enquanto não estiver conectado. Não apresentar esta branch como ERP já funcionando no Sites.

## Arquitetura

- Interface HTML/CSS/JavaScript preservada, agora consumindo `/api/*` na mesma origem. Atualiza ao entrar, abrir outra tela e clicar em **Atualizar**. Sem gravação de registros em localStorage ou IndexedDB; sem sincronização automática de formulários abertos.
- Backend Fetch/Workers em `hosting/worker.mjs` e `shared/api.mjs`, sem servidor Node em produção. Pode ser chamado pelas rotas do starter com os bindings D1/R2 e a identidade autenticada pelo helper oficial.
- **DB**: D1/SQLite persistente. Obras e funções por identidade em `memberships`; estado operacional em `erp_state`; operações idempotentes, auditoria e metadados de arquivos em tabelas próprias.
- **BUCKET**: R2 privado. Upload/download passam pelo backend; o cliente não recebe acesso direto ao bucket. Até **10 MiB (10 × 1024² bytes)** por arquivo, preservando o limite anterior.
- A interface distingue **Login necessário** (401), **Acesso ao ERP pendente** (403) e **Servidor indisponível** (falha de rede/serviço). Login reconhecido sem função não fica em “Conectando…”. **Verificar acesso** consulta novamente as permissões sem recarregar a página; nenhum acesso é concedido automaticamente.
- **Sign in with ChatGPT**: autentica a pessoa; não atribui funções do ERP. A API consulta funções e obras no D1 a cada requisição. Sem cadastro interno, retorna 403.
- Exemplos fictícios e a versão offline estão em `prototype/`. O banco de produção começa sem solicitações, pedidos, contratos, estoque, materiais ou usuários de teste. Nenhum dado antigo do navegador é enviado, alterado ou removido.

A escolha do backend nativo segue as capacidades informadas da documentação [Sites](https://learn.chatgpt.com/docs/sites): D1, R2 e autenticação gerenciada. Supabase via HTTPS exigiria outro provisionamento e uma sessão autenticada própria; a identidade do ChatGPT não é automaticamente uma sessão do Supabase. O backend nativo evita essa dependência. O esquema exato do manifesto e a assinatura do helper não puderam ser conferidos neste ambiente: a consulta direta à documentação recebeu bloqueio do proxy. Não foi inventado um `.openai/hosting.json`.

## Desenvolver e testar separadamente

Node.js **22 ou superior**; dependências fixadas no lockfile. Neste ambiente o checkout de desenvolvimento está em `/workspace/RP-shared`, branch `codex/shared-erp`; o checkout anterior permanece em `/workspace/RP`.

```sh
npm ci --cache /tmp/fes-npm-cache
npm run check
npm start
```

`npm start` executa **somente desenvolvimento**, em `127.0.0.1:3010`, usando Miniflare/workerd, D1 local persistente e R2 local. A faixa “DESENVOLVIMENTO LOCAL” permite trocar entre identidades fictícias de teste. Esse mecanismo não integra o build do Sites. `PORT` altera a porta; `FES_DEV_DATA_DIR` escolhe um diretório isolado de dados, padrão `.dev-data/` (ignorado pelo Git). Reiniciar o processo conserva os dados desse diretório; apagá-lo apaga apenas o ambiente local. Não usar esse servidor como login ou hospedagem de produção.

```sh
npm test                   # 14 testes de domínio/filtros
npm run test:integration   # 9 testes D1/R2, autenticação de teste e concorrência
npm run build:sites        # bundle Fetch, sem publicação
npm run demo               # HTML offline separado, somente exemplos locais
```

Teste opcional de navegador, com o servidor de desenvolvimento ativo, Python, Playwright e Chromium instalados:

```sh
python tests/browser_shared.py
python tests/browser_access.py
python tests/browser_audit.py
```

`FES_CHROMIUM` indica o executável, padrão `/usr/bin/chromium`. A auditoria funcional, correções e sugestões por setor estão em [docs/AUDITORIA_FUNCIONAL.md](docs/AUDITORIA_FUNCIONAL.md). Os resultados e seu alcance estão em [docs/TESTES_COMPARTILHADOS.md](docs/TESTES_COMPARTILHADOS.md).

## Implantar posteriormente no Sites

Procedimento completo, configurações e pendências: [docs/IMPLANTACAO_SITES.md](docs/IMPLANTACAO_SITES.md). Criar **outro site de homologação**, com D1/R2 próprios; não reutilizar o banco ou bucket de produção.

O usuário informou que uma homologação foi conectada pelo Sites. Essa adaptação não está nesta branch e não foi acessada nesta auditoria. Ao trazer as correções, preserve o helper real de autenticação e os recursos já configurados; não substitua essa integração pelo adapter pendente deste repositório.

Para configurar outro ambiente diretamente desta branch, faltam o exemplo oficial de `.openai/hosting.json`, o import/assinatura do helper `requireChatGPTUser()`, e acesso à homologação do Sites para provisionar e verificar os recursos e sessões reais. Até então, o adapter de produção bloqueia acesso. Nenhum segredo deve ser enviado pelo chat ou colocado no código, no manifesto ou no GitHub.

## Integridade e limites

Comandos específicos validam função, obra, conteúdo, etapa e revisão do registro. O servidor não aceita um estado completo enviado pelo navegador. Cada comando usa `Idempotency-Key`; edição concorrente retorna 409. Mudança operacional, auditoria, idempotência e vinculação de arquivos são gravadas em um batch transacional D1 com comparação de revisão. Um batch que perde a disputa não insere auditoria nem finaliza arquivos. Recebimentos e saídas atualizam estoque dentro dessa mesma operação.

Esta implementação inicial mantém o estado operacional em um agregado JSON, limitado conservadoramente a **1 MiB**, com tabelas separadas para acesso, auditoria, operações e arquivos. Isso simplifica a integridade do fluxo existente, mas serializa escritas e não é adequado a um ERP de grande volume. Ao atingir o limite, novas escritas são recusadas sem apagar dados. Antes de ampliar o uso, normalizar as entidades e migrar transações, mantendo as garantias e os testes. O orçamento real precisa ser configurado por obra; não há integração contábil/fiscal, pagamentos, reservas de estoque, retenções ou revisão após emissão.

Não há importação nesta versão. Caso necessária, desenvolver uma importação explícita e validada com identificadores de origem e prevenção de duplicidade; não copiar o snapshot do navegador para o D1. O histórico da API limita a consulta a 500 ações recentes por obra; o histórico dos registros continua no estado. Ainda faltam paginação da auditoria e rotina automática de limpeza dos uploads abandonados. A publicação no GitHub não implanta o ERP nem comprova funcionamento no Sites.
