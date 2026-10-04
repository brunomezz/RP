# Contexto do ERP Fasolo e Simon

Este documento permite retomar o projeto em outra conversa com acesso ao repositório. A conversa original e as notas privadas do Obsidian não são sincronizadas pelo GitHub.

## Objetivo

ERP próprio para substituir o Sienge progressivamente, começando por engenharia e suprimentos. Uso no computador. O protótipo utiliza somente exemplos fictícios, sem login nem banco compartilhado.

## Fluxo aprovado

Almoxarifado solicita → engenharia aprova a necessidade e o vínculo ao orçamento → suprimentos cota e sugere fornecedores → diretor de engenharia decide e aprova a contratação → pedido ou contrato → entrega ou medição.

## Regras definidas

- Cadastro de materiais e fornecedores compartilhado entre obras; estoque e custos separados por obra.
- Vários itens por solicitação. Cada item tem material ou serviço, quantidade, unidade, data necessária e local. A solicitação identifica obra, solicitante e finalidade.
- Estoque disponível mostrado para evitar compras desnecessárias.
- Engenharia confirma o serviço do orçamento. Despesa não prevista exige justificativa.
- Três fornecedores ou exceção justificada. Comparar preço, escopo, frete, prazo e pagamento.
- Suprimentos sugere fornecedores por item; o diretor decide, podendo alterar a sugestão. Pedidos e contratos seguem a decisão do diretor.
- Materiais geram pedidos; serviços geram contratos; contratações mistas separam componentes.
- Pedidos mostram previsão de chegada por item, ajustável. Recebimentos parciais atualizam estoque e saldo pendente.
- Anexos nas propostas, pedidos e recebimentos; conteúdo armazenado neste navegador, com download, até 10 MB por arquivo.
- Saída de estoque registra retirante e serviço de destino.
- Devolução exige motivo e mantém histórico. Revisão de solicitação antes da emissão exige nova aprovação.

## Estado atual

Protótipo 0.2 com nove telas, testes de domínio e geração de HTML autocontido. README.md descreve comandos, roteiro e limitações. Retenções, documentos jurídicos, permissões reais, migração e integração fiscal não foram implementados.

## Próximos passos

Continuar validação das telas com o usuário. Depois implementar persistência compartilhada, autenticação, permissões e gestão completa dos cadastros. Definir critérios financeiros antes de tratar os indicadores como oficiais. Não confundir medição, estoque, compromisso e pagamento.

## Publicação

Publicar o código no GitHub permite a outra ferramenta consultar o aplicativo. Isso não equivale a hospedar o site ou disponibilizar o ERP para operação real.
