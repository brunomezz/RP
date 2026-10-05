# Relatórios, notificações e importação de PDFs · 0.6

## Uso

- **Relatórios → Central de relatórios**: selecionar obra, etapa e filtros, gerar a prévia e exportar PDF. Para compartilhar, escolher um colaborador cadastrado e clicar Enviar relatório por e-mail. Não há envio automático.
- **Notificações** no cabeçalho/menu: consultar eventos e marcar uma ou todas como lidas. A leitura de uma pessoa não afeta outra. Abrir etapa leva à tela correspondente; o código do registro consta na mensagem.
- **Cadastros → Importar PDFs**: escolher obra/arquivo, extrair e revisar texto/sugestões. Criar uma solicitação ou cadastrar proposta exige confirmação nos formulários existentes. É possível somente vincular o PDF a uma solicitação, pedido ou contrato existente.
- **Administração → Segurança**: cadastrar o e-mail do colaborador e conceder/retirar os poderes Exportar relatórios, Enviar relatórios e Importar PDFs. Na 0.7, Admin tem acesso total; demais cargos podem receber exceções por usuário/obra.

## Relatórios disponíveis

Solicitações, conferência da engenharia, cotações, decisão do diretor, pedidos, recebimentos, contratos, medições, estoque, movimentações e orçamento. São gerados no servidor com os mesmos dados compartilhados, filtrados pela obra autorizada. O PDF inclui obra, período, responsável da sessão e horário de geração. O PDF usa Helvetica, fonte padrão compatível com caracteres portugueses, e as cores da marca; caracteres fora do conjunto suportado são substituídos por `?`.

O período representa data necessária nas solicitações/cotações, previsão de chegada nos pedidos/contratos e data do evento em recebimentos/medições/movimentações. Estoque usa somente a data final para reconstruir saldos pelas movimentações; orçamento não aceita período, pois mostra a posição atual. Filas da engenharia e do diretor mostram pendências atuais, não as pendências de uma data passada. Não são relatórios contábeis nem comprovantes de pagamento. Frete é por proposta, não deve ser somado por linha. Até 2.000 linhas por relatório; reduzir filtros quando exceder. PDF e e-mail com revisão desatualizada pedem nova prévia.

## E-mail real: configuração externa necessária

A implementação usa Resend por HTTPS. O responsável pelo ambiente deve:

1. Criar/configurar a conta Resend e verificar o domínio remetente, incluindo os registros DNS exigidos pelo serviço.
2. Criar uma chave adequada ao envio e preenchê-la como segredo **`RESEND_API_KEY`** no Sites, exclusivamente no servidor. Não enviar pelo chat nem colocar no manifesto/GitHub.
3. Preencher **`REPORT_EMAIL_FROM`**, por exemplo `Fasolo e Simon <erp@dominio-verificado>`, nas variáveis server-side do Sites. Usar o domínio realmente verificado.
4. Permitir chamadas HTTPS para `api.resend.com`, conforme as configurações da plataforma.
5. Cadastrar o e-mail correto dos colaboradores na aba Segurança, com motivo. Testar um envio consentido na homologação e conferir a caixa de entrada.

Sem configuração, exportação PDF, documentos e notificações funcionam; enviar apresenta uma orientação. Não há credenciais configuradas ou entrega real comprovada nesta tarefa. O teste local usa um transporte fictício claramente identificado e nunca envia externamente.

O destinatário vem do cadastro, deve estar ativo e ter acesso à obra e poder de exportar relatórios. A API rejeita endereço arbitrário. O PDF fica congelado no R2 com um registro de envio no D1. Clique repetido usa a mesma chave; repetição pelo histórico reutiliza o mesmo PDF e chave do provedor. Não gerar outro envio para resolver uma confirmação pendente. Uma reserva de 60 segundos impede transportes simultâneos; se o processo interromper, o histórico permite repetir após expirar. A repetição fica limitada a 23 horas, dentro da janela de idempotência do provedor; depois disso exige conferência administrativa antes de um novo envio. Não há fila automática/agendador de reenvios, webhooks ou confirmação de entrega/leitura. **Aceito pelo serviço** significa apenas aceite pelo provedor.

