# ERP Fasolo e Simon · 0.10.0 em desenvolvimento

Esta branch implementa registros compartilhados, administração de usuários/cargos na aba **Segurança**, permissões no servidor, histórico e anexos para a próxima versão. Acrescenta relatórios PDF por etapa, compartilhamento por e-mail, notificações individuais e importação de PDFs com revisão antes do cadastro. Preserva o fluxo de suprimentos e a identidade visual descritos em [docs/CONTEXTO.md](docs/CONTEXTO.md) e [docs/IDENTIDADE_VISUAL.md](docs/IDENTIDADE_VISUAL.md).

**Nenhum site existente foi substituído ou publicado.** O backend foi validado com D1/R2 no runtime local da Cloudflare. A conexão ao login real do ChatGPT e o manifesto do Sites ainda dependem do starter oficial: o adapter de produção falha com 503 enquanto não estiver conectado. Não apresentar esta branch como ERP já funcionando no Sites.

## Testar no Windows sem criar um site

O pacote pessoal está em [Downloads de testes](https://github.com/brunomezz/RP/releases). Baixe o ZIP **RP-Testes-0.10.0-Windows-x64.zip**, use **Extrair tudo** e abra **RP-Testes.exe**. O GitHub gera e testa o pacote no Windows antes de disponibilizá-lo; se a release ainda não existir, confira [Pacote pessoal Windows](https://github.com/brunomezz/RP/actions/workflows/personal-windows.yml).

Sem instalar Node.js, sem comandos e sem login do ChatGPT. Abre no navegador como Admin; a faixa de teste permite usar outro cargo. Funciona sem internet após o download. Dados apenas neste computador; e-mails são simulados e não são entregues. Mantenha a janela do programa aberta e use Encerrar ao terminar.

Para atualizar, encerre a versão antiga e extraia a nova em outra pasta. Os dados ficam em `%LOCALAPPDATA%\FasoloSimon\RP-Testes\data`, separados do pacote; antes de outra versão abrir a base, é criado backup. Não abrir uma versão antiga em uma base atualizada. Sem sincronização ou envio ao Sites. Instruções e limites: [docs/TESTE_PESSOAL.md](docs/TESTE_PESSOAL.md).

## Arquitetura

- Interface HTML/CSS/JavaScript preservada, agora consumindo `/api/*` na mesma origem. Atualiza ao entrar, abrir outra tela e clicar em **Atualizar**. Sem gravação de registros em localStorage ou IndexedDB; sem sincronização automática de formulários abertos.
- Backend Fetch/Workers em `hosting/worker.mjs` e `shared/api.mjs`, sem servidor Node em produção. Pode ser chamado pelas rotas do starter com os bindings D1/R2 e a identidade autenticada pelo helper oficial.
- **DB**: D1/SQLite persistente. Cadastro único de obras; cargos globais em `user_roles`, projetados em `memberships` para todas as obras; estado operacional em `erp_state`; operações idempotentes, auditoria e metadados de arquivos em tabelas próprias.
- **BUCKET**: R2 privado. Upload/download passam pelo backend; o cliente não recebe acesso direto ao bucket. Até **10 MiB (10 × 1024² bytes)** por arquivo, preservando o limite anterior.
- A interface distingue **Login necessário** (401), **Acesso ao ERP pendente** (403) e **Servidor indisponível** (falha de rede/serviço). Login reconhecido sem função não fica em “Conectando…”. **Verificar acesso** consulta novamente as permissões sem recarregar a página; nenhum acesso é concedido automaticamente.
- **Sign in with ChatGPT**: autentica a pessoa; não atribui funções do ERP. A API consulta funções e obras no D1 a cada requisição. Sem cargo operacional ou administração explícita, retorna 403.
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
npm run test:integration   # 38 testes D1/R2, segurança, autenticação de teste e concorrência
npm run build:sites        # bundle Fetch, sem publicação
npm run demo               # HTML offline separado, somente exemplos locais
```

Teste opcional de navegador, com o servidor de desenvolvimento ativo, Python, Playwright e Chromium instalados:

```sh
python tests/browser_shared.py
python tests/browser_access.py
python tests/browser_audit.py
python tests/browser_security.py
python tests/browser_navigation.py
python tests/browser_user_powers.py
# Para o roteiro abaixo: iniciar com FES_TEST_MAIL=1 (envio simulado, nunca real)
python tests/browser_communication.py
```

`FES_CHROMIUM` indica o executável, padrão `/usr/bin/chromium`. A auditoria funcional, correções e sugestões por setor estão em [docs/AUDITORIA_FUNCIONAL.md](docs/AUDITORIA_FUNCIONAL.md). Os resultados e seu alcance estão em [docs/TESTES_COMPARTILHADOS.md](docs/TESTES_COMPARTILHADOS.md).

## Administração e primeiro acesso

Em **Administração → Segurança**, o administrador define o cargo das pessoas, configura poderes dos quatro cargos operacionais e exceções por usuário, suspende/reativa usuários e cadastra obras. A pessoa entra uma vez e aparece na lista mesmo com acesso pendente. Os poderes iniciais preservam o fluxo existente; mudanças exigem motivo e entram no histórico. Não é permitido remover o último administrador ativo.

Aplicar as migrações pendentes, incluindo `migrations/0002_security.sql` e `migrations/0003_communication.sql` e `migrations/0004_user_powers.sql` e cadastrar explicitamente o primeiro administrador com o procedimento de [docs/SEGURANCA.md](docs/SEGURANCA.md). Não há promoção automática de visitantes. Depois disso, a gestão ocorre na própria interface. O SQL inicial pode ser gerado por `scripts/bootstrap-admin.mjs`; nenhum segredo novo é necessário.

Os pedidos preservam campos/anexos ainda não salvos nos outros formulários do diálogo. Login, falta de acesso, suspensão, configuração incompleta e indisponibilidade têm mensagens próprias; as chamadas têm tempo limite de 20 segundos.

## Implantar posteriormente no Sites

Texto pronto para encaminhar ao Sites: [docs/PROMPT_SITES_0_8.md](docs/PROMPT_SITES_0_8.md).

Procedimento completo, configurações e pendências: [docs/IMPLANTACAO_SITES.md](docs/IMPLANTACAO_SITES.md). Criar **outro site de homologação**, com D1/R2 próprios; não reutilizar o banco ou bucket de produção.

O usuário informou que uma homologação foi conectada pelo Sites. Essa adaptação não está nesta branch e não foi acessada nesta auditoria. Ao trazer as correções, preserve o helper real de autenticação e os recursos já configurados; não substitua essa integração pelo adapter pendente deste repositório.

Para configurar outro ambiente diretamente desta branch, faltam o exemplo oficial de `.openai/hosting.json`, o import/assinatura do helper `requireChatGPTUser()`, e acesso à homologação do Sites para provisionar e verificar os recursos e sessões reais. Até então, o adapter de produção bloqueia acesso. Nenhum segredo deve ser enviado pelo chat ou colocado no código, no manifesto ou no GitHub.

## Integridade e limites

Comandos específicos validam função, obra, conteúdo, etapa e revisão do registro. O servidor não aceita um estado completo enviado pelo navegador. Cada comando usa `Idempotency-Key`; edição concorrente retorna 409. Mudança operacional, auditoria, idempotência e vinculação de arquivos são gravadas em um batch transacional D1 com comparação de revisão. Um batch que perde a disputa não insere auditoria nem finaliza arquivos. Recebimentos e saídas atualizam estoque dentro dessa mesma operação.

Esta implementação inicial mantém o estado operacional em um agregado JSON, limitado conservadoramente a **1 MiB**, com tabelas separadas para acesso, auditoria, operações e arquivos. Isso simplifica a integridade do fluxo existente, mas serializa escritas e não é adequado a um ERP de grande volume. Ao atingir o limite, novas escritas são recusadas sem apagar dados. Antes de ampliar o uso, normalizar as entidades e migrar transações, mantendo as garantias e os testes. O orçamento real precisa ser configurado por obra; não há integração contábil/fiscal, pagamentos, reservas de estoque, retenções ou revisão após emissão.

Há importação explícita de PDFs com extração e revisão; não há importação do banco antigo do navegador. Nunca copiar seu snapshot para o D1. Consulte [docs/RELATORIOS_DOCUMENTOS.md](docs/RELATORIOS_DOCUMENTOS.md) para os limites de extração e a configuração de e-mail. O histórico da API limita a consulta a 500 ações recentes por obra; o histórico dos registros continua no estado. Ainda faltam paginação da auditoria e rotina automática de limpeza dos uploads abandonados. A publicação no GitHub não implanta o ERP nem comprova funcionamento no Sites.

## Ajustes de usabilidade · 0.6.1

O botão Nova solicitação fica visível no Painel e em Solicitações. Sem o poder de criar na obra selecionada, fica desativado com orientação, em vez de desaparecer. Na 0.6.1, administrador sem vínculo operacional via como cadastrar/liberar obra e cargo. Na 0.7, o cargo Admin passa a ter acesso total explícito. O cabeçalho separa identidade, filtro de obra e os botões Atualizar/Histórico/Notificações. Sem obra liberada, mostra essa condição explicitamente. Relatórios e documentos usam seu próprio campo Obra; nessas telas o filtro global é ocultado com orientação.

Para trazer a correção ao RP — Testes, atualizar somente a homologação com o código mais recente da branch, preservando o login oficial e os mesmos recursos D1/R2. Na 0.8, aplicar a migração 0005 pendente: cadastrar obra a disponibiliza automaticamente a todos com cargo ativo. O poder Criar solicitações continua necessário.

## Segurança simplificada · 0.7

Segurança tem quatro abas: Usuários, Poderes por cargo, Obras e Histórico. Na ficha da pessoa, selecionar seu cargo. Todas as obras atuais e futuras ficam disponíveis automaticamente. Mais de um cargo permite funções cumulativas globais. Personalizar poderes permite Seguir cargo, Permitir ou Bloquear por pessoa/obra, com resultado efetivo ao lado. Bloqueio individual prevalece sobre todos os cargos nessa obra; herança acompanha as próximas alterações do cargo.

**Admin tem acesso total a todas as obras atuais e futuras, a todas as ações e à Segurança.** Os administradores já explicitamente cadastrados passam a representar esse cargo nesta atualização. Não promove visitantes nem cargos comuns. Admin não aceita redução de poderes; escolher outro cargo para limitar a pessoa. Suspensão continua bloqueando a conta; o último Admin ativo é protegido. Regras de processo e integridade continuam obrigatórias.

Aplicar a migração pendente `0004_user_powers.sql` na homologação antes de usar a 0.7; ela cria `user_permissions`, preserva dados/cargos e não restaura poderes removidos. Não há novo segredo. Exceções, vínculos e promoção/demissão de Admin são salvos com motivo, revisão, auditoria e idempotência na mesma transação. Permissões individuais não atribuem cargo a uma pessoa sem função. Relatórios/e-mail/notificações consideram o Admin e os poderes efetivos.

## Cadastro único de obras · 0.8

Uma obra pertence à empresa: o Admin a cadastra uma vez e todos os usuários ativos com cargo acessam as obras atuais e futuras. Basta informar o nome; o código é opcional e gerado automaticamente. Nome/código repetido é recusado no servidor. Estoque, orçamento e vínculos de registros continuam separados por obra.

A ficha de usuário não pede seleção de obras. O cargo é global; pode ser definido antes da primeira obra. Sem cargo, o login permanece pendente; suspensão bloqueia a conta. Poderes por cargo e exceções por pessoa/obra continuam disponíveis.

Aplicar **0005_company_works.sql** depois das migrações anteriores, sem recriar D1/R2. Ela transforma a união dos cargos ativos antigos em cargos globais e estende o acesso a todas as obras, conforme solicitado. Preserva registros, anexos, exceções e Admins; não atribui cargo a visitantes nem restaura cargos removidos quando reaplicada. Cadastro de obra e mudança de cargo atualizam o acesso na mesma transação com revisão, idempotência e histórico. Não há novo segredo.
