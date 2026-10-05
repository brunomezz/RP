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

Branch `codex/shared-erp`, versão 0.8.1, desenvolvida no checkout separado `/workspace/RP-shared`. Interface com navegação agrupada, filtros, materiais/fornecedores e identidade visual oficial preservada. O checkout anterior e o site da equipe não foram substituídos ou publicados.

A interface compartilhada lê/grava pela API; não usa localStorage/IndexedDB como banco e não importa registros ou anexos antigos. O protótipo offline com exemplos está separado em `prototype/`. Há importação explícita de PDFs, com sugestões revisadas antes de criar solicitação ou proposta. Não há importação do banco antigo do navegador.

## Arquitetura escolhida

Backend Fetch/Workers para Sites com D1 (`DB`), R2 privado (`BUCKET`) e Sign in with ChatGPT. Não depende do antigo servidor Node em produção. A identidade autenticada é adaptada pelo helper oficial e as permissões internas são definidas em `user_roles` globalmente e projetadas em `memberships` para todas as obras, no servidor.

`migrations/0001_shared.sql` cria estado operacional vazio, obras, funções, arquivos, auditoria e operações idempotentes. O estado inicial não contém exemplos nem pessoas de teste. Orçamentos reais são configurados por obra; `scripts/provision-sql.mjs` valida uma configuração administrativa explícita e gera SQL revisável, sem conectar ao banco. Campos de recursos e configuração estão em [IMPLANTACAO_SITES.md](IMPLANTACAO_SITES.md).

Comandos aceitam campos específicos e revisão esperada; rejeitam ações fora de função/obra/etapa. Um batch D1 transacional compara a revisão e grava operação, auditoria e finalização de anexos junto ao estado. A mesma chave idempotente não executa novamente; revisão desatualizada retorna 409. Identidade e horário do histórico vêm do servidor. Arquivos reservados são enviados ao R2 e ficam acessíveis somente depois de vinculados por comando autorizado.

## Administração de acesso na versão 0.5

A aba **Segurança** administra usuários, cargos globais e poderes dos quatro cargos. Os poderes iniciais preservam as responsabilidades descritas acima; o administrador pode delegar/remover ações explicitamente. Na 0.7, Admin concede acesso operacional total às obras atuais e futuras. Na 0.8, todos os cargos ativos recebem automaticamente acesso às obras atuais e futuras, por solicitação do usuário. A leitura exige sessão com cargo ativo; os cadastros da empresa continuam compartilhados entre pessoas com acesso operacional.

`migrations/0002_security.sql` preserva os vínculos atuais e acrescenta usuários, administradores, poderes dos cargos, revisão de segurança, auditoria e idempotência administrativas. Todas as mudanças exigem motivo. Há proteção do último administrador ativo, validação por ação no servidor e conferência da revisão de segurança no commit operacional. O primeiro administrador é explicitamente configurado pelo operador do ambiente; demais concessões podem ser feitas pela aba. Procedimento: [SEGURANCA.md](SEGURANCA.md).

A pessoa aparece para o administrador depois de entrar uma vez, mesmo que ainda não tenha cargo. Após a liberação, Verificar acesso permite continuar sem recarregar. Suspensão e configuração pendente têm mensagens próprias. As chamadas têm tempo limite de 20 segundos, inclusive downloads. Os outros formulários do pedido preservam campos e anexos ainda não salvos ao gravar previsão, anexo ou recebimento.

## Correções da auditoria funcional

Login, acesso interno e indisponibilidade são apresentados separadamente; um login válido sem cargo mostra **Acesso ao ERP pendente**, identifica a pessoa e oferece **Verificar acesso**. Os dados carregados são descartados quando a sessão ou o acesso deixam de ser válidos. A API continua exigindo as permissões existentes.

Recebimentos, medições e saldo de estoque usam soma decimal para evitar resíduos de operações como 0,1 + 0,2. Valores anteriormente gravados com resíduos não são alterados automaticamente. Texto da unidade de material e cabeçalhos das tabelas é escapado antes da exibição. Catálogo vazio apresenta uma orientação na saída de estoque. Formulários apenas para consulta permitem fechar/cancelar. As movimentações exibem separadamente o retirante e o operador autenticado, inclusive no CSV.

Escopo, evidências e recomendações por setor: [AUDITORIA_FUNCIONAL.md](AUDITORIA_FUNCIONAL.md).

