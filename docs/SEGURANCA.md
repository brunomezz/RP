# Segurança e administração · versão 0.5

## Como usar

O administrador abre **Administração → Segurança**. A aba tem três áreas:

1. **Usuários e obras:** localizar a pessoa pelo nome/identificador, escolher seus cargos em cada obra, suspender/reativar o acesso e definir outros administradores. A pessoa deve entrar uma vez para aparecer na lista. Ela pode estar com acesso pendente; não precisa já ter acesso a uma obra.
2. **Poderes dos cargos:** escolher almoxarifado, engenharia, suprimentos ou diretor e marcar as ações permitidas. As alterações valem para todos com aquele cargo. Uma pessoa com vários cargos acumula seus poderes somente nas obras correspondentes.
3. **Cadastrar obra:** informar código e nome. A obra começa com o serviço “Despesa não prevista”, que exige justificativa na aprovação técnica. O orçamento real continua sendo configurado pelo procedimento administrativo descrito em IMPLANTACAO_SITES.md.

Toda alteração exige motivo. O histórico mostra autor da sessão, data/hora, alvo, motivo e valores anteriores/posteriores. A tela exibe as 100 alterações de segurança mais recentes; o banco mantém as anteriores. A administração é global da empresa. Ser administrador não concede poderes operacionais nem acesso automático aos registros de todas as obras; vincule também o cargo e a obra quando necessário.

Os cargos iniciais conservam o fluxo existente. O administrador pode delegar/remover ações individualmente: criar/revisar solicitação, validar orçamento, devolver na engenharia, cotar, sugerir, enviar ao diretor, decidir/aprovar, devolver a suprimentos, atualizar chegada, receber, movimentar estoque, medir, cadastrar material/fornecedor e adicionar anexos. A leitura dos registros, histórico e anexos finalizados da obra depende de vínculo ativo; não há restrição de leitura por módulo nesta versão. Materiais e fornecedores continuam compartilhados na empresa entre usuários com acesso operacional.

Alterar poderes não elimina as regras de etapa, orçamento, justificativa, decisão explícita, quantidade, revisão do registro ou limite de anexo. Conceder o poder de aprovar contratação a outro cargo é uma delegação explícita do administrador. Não há cargos personalizados além dos quatro existentes nesta entrega.

## Primeiro administrador

A migração não promove o primeiro visitante e não transforma automaticamente um diretor em administrador. O primeiro administrador é escolhido explicitamente pelo responsável pelo ambiente:

1. Aplicar `0001_shared.sql` e depois `0002_security.sql` no D1 de homologação, pelo mecanismo de migrações do starter. Em banco existente, aplicar apenas as migrações ainda pendentes. Não resetar dados.
2. A pessoa escolhida entra com o login oficial. A tela de acesso pendente exibe seu identificador; `/api/identity` retorna somente a identidade da própria sessão. Esse acesso registra nome/identificador para a administração, sem conceder poder algum.
3. O operador do Sites gera SQL com `node scripts/bootstrap-admin.mjs IDENTIFICADOR_DA_SESSAO > /tmp/fes-admin.sql`, revisa e executa no D1 correto, com a aplicação sem escritas durante a configuração inicial. O identificador é o ID estável reconhecido pelo helper oficial, não um e-mail arbitrário.
4. O SQL só concede o primeiro acesso administrativo se a identidade já for conhecida, estiver ativa e ainda não houver administrador. Ele não conecta ao servidor e não escolhe o usuário. Conferir o SELECT final. A concessão inicial fica no histórico como **Configuração inicial via D1**, identificando que ocorreu pelo operador do ambiente, fora de uma sessão administrativa do ERP.
5. A pessoa clica em **Verificar acesso** e abre Segurança. Pode cadastrar a primeira obra e liberar os demais cargos pela interface. Um admin sem obra consegue administrar normalmente.

Não são necessários novos segredos ou senhas do ERP. A autenticação continua no Sign in with ChatGPT. O helper real e o manifesto configurados no Sites devem ser preservados ao atualizar esta branch. O adapter genérico do repositório continua bloqueado até ser ligado ao starter; esta entrega não verifica o login real do site da equipe.

## Banco, API e integridade

`0002_security.sql` acrescenta `security_users`, `security_admins`, `role_permissions`, `security_meta`, `security_audit`, `security_operations` e um marcador para inicializar os poderes uma única vez. Os vínculos `memberships` existentes são preservados. Reaplicar a migração não restaura poderes removidos; usar o controle de migrações do starter para executá-la uma vez por ambiente.

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
