# Segurança e administração · versão 0.7

## Como usar

Abra **Administração → Segurança**. Há quatro abas:

1. **Usuários:** escolha uma pessoa e responda “Qual é o cargo deste usuário?”: Engenharia, Almoxarifado, Suprimentos, Diretor de engenharia ou Admin. Marque as obras permitidas para cargos comuns. O nome mostra seu cargo atual; identificação da conta fica em detalhes para distinguir nomes iguais. A pessoa entra uma vez antes de aparecer na lista. Informe motivo e Salvar usuário.
2. **Poderes por cargo:** escolha o cargo e marque as ações padrão para todos com esse cargo. Admin é fixo, com todos os poderes.
3. **Obras:** consulte/cadastre obras. Começam com Despesa não prevista; orçamento real continua com o procedimento de IMPLANTACAO_SITES.md.
4. **Histórico:** autor autenticado, data/hora, motivo e antes/depois. Mostra as 100 alterações mais recentes; anteriores permanecem no banco.

Na ficha de Usuários, abra **Personalizar poderes deste usuário** e escolha a obra. Cada ação tem **Seguir cargo**, **Permitir** ou **Bloquear** e mostra Permitido/Bloqueado ao lado. Alterar só a pessoa não muda o cargo dos colegas. Seguir cargo acompanha mudanças futuras do padrão. Bloquear prevalece sobre todos os cargos da pessoa nessa obra. O botão Usar somente os poderes do cargo remove as exceções da obra selecionada. Sem vínculo, exceções não concedem acesso à obra. Ao retirar uma obra, suas exceções são removidas.

Para cargos diferentes entre obras ou vínculos antigos com vários cargos, o modo Definir por obra / manter vários cargos preserva os vínculos. Escolher um cargo padrão substitui os cargos das obras marcadas quando salvar. A seleção de cargo e obras não salva automaticamente.

**Admin tem acesso total** a todas as obras atuais e futuras, todos os poderes operacionais e Segurança. É global, sem necessidade de marcar cada obra. Os administradores já explicitamente concedidos passam a representar esse cargo na 0.7. Nenhuma pessoa comum é promovida pela migração. Não é possível bloquear um poder de Admin: para restringir, selecione outro cargo. Suspensão bloqueia também Admin, exceto quando deixaria a empresa sem Admin ativo.

Todos continuam respeitando etapas, orçamento, justificativa, escolha de fornecedores, saldos, revisões e anexos. Acesso total não ignora regras do processo. Poderes controlam ações; usuários com acesso à obra continuam podendo consultar seus registros, histórico e anexos. Não há restrição de leitura por módulo. Não há cargos personalizados além dos quatro operacionais e Admin.

## Primeiro administrador

A migração não promove o primeiro visitante e não transforma automaticamente um diretor em administrador. O primeiro administrador é escolhido explicitamente pelo responsável pelo ambiente:

1. Aplicar as migrações 0001, 0002, 0003 e `0004_user_powers.sql`, em ordem no D1 de homologação, pelo mecanismo de migrações do starter. Em banco existente, aplicar apenas as migrações ainda pendentes. Não resetar dados.
2. A pessoa escolhida entra com o login oficial. A tela de acesso pendente exibe seu identificador; `/api/identity` retorna somente a identidade da própria sessão. Esse acesso registra nome/identificador para a administração, sem conceder poder algum.
3. O operador do Sites gera SQL com `node scripts/bootstrap-admin.mjs IDENTIFICADOR_DA_SESSAO > /tmp/fes-admin.sql`, revisa e executa no D1 correto, com a aplicação sem escritas durante a configuração inicial. O identificador é o ID estável reconhecido pelo helper oficial, não um e-mail arbitrário.
4. O SQL só concede o primeiro acesso administrativo se a identidade já for conhecida, estiver ativa e ainda não houver administrador. Ele não conecta ao servidor e não escolhe o usuário. Conferir o SELECT final. A concessão inicial fica no histórico como **Configuração inicial via D1**, identificando que ocorreu pelo operador do ambiente, fora de uma sessão administrativa do ERP.
5. A pessoa clica em **Verificar acesso** e abre Segurança. Pode cadastrar a primeira obra e liberar os demais cargos pela interface. Admin acessa automaticamente as obras cadastradas. Sem obras existentes, consegue cadastrar a primeira.

Não são necessários novos segredos ou senhas do ERP. A autenticação continua no Sign in with ChatGPT. O helper real e o manifesto configurados no Sites devem ser preservados ao atualizar esta branch. O adapter genérico do repositório continua bloqueado até ser ligado ao starter; esta entrega não verifica o login real do site da equipe.

## Banco, API e integridade

`0002_security.sql` acrescenta `security_users`, `security_admins`, `role_permissions`, `security_meta`, `security_audit`, `security_operations` e um marcador para inicializar os poderes uma única vez. `0004_user_powers.sql` cria `user_permissions` por pessoa/obra/ação com efeito allow/deny. Os vínculos `memberships` existentes são preservados. Admin é representado por `security_admins`; não se grava um vínculo Admin por obra, nem uma lista editável de poderes dele. Reaplicar a migração não restaura poderes removidos; usar o controle de migrações do starter para executá-la uma vez por ambiente.

