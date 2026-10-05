# Plano de ajuste do RP a partir do Sienge (Suprimentos)

Data: 05/10/2026 · Base: RP branch `codex/shared-erp` (0.8.1, commit d5b16b7) × vídeo do Sienge da Fasolo (v9.0.5-10, gravado em 04/10/2026).
Mapa completo dos menus do Sienge: [sienge-menu-suprimentos.md](SIENGE_MENU_SUPRIMENTOS.md).

## Limite desta análise

O vídeo mostra o **menu** inteiro, mas só duas telas abriram com conteúdo: *Consulta de Estoque de Insumos* e *Distâncias de Transporte*, ambas vazias. Todas as outras deram "Sem autorização" para o seu usuário. Portanto:
- **Funções** (nome e organização) estão confirmadas pelo menu.
- **Campos, regras e quadros** do Sienge só foram vistos na Consulta de Estoque. Para o resto, este plano não descreve campos do Sienge; marca o item como "precisa de captura".

## 1. Layout e navegação

| Ponto | Sienge | RP 0.8.1 | Ajuste proposto |
|---|---|---|---|
| Estrutura do menu | Suprimentos › Compras / Contratos e Medições / Estoque / Integração / Apoio; cada item abre submenu (Cadastros, Autorizações, Históricos, Relatórios…) | Grupos Compras / Contratos e Medições / Estoque / Cadastros / Relatórios / Administração, um nível só (`app.js`, `nav`) | Manter os grupos (já batem com o Sienge). Renomear "Cadastros" para **Apoio** e mover "Relatórios por etapa" para dentro de cada grupo, como o Sienge faz. |
| Telas de consulta | Padrão fixo: título, "Parâmetros da consulta" (filtros com lupa de busca e campo obrigatório com *), botões Consultar/Limpar, "Resultado da consulta" em grade, rodapé "Quantidade de registros" | Busca livre + filtros de etapa/data, lista em cartões/tabela, contador "N registros" | Já equivalente. Acrescentar **campos de código + descrição com lupa** (pesquisa em cadastro) nos filtros de obra, insumo e fornecedor. |
| Favoritos e busca de função | Estrela por item de menu e campo "Pesquise uma funcionalidade" | Não existe | P3: favoritos e busca no menu. |
| Permissão por tela | Cada página tem código (ex.: 9230 Painel de Compras) e botão "Solicitar permissão" | Poderes por ação, por cargo, com exceções por usuário (aba Segurança) | O RP já é mais simples e suficiente. Opcional: botão "Solicitar acesso" que notifica o Admin quando faltar poder. |

## 2. Funções: o que o RP já tem

| Sienge | RP 0.8.1 |
|---|---|
| Solicitações de Compra › Cadastros, Autorizações | Solicitações + validação da engenharia |
| Cotações de Preços › Cadastros, Negociações | Cotações (mín. 3 fornecedores ou exceção) |
| Cotações/Pedidos › Autorizações | Aprovações (decisão do diretor) |
| Pedidos de Compra › Cadastros | Pedidos (emitidos pelo diretor) |
| Contratos › Cadastros, Medições | Contratos e Medições (dentro do saldo) |
| Estoque › Movimentos, Consulta | Consulta de estoque e Movimentações (entrada por recebimento, saída com retirante) |
| Apoio › Insumos Gerais, Fornecedores | Materiais e Fornecedores |
| Orçamento / apropriação | Orçamento por serviço (vínculo do item ao serviço) |
| Relatórios | 11 relatórios por etapa, PDF/CSV/e-mail |

Recebimento no RP exige NF, mas é registrado dentro do pedido; não existe cadastro próprio de nota fiscal.

## 3. Lacunas, em ordem de prioridade

### P1 · Necessárias para operar no lugar do Sienge

