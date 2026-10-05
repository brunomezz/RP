# Implantação futura no Sites · homologação 0.8

## Situação verificável

A API usa somente Request/Response, Web Crypto, D1 e R2. O build não inclui o servidor Node de desenvolvimento nem o serviço de identidades fictícias. A API e os anexos foram exercitados no runtime local da Cloudflare; não há recursos remotos provisionados ou login real do Sites testado nesta tarefa.

A documentação fornecida informa declarações D1/R2 em `.openai/hosting.json` e helpers `getChatGPTUser()` / `requireChatGPTUser()` no starter. Faltam **o esquema completo do manifesto, o módulo importado, a assinatura do helper e o formato de sua identidade**. O acesso direto a `learn.chatgpt.com` foi bloqueado pelo proxy deste ambiente. `hosting/requirements.json` é uma lista de requisitos para a adaptação, **não** um manifesto reconhecido pelo Sites. Não publicar o adapter provisório como integração concluída.

## Recursos e configurações necessárias

| Nome | Configuração | Onde preencher |
| --- | --- | --- |
| `DB` | Binding D1 persistente, exclusivo da homologação | Declaração oficial do starter no `.openai/hosting.json`; provisionamento Sites |
| `BUCKET` | Binding R2 privado, exclusivo da homologação | Declaração oficial do starter; sem acesso público ao bucket |
| `ASSETS` | Serviço estático do starter ou adaptação de suas rotas estáticas | Starter; servir `dist/sites/public` |
| Login | Sign in with ChatGPT e helper server-side | Starter/configuração do Sites |
| Primeiro administrador | Identidade estável explicitamente escolhida | Operador do D1/Sites; procedimento em SEGURANCA.md |
| Obras, cargos e poderes | Vínculos por pessoa e ações de cada cargo | Aba Segurança, API autorizada pelo servidor |
| Orçamento | Serviços e valores reais por obra | Procedimento administrativo validado no D1 |
| `RESEND_API_KEY` | Chave privada do serviço Resend, opcional para habilitar envio | Segredos server-side do Sites; nunca navegador/chat/GitHub |
| `REPORT_EMAIL_FROM` | Remetente de domínio verificado no Resend | Variáveis server-side do Sites |

`DB`, `BUCKET` e `ASSETS` são objetos/bindings, não strings com credenciais. Não enviar chaves R2/D1 para o navegador. O acesso ao site é separado de `memberships`: um visitante autenticado pode continuar sem permissão no ERP.

## Sequência para implantação, sem alterar o site em uso

1. Selecionar a branch `codex/shared-erp` e criar **novo site de homologação**, com URL, D1 e R2 separados. Não publicar sobre o site atual e não apontar para seus recursos.
2. Obter o starter oficial. Declarar `DB` e `BUCKET` segundo seu manifesto real e configurar os assets. O backend pode ser integrado às rotas do starter pela função `createERPHandler(requireUser)`, sem iniciar `server.mjs` nem `npm start` no Sites.
3. Substituir somente `hosting/sites-auth.mjs` por uma chamada ao **helper oficial de autenticação no servidor**. Adaptar seu resultado a `{id, name}`, usando a identidade estável do provedor. Confirmar sua assinatura e contexto antes de implementar o import. Não aceitar identidade em cabeçalho customizado, formulário, query, cookie não validado, localStorage ou JWT decodificado sem verificação. Não criar fallback para identidade de teste.
4. Executar `migrations/0001_shared.sql` e `migrations/0002_security.sql`, seguidas de `migrations/0003_communication.sql` `migrations/0004_user_powers.sql` e `migrations/0005_company_works.sql`, nessa ordem, no D1 de homologação com o mecanismo de migrações do starter. Em ambiente existente, aplicar apenas as migrações pendentes. A migração cria tabelas e um estado vazio com `INSERT OR IGNORE`; executá-la novamente não reseta o estado. Nunca apagar/recriar o banco durante uma atualização do site.
5. Entrar com cada pessoa em homologação e consultar `/api/identity` (retorna somente a identidade da própria sessão). O endpoint funciona para pessoas autenticadas antes do cadastro de função, sem abrir acesso aos registros; o nome/identificador passa a aparecer para o administrador.
6. Configurar explicitamente o primeiro administrador pelo procedimento de [SEGURANCA.md](SEGURANCA.md), usando `scripts/bootstrap-admin.mjs`. A pessoa clica Verificar acesso e passa a administrar usuários/cargos/obras pela aba Segurança. Para configurar o orçamento real ou preparar a configuração inicial em lote, copiar `hosting/work-config.example.json` para um arquivo local ignorado, por exemplo `work-config.local.json`, e preencher obras, serviços reais e os IDs estáveis de identidade. Gerar SQL com `node scripts/provision-sql.mjs work-config.local.json > /tmp/fes-config.sql`, revisar e executar **somente no D1 de homologação**, com escritas suspensas durante a configuração. O script valida nomes, IDs e funções; não inclui pessoas/exemplos automaticamente. Não conecta ao banco. Adicionar materiais pela tela de Cadastros, como suprimentos.
7. Executar `npm ci` e `npm run check`. Confirmar que o build do starter usa o backend e os assets apropriados. `npm run build:sites` gera o bundle em `dist/sites/worker.mjs` e a interface em `dist/sites/public`; não publica.
8. Fazer o roteiro abaixo no **novo site**. Registrar os resultados com a identidade real, incluindo redirecionamentos de login, renovação/encerramento de sessão e chamadas HTTP. Só uma implantação e esses testes poderão confirmar compatibilidade completa do starter.
9. Após aprovação futura da equipe, planejar implantação de produção e migração, com backup e mudança controlada. Esta tarefa não autoriza substituir o site atualmente usado.