## Notificações

Ações operacionais notificam os demais usuários ativos da mesma obra: solicitação/revisão, engenharia, cotação/sugestão, devolução/decisão, previsão, recebimento, medição e saída. Múltiplos cargos não duplicam o aviso; a operação repetida também não. Alterações de segurança notificam as pessoas afetadas. Envio aceito cria aviso ao destinatário.

Somente a própria sessão consulta/marca suas notificações; perda de acesso à obra remove esses avisos da consulta. O contador é consultado a cada 45 segundos com o aplicativo visível e sem operação em andamento. A lista é atualizada ao abrir/clicar Atualizar, com paginação de 50. Não há push fora do aplicativo, avisos retroativos ou lembretes automáticos de prazo nesta versão.

## Extração de PDFs e revisão

Arquivo original no R2 privado, metadados, texto e autoria no D1. Até **10 MiB**, **200 páginas**; extração das primeiras **30 páginas** e até **80.000 caracteres**. Extração parcial é identificada. Arquivo vazio/inválido e limites excedidos são recusados. O mesmo conteúdo na mesma obra abre o documento existente, inclusive em uploads simultâneos. Outra obra não acessa seus bytes.

A extração lê texto selecionável e sugere campos simples. Tabelas reconhecidas conservadoramente usam linhas como:

```text
Finalidade: Alvenaria do pavimento 3
Fornecedor: Empresa cadastrada
Bloco ; 120 ; un ; 12,50
```

Separador `|` também é aceito. Formato: descrição, quantidade, unidade e preço opcional. Material só é relacionado quando nome/unidade correspondem ao catálogo; caso contrário, o usuário precisa selecionar. O preço da proposta só é sugerido quando corresponde ao item da solicitação. Datas, local, vínculo ao orçamento, escopo, pagamento, frete e demais condições devem ser conferidos/preenchidos. PDFs com outros layouts podem fornecer somente texto para preenchimento manual. Não há interpretação universal de propostas, extração por IA ou OCR nesta versão. PDFs digitalizados ficam guardados com indicação de falta de texto; o cadastro pode ser preenchido manualmente. OCR demanda uma integração adicional ainda não configurada.

Upload/extrair não cria compra, pedido, estoque ou contratação. Confirmar solicitação/proposta preserva todas as validações normais e registra a origem no histórico do autor autenticado. Consumo e vínculo do documento ocorrem no mesmo commit do cadastro: ações simultâneas não criam dois registros pelo mesmo PDF. Um documento confirmado não pode ser reaproveitado para outro cadastro nem relinkado. Listagem mostra os 200 documentos mais recentes por obra. Não há importação automática de arquivos/dados antigos do navegador.

## Arquitetura, migração e testes

Aplicar `migrations/0003_communication.sql` após 0001/0002, somente se pendente, preservando D1/R2 e permissões. Acrescenta contatos, notificações, documentos, confirmações, envios e auditoria de comunicação; não apaga dados existentes. Novos poderes são inicializados uma única vez para os quatro cargos. A auditoria de comunicação reside no D1; ainda não há tela de consulta geral dessa tabela ou política automática de retenção/limpeza. Históricos operacionais e de segurança continuam nas telas existentes.

`pdf-lib` gera PDFs e `unpdf` extrai texto no backend Fetch/Workers. Dependências fixadas no lockfile; não dependem do servidor Node em produção. O bundle precisa ser validado contra limites de CPU/memória/size no runtime real do Sites. Não houve publicação nesta tarefa. Preserve a autenticação oficial já conectada em sua homologação.

`npm run check`: domínio, integração D1/R2 e bundle. `tests/integration/communication.test.mjs`: 11 etapas, PDFs reais, filtros/revisão, isolamento, notificações/reinício, destinatários, idempotência e recuperação de confirmação, extração real, revisão, deduplicação e limites. `FES_TEST_MAIL=1 npm start` habilita o serviço fictício somente local, para `python tests/browser_communication.py`. Nunca usar esse fixture em produção. Os demais roteiros de navegador também continuam aplicáveis.