- `/api/identity`: reconhece/cadastra a identidade vinda exclusivamente do helper autenticado. Login posterior não remove suspensão nem atribui cargo.
- `/api/session` e `/api/state`: retornam os cargos/poderes atuais e indicam se a pessoa é administradora. O frontend usa essas informações para os controles. O servidor consulta o banco novamente a cada requisição.
- `GET /api/security`: configuração e histórico, somente administrador.
- `POST /api/security`: comandos `user`, `role` e `work`, com motivo, revisão esperada e `Idempotency-Key`. A identidade do autor vem da sessão, nunca do corpo. Origem externa é recusada.
- Mudança de segurança, histórico e idempotência usam um batch transacional com comparação da revisão global de segurança. Conflito retorna 409 e exige Atualizar; não sobrescreve decisões de outro administrador.
- Comandos operacionais comparam também a revisão de segurança no commit. Se alguém revogar poderes enquanto a ação está em andamento, o comando precisa consultar a autorização atual antes de conseguir gravar. Os testes cobrem essa disputa.
- Remover/suspender o último administrador ativo é bloqueado, inclusive em operações concorrentes. Administradores podem transferir a administração depois de liberar outro responsável.
- Reservar/enviar anexos exige poderes correspondentes; a finalização continua dependendo de comando autorizado e transação operacional. Não há acesso público ao R2.

A concessão/revogação alcança as próximas chamadas ao servidor. A interface atualiza os poderes ao abrir telas, clicar Atualizar e depois das gravações; não há notificação em tempo real para uma tela ociosa. Dados já vistos/baixados não podem ser recolhidos retroativamente.

## Mensagens de acesso e estabilidade

A interface diferencia **Login necessário**, **Acesso ao ERP pendente**, **Acesso suspenso**, **Configuração pendente** e **Servidor indisponível**. Um usuário sem vínculo não recebe uma mensagem de conexão em andamento. Migrações/bindings ausentes orientam concluir a configuração, sem exibir erro SQL.

Chamadas têm tempo limite de 20 segundos. Em falha ou sessão encerrada, a pessoa pode tentar novamente; o app não atribui papéis automaticamente nem repete gravações silenciosamente. A chave idempotente é preservada para a repetição do mesmo comando quando a resposta não chegou. Downloads passam pelo mesmo tratamento de sessão/tempo limite.

Ao salvar previsão, anexos ou recebimento de um pedido, os outros formulários preservam seus campos e arquivos selecionados. Durante a gravação, os formulários ficam temporariamente indisponíveis para edição. A preservação é em memória, dentro do mesmo diálogo; não salva rascunhos no servidor e não garante recuperação após fechar ou recarregar a página.

## Verificação e limites

Os testes locais cobrem liberação real de usuário pendente pelo administrador, permissões por ação/obra, chamada direta indevida, suspensão, transferência administrativa, proteção do último admin, mudanças concorrentes/idempotentes, revogação entre autorização e commit, persistência após reinício, migração pendente e concessão inicial explícita. O roteiro `tests/browser_security.py` usa API e D1 reais no ambiente local, sem simular a liberação de acesso.

A normalização do agregado de 1 MiB, paginação adicional, limpeza de uploads, reservas, divergências estruturadas, alçadas financeiras e importação do orçamento continuam como evoluções próprias. Não foram introduzidas regras de negócio novas para esses módulos nesta entrega. Ver também a atualização em AUDITORIA_FUNCIONAL.md.

## Comunicação e documentos

Aplicar `0003_communication.sql` depois da 0002. Os novos poderes permitem exportar relatórios, enviar relatórios e importar PDFs; continuam vinculados à obra e validados no servidor. E-mail é cadastro administrativo explícito em Usuários; a identidade do login não é interpretada como endereço. Destinatário precisa estar ativo, ter acesso à mesma obra e poder de exportar. A API não aceita endereço arbitrário no envio. Alterar contato exige motivo e gera histórico.

Documentos e relatórios enviados ficam no R2 privado; downloads passam pela sessão/obra autorizada. Leitura de notificações altera somente as da própria pessoa. O código não executa JavaScript embutido no PDF durante extração; texto extraído é escapado e só vira registro por confirmação validada. Credenciais Resend ficam apenas no servidor, fora do código e GitHub.

## API de exceções e testes 0.7

`user` continua aceitando `admin: true` para atribuir Admin global; `memberships` contém somente os cargos operacionais por obra. O campo opcional `overrides` tem objetos `{workId, permission, effect}`, com effect allow/deny. Array vazio remove as exceções; omissão conserva as existentes nas obras mantidas, para compatibilidade. A API recusa obras sem vínculo, ações desconhecidas, duplicatas e exceções para Admin. O snapshot inclui `overrides`; a sessão inclui poderes efetivos, nunca identidade fornecida pelo navegador.

Cinco testes em `tests/integration/user-powers.test.mjs` verificam Admin global/futuro, etapas, bloqueio de autopromoção/redução, exceções por pessoa/obra, prioridade de bloqueio com vários cargos, herança, validação, auditoria, revogação durante commit, reinício/migração, remoção de obra e destinatários de relatório. `tests/browser_user_powers.py` verifica o mesmo uso básico pela interface real local. A migração ausente apresenta Configuração pendente. Nenhuma alteração foi aplicada ao site remoto nesta tarefa.