## Poderes iniciais dos cargos

| Função | Ações permitidas em suas obras |
| --- | --- |
| `almoxarifado` | Criar/revisar solicitações antes da emissão; receber materiais; registrar saídas |
| `engenharia` | Validar necessidade e serviço orçamentário; devolver na conferência técnica; medir serviços |
| `suprimentos` | Cadastrar fornecedores/materiais; cotar; anexar propostas/pedidos; sugerir fornecedores; enviar ao diretor; ajustar chegada |
| `diretor` | Escolher fornecedores por item; aprovar contratação; devolver a suprimentos |

Leitura dos registros, anexos finalizados e histórico exige acesso ativo à obra. Materiais e fornecedores são cadastros da empresa, compartilhados entre pessoas com acesso ao ERP. Uma pessoa pode acumular cargos globais, válidos em todas as obras; o papel não vem do login nem de botões visíveis. Depois do primeiro administrador, gerenciar cargos e poderes pela aba Segurança. Os endpoints administrativos exigem sessão autorizada, motivo e revisão; não permitem autopromoção por um usuário comum.

O SQL gerado adiciona obras, ativa as funções explicitamente indicadas e inicializa o orçamento de uma obra **apenas se ainda não configurado**. Não sobrescreve serviços existentes nem migra registros. Para revogar acesso, remover os cargos ou suspender a pessoa pela aba Segurança. Não reaplicar uma configuração SQL antiga que reative esse acesso. Após a implantação, usar a API administrativa para que revisão de segurança e histórico acompanhem as mudanças; alterações diretas no D1 ficam restritas à configuração inicial ou recuperação controlada, com a aplicação sem escritas. Alterações de orçamento em uso exigem revisão dos vínculos e migração própria.

A migração 0002 conserva os vínculos existentes e inicializa os poderes uma única vez. Alterações no cargo valem para todas as obras em que a pessoa possui esse cargo. Os poderes da tabela acima são os valores iniciais; a delegação explícita pelo administrador pode modificá-los. Na 0.7, Admin tem acesso total a todas as obras e ações, sem vínculo operacional adicional; as regras de etapa e integridade permanecem.

## Roteiro obrigatório em homologação real

- Pessoa sem cargo entra e aparece como acesso pendente. Admin a libera pela aba Segurança; ela clica Verificar acesso e entra na mesma sessão. Suspender/reativar e retirar um poder deve alterar também o resultado da chamada direta à API.
- Verificar que ninguém consegue remover/suspender o último administrador e que o histórico identifica autor, motivo e valores antes/depois.
- Duas contas ChatGPT, dois navegadores: almoxarifado cria; engenharia vê ao abrir/Atualizar, na obra cadastrada, disponível a ambos sem associação por pessoa.
- Sair/entrar, reiniciar/republicar a homologação **mantendo os mesmos bindings**: dados e anexos continuam.
- Almoxarifado e suprimentos chamam a API de aprovação diretamente: 403, nenhum pedido emitido. Pessoa sem cadastro interno também recebe 403.
- Diretor aprova simultaneamente em duas abas; almoxarifado repete recebimento/saída: um efeito para o mesmo comando; conflito 409 para revisões diferentes desatualizadas. Conferir saldo e auditoria.
- Suprimentos envia anexo; engenharia/diretor autorizados baixam os mesmos bytes. Usuário sem cargo, suspenso ou sem sessão não baixa. Tamanho acima de 10 MiB é recusado no servidor.
- Conferir ator, horário e motivo no histórico. Forjar nome/função no corpo/cabeçalho não muda a identidade.
- Verificar login, retorno ao aplicativo, cookies/sessão e logout reais do starter. A autenticação fictícia de desenvolvimento não verifica esses comportamentos.

