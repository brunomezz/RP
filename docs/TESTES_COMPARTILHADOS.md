# Evidências da versão compartilhada

Execução em 2026-10-05, checkout separado, Node 24, Miniflare 4/workerd com D1 SQLite e R2 locais. Identidades fictícias emitidas pelo serviço de testes, com cookies opacos distintos; não representam login do ChatGPT. Não houve publicação ou acesso ao site da equipe.

## Resultados

- `npm test`: **14/14** testes de domínio e filtros passaram.
- `npm run test:integration`: **29/29** testes passaram, incluindo o bloqueio do adapter de produção ainda não configurado.
- Segurança: dez testes de integração adicionais verificam administração sem obra, bloqueios diretos, liberação/suspensão, poderes configuráveis, último admin sob concorrência, histórico/idempotência, revogação entre autorização e commit, cadastro de obra sem sobrescrever dados e com limite de tamanho, anexos, reinício/migração sem restaurar poderes, configuração pendente e bootstrap explícito.
- `python tests/browser_security.py`: passou com administração real no D1 local; liberação de pessoa pendente sem recarregar, mudança de poder refletida na interface e API, suspensão/reativação, bloqueio da remoção do último admin, obra e histórico.
- `npm run build:sites`: bundle Fetch/Workers gerado; não executa Node no Sites e não inclui o serviço de autenticação de teste.
- `python tests/browser_shared.py`: passou em Chromium com **cinco contextos/sessões isolados**; criação, aprovação técnica, cotação com anexo, sugestão, decisão do diretor, recebimento parcial com anexo e download por outra pessoa pela interface.
- `python tests/browser_access.py`: passou; login ausente, identidade reconhecida sem função (403 real), nova consulta de acesso, sessão encerrada, acesso revogado, rede indisponível, 503, resposta HTML inválida, configuração pendente e tempo limite da chamada. Concessão/revogação para testar recuperação da interface, falhas de rede e resposta inválida foram simuladas nas rotas do navegador; isso não constitui provisionamento de usuários.
- `python tests/browser_audit.py`: passou com quatro sessões; 14 telas, cadastro de material/fornecedor, edição de contato, solicitação mista, devolução técnica, revisão, três propostas, anexos de proposta/pedido/recebimento, devolução do diretor, escolha diferente da sugestão, pedido e contrato, atualização de chegada, recebimentos/medições/saídas fracionários, filtros, CSV e histórico. Verificou também fechamento de formulário para consulta e exibição literal de unidade com markup cadastrada pela API real. Verificou preservação de arquivo selecionado ao salvar previsão e de previsão não salva ao anexar arquivo. Catálogo vazio foi simulado apenas para a regressão da interface.
- `python tests/browser_communication.py`: passou com extração real de PDF textual, revisão explícita de solicitação/proposta, deduplicação, download original, 11 etapas de relatório e exportação, notificações isoladas e envio **simulado**. O mock não envia e-mail externo nem comprova entrega.
- Dez testes de integração de comunicação verificaram PDF real, filtros/revisão, acesso por obra, notificações persistentes/isoladas, extração real e limites (incluindo PDF digitalizado), origem/confirmação única, recuperação idempotente de resposta incerta e envio interrompido, janela segura, revogação de poderes e migração ausente.
- Os cinco roteiros de navegador terminaram sem exceções JavaScript não tratadas; não são um teste de carga nem uma auditoria de segurança completa. Detalhes e sugestões: [AUDITORIA_FUNCIONAL.md](AUDITORIA_FUNCIONAL.md).
- O HTML offline de exemplos foi gerado na rodada anterior da 0.4; `prototype/` não foi alterado nesta entrega.

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

O usuário relatou uma homologação conectada pelo Sites. Sua URL não foi disponibilizada nesta auditoria, e a adaptação de autenticação não está neste checkout. Não foi verificado diretamente: login real Sign in with ChatGPT, seu logout/renovação/redirecionamentos, manifesto oficial, provisionamento D1/R2 no Sites, acesso de computadores reais pela URL de homologação e persistência após **publicação real**. O teste de reinício local comprova a implementação da persistência no runtime de desenvolvimento, não esses resultados em produção. Repetir o roteiro de [IMPLANTACAO_SITES.md](IMPLANTACAO_SITES.md) quando a integração oficial estiver disponível.

A extração dos PDFs de teste passou, embora PDF.js tenha emitido aviso de ausência de `standardFontDataUrl`. Arquivos com fontes/layouts diferentes precisam ser conferidos na homologação; não foi validado um conjunto de PDFs reais da empresa. O bundle medido nesta versão tem aproximadamente 3,3 MB sem compressão e 0,81 MB em gzip; limites efetivos e processamento precisam ser conferidos no Sites.
