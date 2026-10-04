# FeS — Protótipo de ERP

Protótipo navegável para computador do ERP da Fasolo e Simon, com dados fictícios. Não utiliza dados reais do Sienge nem acessa o OneDrive.

## Código e contexto

Repositório: https://github.com/brunomezz/RP. As decisões e o estado do projeto estão em [docs/CONTEXTO.md](docs/CONTEXTO.md). A publicação do código no GitHub não cria hospedagem do site.

Para rodar após clonar o repositório, entre na pasta `RP` e execute `npm start`. O aplicativo não exige dependências externas.

## Abrir sem instalação

Execute `npm run demo` para gerar `dist/ERP_FeS_Demonstracao.html`. O arquivo é autocontido: pode ser aberto no Chrome ou Edge com um duplo clique, sem servidor, internet ou dependências adicionais. Os dados ficam neste navegador e não são compartilhados com a equipe.

## Executar

Requer Node.js 20 ou superior. Sem dependências externas.

```sh
cd /workspace/RP
npm start
```

O servidor usa a porta 3000; `PORT=3001 npm start` permite outra porta. Abra o protótipo pelo navegador disponibilizado no seu ambiente de desenvolvimento. A execução local também pode ser feita em um computador com Node.js.

```sh
npm test
```

## Fluxo para experimentar

1. Em Solicitações, abra SOL-001 e aprove a necessidade na engenharia.
2. Em Cotações, adicione três fornecedores com preços e condições. Se houver menos, informe uma exceção. Sugira fornecedores por item e envie ao diretor. Anexe documentos às propostas quando necessário.
3. Em Aprovações, o diretor escolhe o fornecedor de cada item, confirma a previsão de chegada e aprova a contratação; pedidos são emitidos por fornecedor.
4. Em Pedidos, acompanhe e ajuste a chegada estimada por item. Adicione anexos ao pedido ou ao recebimento e registre entregas parciais com uma nota fiscal fictícia.
5. Em Estoque, confira o saldo e registre saída vinculada a um serviço.
6. SOL-004 permite experimentar contrato de serviço e medição.

Cada item solicitado possui data necessária e local próprios. Solicitações anteriores são adaptadas usando a data e o local anteriormente registrados, sem apagar os dados.

As mudanças são guardadas no localStorage do navegador. Os arquivos anexos ficam no IndexedDB, no mesmo navegador, com limite de 10 MB por arquivo e opção de download. Não são enviados para servidores nem incluídos automaticamente no HTML distribuído. Limpar os dados do navegador remove também os anexos. “Restaurar exemplos” limpa as mudanças demonstrativas. Não há login, banco compartilhado, controle real de permissões nem sincronização entre computadores. Todas as equipes podem ser simuladas na mesma interface.

## Limites desta versão

- É possível escolher um fornecedor por item e emitir documentos separados. O frete é aplicado uma vez por fornecedor; negociar e registrar os valores para o escopo selecionado.
- Catálogo demonstrativo fixo; fotos na solicitação, cadastro completo de fornecedores e importação do Sienge ainda não implementados.
- Orçamento usa valores fictícios; comprometido por serviço exclui frete e não representa apropriação contábil oficial.
- Pedidos e contratos são registros internos de demonstração; não emitem documentos fiscais ou jurídicos.
- Medições são demonstrativas, sem retenções, assinaturas, emissão de boletins ou fluxo próprio de aprovação.
- Recebimento atualiza saldo físico; reservas, bloqueio por inspeção, devoluções e transferências ainda não implementados.
- Contratações mistas separam material e serviço. Nesta demonstração, frete fica no pedido de materiais do fornecedor; se houver apenas serviço, fica no contrato. Não há rateio do frete por serviço orçamentário.
- Revisão de solicitação antes da emissão reinicia a aprovação e arquiva as propostas anteriores; revisão após emissão ainda não disponível.

Não usar para operação real. A próxima etapa é validar as telas com a equipe e então implementar persistência compartilhada, autenticação e permissões.