## Verificação e configuração pendente

14 testes de domínio e 38 testes de integração passaram. Oito roteiros Chromium passaram, incluindo comunicação/PDFs, navegação e poderes individuais, além de: administração real pela aba Segurança, compartilhamento com cinco sessões, estados de acesso e auditoria dos quatro setores pelas 14 telas. Incluem compartilhamento, restart/logout locais, permissões diretas na API, concorrência, anexos e autoria; detalhes em [TESTES_COMPARTILHADOS.md](TESTES_COMPARTILHADOS.md). Rodar `npm ci` e `npm run check`; `npm start` inicia apenas desenvolvimento local com D1/R2 e identidades fictícias de teste.

A documentação fornecida declara D1/R2 e helpers de autenticação no starter Sites. Ainda faltam o esquema oficial de `.openai/hosting.json`, import/assinatura/formato de identidade do helper e validação em um novo site de homologação. A consulta direta à documentação foi bloqueada pelo proxy deste ambiente. `hosting/sites-auth.mjs` recusa acesso com 503 enquanto não for conectado ao helper oficial. Portanto, **login e banco remoto funcionando no Sites não foram demonstrados**. Não usar a autenticação de teste como substituto. O usuário relatou integração funcional em uma homologação criada pelo Sites; a implementação desse site não foi trazida para esta branch nem verificada diretamente. Ao sincronizar as correções, preservar o helper real e os bindings existentes dessa homologação.

Não incluir credenciais no código/GitHub. Se o starter exigir segredos, preenchê-los somente nas configurações seguras do Sites. Configurações locais e bancos de teste são ignorados pelo Git. Preservar bindings de banco/bucket nas futuras publicações para manter os dados; não recriar nem resetar recursos em deploy.

## Limites e próximos passos

O agregado operacional tem limite conservador de 1 MiB; novas escritas acima desse tamanho falham sem perda de dados. Esse modelo serializa escritas e precisa ser normalizado antes de uso volumoso. Ainda faltam paginação da auditoria além das 500 ações recentes por obra, limpeza automática de uploads abandonados e migração explícita dos dados antigos com validação/IDs de origem. Não existe integração fiscal/contábil, pagamento, reservas, devoluções de estoque, transferência entre obras.

Conectar o adapter/manifesto reais, configurar obras/serviços e funções e repetir o roteiro na homologação. Avaliar backup e escala antes de operação real. Esta tarefa autoriza desenvolvimento/teste e entrega do código; **não** substituição ou publicação do site usado pela equipe.

## Relatórios, notificações e documentos · 0.6

A migração `0003_communication.sql` adiciona contatos, notificações individuais, documentos/extratos, rastreamento da confirmação de PDF e histórico de envio. Os poderes `reportsExport`, `reportsEmail` e `documentsImport` iniciam nos quatro cargos; podem ser retirados na aba Segurança, com validação na API. A migração não restaura poderes retirados quando reaplicada. O administrador cadastra e-mails; não se presume que o login forneça um endereço para envio.

Onze relatórios são gerados dos registros reais da obra autorizada. PDF e e-mail conferem a revisão da prévia; mudanças intermediárias pedem nova geração. Estoque permite posição na data final; orçamento é posição atual; filas de engenharia/diretor representam pendências atuais, não uma reconstrução histórica. Notificações são gravadas na mesma transação das ações e exibidas apenas ao destinatário autorizado; o contador é atualizado a cada 45 segundos com a tela ativa.

PDFs são armazenados no R2 privado, deduplicados por conteúdo/obra, com texto e autoria no D1. Extrair não cadastra nem movimenta estoque. O usuário revisa campos obrigatórios nos formulários existentes; confirmação e vínculo ao documento são atômicos e impedem reutilização para duplicar cadastros. PDFs digitalizados são guardados, mas exigem OCR ainda não configurado.

E-mails usam HTTPS para Resend, com PDF do servidor, destinatário cadastrado e autorizado, histórico, chave idempotente e repetição controlada. `RESEND_API_KEY` e `REPORT_EMAIL_FROM` são configurações seguras do Sites; não há envio real verificado nesta tarefa. Sem elas, PDF/notificações/importação continuam disponíveis. Detalhes: [RELATORIOS_DOCUMENTOS.md](RELATORIOS_DOCUMENTOS.md).