1. **Nota Fiscal de Compra como documento próprio.** Hoje a NF é só um texto no recebimento (`domain.mjs`, `receive`). Criar cadastro de NF (fornecedor, número, série, emissão, valor, itens vinculados aos pedidos), com **Devoluções** e **Conhecimento de Frete**. Relatório "Distorções entre Pedidos e Notas". *Precisa de captura* das telas Notas Fiscais › Cadastros e Conhecimentos de Fretes.
2. **Saldo de solicitação e pedido: reprogramação e cancelamento.** O Sienge tem "Reprogramações" e "Cancelamentos de Saldos" em solicitação, cotação e pedido. No RP não há como encerrar um saldo que não será entregue nem mudar data após emissão. *Precisa de captura.*
3. **Cadastro de insumos mais completo.** RP: material = nome + unidade. Sienge separa **Insumos Gerais** e **Insumos das Obras** (com Apropriações Padrões), e a consulta de estoque usa **Detalhe** e **Marca**. Acrescentar código, categoria (Sienge tem "Cadastro de Categorias"), detalhe/marca e apropriação padrão ao serviço do orçamento.
4. **Consulta de Estoque no padrão do Sienge** (única tela vista com campos): filtros Centro de custo*, Obra, Insumo*, Detalhe, Marca e **data de posição**; botões Quantidades / Outros Estoques / Reservas; grade Data, Movimento, Fornecedor, Tipo de movimento, Quantidade, Unidade de movimento; campos Unidade e "Data da última entrada". O RP mostra só saldo físico por material e obra. Ajustar a tela para este formato (o relatório de estoque do RP já calcula posição em data).
5. **Fornecedor com dados fiscais.** O cadastro do RP guardava nome, CNPJ em texto livre (sem validação), contato, telefone e e-mail; faltavam razão social, endereço e condição de pagamento. Necessário para NF e pedidos. *Precisa de captura* de Apoio › Fornecedores.

### P2 · Estoque e contratos completos

6. **Reservas de Estoque** (o próprio RP diz "sem reservas").
7. **Transferências entre obras** e **devolução ao estoque** (pendências já listadas no `docs/CONTEXTO.md`).
8. **Movimentos › Inicializações** (saldo inicial ao implantar) e **Fechamento de Exercício**.
9. **Locais** de estoque (almoxarifado/depósito por obra).
10. **Contratos:** tipos de contrato, situações, aditivos, histórico do contrato; **Medições:** boletim, cauções (retenções) e permutas. O RP diz que "boletins, retenções e assinaturas ainda não definidos". *Precisa de captura* de Contratos › Cadastros e Relatórios › Medições.
11. **Solicitações de Serviço** separadas de solicitação de compra (no RP é a mesma solicitação mista). Decidir se mantém o modelo misto.

### P3 · Conveniência e análise

12. **Histórico de cotações e Fornecedores por Insumo** (último preço pago por insumo, base para a próxima cotação).
13. Relatórios que faltam: Mapa de Cotações, Saldos de Pedidos, Acompanhamento de Pedidos/Faturamento, Extratos e Balanço de Estoque, Médias de Compras.
14. **Configurações de Autorização** por valor (alçadas). O RP tem só "diretor decide". Precisa de regra da empresa.
15. Distribuição Automática e Promoções: não sei o que fazem no Sienge da Fasolo. *Precisa de captura ou explicação.*
16. Distâncias de Transporte (por obra): só a tela vazia foi vista. Confirmar se é usada.

## 4. Ordem de execução (decidida em 05/10/2026)

Bruno decidiu focar primeiro em **Suprimentos e Estoque** até a versão de implantação da empresa. Contratos, medições e o resto (itens 10, 11, 14 do P2/P3) ficam para versões seguintes.

| Versão | Escopo | Situação |
|---|---|---|
| 0.9 | Menu Apoio, insumos (P1.3), fornecedor fiscal (P1.5), consulta de estoque com extrato (P1.4) | Em revisão: PR #1 no GitHub |
| 0.10 | Normalizar estoque e cadastros em tabelas D1; reservas, transferências, devolução, inicialização, locais e fechamento (P2.6 a P2.9); importador CSV de insumos e fornecedores | Em revisão: PR #2 (empilhado sobre o #1) |
| 0.11 | Nota Fiscal de Compra com devolução e frete (P1.1) e reprogramação/cancelamento de saldos (P1.2) | A fazer; depende das capturas |
| Implantação | Revisão geral de Suprimentos e Estoque, importação dos cadastros reais e roteiro de implantação | A fazer |

Observação técnica: o limite de 1 MiB do JSON único foi resolvido na 0.10 (`migrations/0006_stock_tables.sql`): insumos, fornecedores, movimentos, reservas, locais e fechamentos ficam em tabelas próprias no D1. A NF da 0.11 deve seguir o mesmo modelo.

Cadastros reais do Sienge: aguardando a exportação de Insumos Gerais e Fornecedores (CSV/Excel) para aplicar com o importador da 0.10.

## 5. Capturas que preciso para detalhar campos

Com um usuário que tenha permissão, de preferência com um registro aberto:
1. Notas Fiscais de Compra › Cadastros (e Conhecimentos de Fretes)
2. Pedidos de Compra › Cadastros (um pedido aberto)
3. Solicitações de Compra › Cadastros e Reprogramações
4. Cotações de Preços › Cadastros e Negociações (mapa de cotação)
5. Apoio › Insumos Gerais e Insumos das Obras › Cadastros
6. Apoio › Fornecedores › cadastro
7. Contratos › Cadastros e Medições
8. Consulta de Estoque com um insumo consultado
