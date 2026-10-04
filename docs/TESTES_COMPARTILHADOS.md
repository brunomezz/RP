# Evidências da versão compartilhada

Execução em 2026-10-04, checkout separado, Node 24, Miniflare 4/workerd com D1 SQLite e R2 locais. Identidades fictícias emitidas pelo serviço de testes, com cookies opacos distintos; não representam login do ChatGPT. Não houve publicação ou acesso ao site da equipe.

## Resultados

- `npm test`: **13/13** testes de domínio e filtros passaram.
- `npm run test:integration`: **9/9** testes passaram, incluindo o bloqueio do adapter de produção ainda não configurado.
- `npm run build:sites`: bundle Fetch/Workers gerado; não executa Node no Sites e não inclui o serviço de autenticação de teste.
- `python tests/browser_shared.py`: passou em Chromium com **cinco contextos/sessões isolados**; criação, aprovação técnica, cotação com anexo, sugestão, decisão do diretor, recebimento parcial com anexo e download por outra pessoa pela interface.
- `npm run demo`: HTML offline de exemplos separado gerado.

| Critério | Evidência executada |
| --- | --- |
| Usuário 1 cria e usuário 2 vê | Sessões distintas nos testes de API e navegador, Atualizar e troca de tela |
| Dados sobrevivem à saída e reinício | Logout invalida sessão de teste; novo login vê os registros; runtime Miniflare encerrado/recriado com mesmo diretório preserva D1 e bytes R2 |
| Sem permissão não aprova pela API | 401 sem sessão; 403 sem função, em outra obra e com função errada; corpo com autor forjado não muda sessão; zero pedidos antes da aprovação autorizada |
| Concorrência/idempotência | Aprovações e recebimentos em paralelo com mesma chave têm um efeito; ações com chaves diferentes/revisão antiga recebem 409; saídas concorrentes não deixam saldo negativo |
| Anexo compartilhado | Proposta e recebimento enviados por uma sessão baixados por outras, bytes iguais; outra obra bloqueada; anexo não finalizado indisponível; arquivo finalizado não pode ser substituído |
| Limite e validação | Reserva acima de 10 MiB recusada; corpo com tamanho diferente recusado; serviço de outra obra, data inválida, quantidade negativa e material inexistente recusados |
| Histórico | IDs de autores e horários do servidor, motivo da devolução, uma auditoria por aprovação; medição atribuída à engenharia sem entrada de estoque |
| Separação do protótipo | localStorage com registro antigo permaneceu intacto, não apareceu no estado compartilhado; banco operacional inicia vazio; apenas fixtures locais cadastram valores de teste |
| Segurança da integração pendente | Adapter de produção retorna 503 mesmo com cabeçalhos/identidade de teste forjados |

## Não executado / pendente

Login real Sign in with ChatGPT, seu logout/renovação/redirecionamentos, manifesto oficial, provisionamento D1/R2 no Sites, acesso de computadores reais pela URL de homologação e persistência após **publicação real**. O teste de reinício local comprova a implementação da persistência no runtime de desenvolvimento, não esses resultados em produção. Repetir o roteiro de [IMPLANTACAO_SITES.md](IMPLANTACAO_SITES.md) quando a integração oficial estiver disponível.