## Correção de navegação · 0.6.1

A criação de solicitação permanece validada no servidor, mas o botão deixa de ser ocultado quando falta poder: fica desativado e explica a liberação necessária. Administrador sem obra encontra a orientação para cadastrar obra e vincular seu próprio cargo. Filtro global com label Obra e indicação clara de ausência de acesso; telas com seleção própria deixam de mostrar um filtro desativado que não se aplica a elas. Cabeçalho divide navegação/identidade dos controles; layout verificado em 1366, 1024, 768 e 390 px. Não há migração nem concessão automática de acesso nesta correção.

## Cargo Admin e poderes individuais · 0.7

A pedido do usuário, o administrador anterior passa a ser o cargo **Admin**, com todas as funções e obras atuais/futuras. Vem apenas de `security_admins`, concedido explicitamente, nunca do nome, do primeiro acesso ou do login. Admin mantém etapas, limites, orçamento, autoria e concorrência. Não pode ser restringido por edição de cargo ou exceção; suspender bloqueia a conta, preservada a proteção do último Admin.

Migração `0004_user_powers.sql` adiciona exceções por usuário/obra/ação. Cargo fornece a base; Permitir acrescenta, Bloquear remove mesmo com vários cargos, Seguir cargo remove a exceção. Na 0.8, remover todos os cargos remove suas exceções; as obras são compartilhadas globalmente. Servidor carrega obras, cargos, exceções e revisão em um batch consistente e confere a revisão no commit. A interface mostra cargo atual e resultado efetivo e separa Usuários, Poderes por cargo, Obras e Histórico. Relatórios e destinatários usam os poderes efetivos; avisos incluem Admin. A atualização da homologação deve preservar autenticação oficial e D1/R2; não foi publicado o site da equipe.

## Obras da empresa e cargos globais · 0.8

A pedido do usuário, cadastrar a obra uma vez deve disponibilizá-la a todos. Usuários com cargo ativo veem todas as obras atuais e futuras; não há seleção de obra por usuário. O cargo pode ser atribuído antes da primeira obra. Admin continua total; login sem cargo e suspensão não recebem acesso. Poderes continuam controlando ações, com exceções individuais por obra. Estoque/orçamento e todos os vínculos operacionais permanecem específicos da obra.

Nome da obra obrigatório, código opcional automático; nomes normalizados (acentos/maiúsculas/espaços) e códigos sem distinção de maiúsculas são conferidos no servidor para evitar duplicidade. Obra e cargos são atualizados em batch D1 com revisão de segurança, auditoria e idempotência.

Migração `0005_company_works.sql`: cria `user_roles`, conserva a união dos cargos antigos ativos e preenche seu acesso a todas as obras. Amplia explicitamente o alcance dos cargos existentes, preservando dados/exceções/administradores. O marcador impede que uma reaplicação restaure cargos revogados. Aplicar apenas migrações pendentes, sem recriar D1/R2 ou autenticação. Atualização guiada em [PROMPT_SITES_0_8.md](PROMPT_SITES_0_8.md).

## Teste pessoal no Windows · 0.8.1

O usuário decidiu testar sozinho, sem ambiente online ou compartilhamento. `desktop/Launcher.cs` inicia o runtime Node incluído no pacote e abre o navegador; `scripts/local-launcher.mjs` inicia o mesmo backend de testes D1/R2, vinculado somente a 127.0.0.1. Entrada automática como Admin fictício e troca de cargos na faixa de teste. Nada disso integra o worker do Sites ou atribui identidades reais.

Banco e anexos permanecem em `%LOCALAPPDATA%\FasoloSimon\RP-Testes\data` entre versões. O iniciador bloqueia dois processos sobre a mesma base, encerra o runtime e copia um backup antes de abrir dados com versão diferente. Não há reset automático, sincronização ou migração para o Sites. E-mail sempre usa o transporte simulado; uso pessoal offline após baixar/extrair.

GitHub Actions compila no Windows x64, inclui Node 22.21.1 e dependências do lockfile, executa o smoke test pelo executável, gera ZIP/checksum e publica uma pré-release de teste. Release somente depois de testes aprovados; site da equipe e branch main permanecem intactos. Sem novos segredos do usuário. Detalhes em [TESTE_PESSOAL.md](TESTE_PESSOAL.md).