## Atualizações, recuperação e arquivos

Preservar os mesmos recursos D1/R2 entre versões; versionar migrações sem apagar dados. Antes de migrações estruturais, obter backup/exportação do D1 e inventário/backup do R2 conforme os recursos administrativos da plataforma. As operações e auditoria precisam ser restauradas junto ao estado para conservar idempotência e atribuição.

Uploads são reservados no D1 e enviados ao R2, ainda privados. A finalização ocorre na mesma transação do registro. Uploads cancelados podem ficar órfãos e indisponíveis para download. Para limpeza administrativa futura, selecionar arquivos `finalized=0` suficientemente antigos, excluir primeiro o objeto R2 correspondente e depois seus metadados D1; não excluir uploads ativos. Não há rotina automática nesta versão. Não remover `operations` sem uma política que preserve a prevenção de repetição.

Nenhuma migração/importação de localStorage ou IndexedDB foi implementada. A equipe mantém o site anterior e seus dados. Se houver importação futura, exigir escolha explícita, pré-validação das obras/serviços, IDs de origem, relatório de conflitos e tratamento separado dos arquivos.

## Comunicação e PDFs na homologação

Preservar o helper real já conectado ao Sites. Aplicar somente migrações pendentes. Cadastrar e-mail dos colaboradores pela aba Segurança e conferir os novos poderes. Para envio real, configurar conta/domínio Resend e as duas variáveis apenas no ambiente seguro; permitir HTTPS para `api.resend.com`. Não ativar `FES_TEST_MAIL` no Sites: é um fixture exclusivo do servidor local.

Verificar com duas contas reais: relatório de cada etapa, PDF baixável, envio a destinatário autorizado, notificação individual/lida, importação de PDF textual, revisão e confirmação única, download por outra sessão, rejeição de vínculo operacional com obra diferente e de ação sem poder. Usar um destinatário de teste consentido para envio real e conferir a caixa de entrada; aceite da API não comprova entrega. Validar limites de CPU/memória/tamanho do bundle e PDFs no runtime efetivo do Sites, especialmente arquivos complexos. Não houve publicação nem verificação remota nesta tarefa. Ver [RELATORIOS_DOCUMENTOS.md](RELATORIOS_DOCUMENTOS.md).

## Atualização da Segurança para 0.7

Aplicar somente a migração 0004 se as anteriores já estiverem executadas. Preserva dados/vínculos, acrescenta exceções; administradores já cadastrados tornam-se Admin de acesso total (obras atuais/futuras). Revisar quais identidades já possuem administração antes da atualização. Não conceder Admin ao primeiro visitante ou por nome/e-mail. Testar edição de cargo, Permitir/Bloquear/Seguir cargo por usuário, mesma ação por API, Admin global e proteção do último ativo. Destinatários de e-mail e notificações precisam usar o backend atualizado, além da interface. Não modificar apenas a aparência dos botões.

## Atualização para 0.8 — obra cadastrada uma vez

Preservar login oficial, D1 e R2 da homologação. Aplicar migrações pendentes 0001–0005 em ordem; em ambiente 0.7, somente `0005_company_works.sql`. Não resetar nada. Ela converte a união dos cargos antigos ativos em cargos globais e disponibiliza todas as obras atuais e futuras a cada pessoa com cargo, conforme solicitado. Suspensão continua válida; visitantes sem cargo não ganham acesso. Nenhuma obra/registro/anexo é copiado. Exceções por usuário/obra são mantidas.

O gerador `scripts/provision-sql.mjs` mantém a entrada administrativa antiga `memberships`, mas emite cargos globais e acesso a todas as obras. O `workId` dessa configuração não limita o alcance do cargo; usar Segurança após a configuração inicial. Não reaplicar configurações antigas que reativem cargos removidos.

Testar com duas contas reais: cadastrar cargo antes de obra; criar obra com apenas nome; conferir código automático e acesso de ambos sem marcar obras. Criar solicitação e consultar na outra conta. Testar nova obra, duplicidade, troca/remoção de cargo, suspensão, poderes individuais e aprovações indevidas pela API. Conferir histórico e persistência após republicação com os mesmos recursos. As verificações locais documentadas não substituem esta validação do Sites.
