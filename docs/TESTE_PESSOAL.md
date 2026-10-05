# Teste pessoal · Windows · 0.10.0

## Abrir sem comandos

1. Abra [Downloads do RP](https://github.com/brunomezz/RP/releases).
2. Baixe **RP-Testes-0.10.0-Windows-x64.zip** (não Source code).
3. Clique com o botão direito no ZIP e escolha **Extrair tudo**.
4. Dentro da pasta extraída, dê dois cliques em **RP-Testes.exe**.
5. O ERP abre no navegador como Admin. Escolha outro cargo na faixa de teste e clique **Usar cargo** para experimentar seu acesso.
6. Mantenha a pequena janela do programa aberta. Para terminar, clique **Encerrar** nela.

Windows 10/11 x64; .NET Framework do Windows e navegador padrão. Não é necessário instalar Node.js: ele está no pacote. Nenhum login real, senha ou segredo. O teste usa identidades fictícias; não substitui a validação do login real no Sites. Somente o download exige internet. E-mails são simulados, claramente identificados e não entregues. PDFs/extração textual e notificações usam o backend local real.

O executável não tem assinatura digital de uma empresa certificadora. Regras do Windows/da empresa podem bloqueá-lo; nesse caso, pedir à TI para conferir o pacote e checksum do GitHub. Não desativar proteções nem exigir privilégio de administrador. Windows ARM e macOS não estão incluídos nesta entrega.

## Atualizar sem perder testes

Encerre a versão antiga; baixe e extraia a nova em outra pasta; abra o novo executável. Todos usam a mesma pasta de dados deste usuário do Windows:

`%LOCALAPPDATA%\FasoloSimon\RP-Testes\data`

Banco D1/SQLite e arquivos R2 locais ficam ali, fora da pasta do programa. Um backup `data-backup-DATA...` é criado antes da inicialização de outra versão, sem apagar cópias anteriores. Migrações pendentes são aplicadas pelo runtime local, como no desenvolvimento; não restauram cargos revogados. **Não abra uma versão antiga na base já atualizada.** Para voltar após um problema, encerrar o programa e restaurar uma cópia completa (D1 e R2) com apoio técnico.

Não apague a pasta de dados para atualizar. Não mover/copiar dados enquanto o programa estiver aberto. Abertura duplicada é recusada. Fechar só a aba do navegador não encerra o banco: use Encerrar. Depois de uma interrupção do Windows, o iniciador detecta um processo encerrado e libera seu bloqueio; um processo ainda ativo não é ignorado.

Contas comuns sem cargo e suspensas continuam bloqueadas. Admin total e poderes continuam validados no servidor de teste, com o mesmo fluxo de compras. Se você mudar os cargos/poderes fictícios, eles persistem após reiniciar, para não desfazer seus testes automaticamente.

## Diagnóstico e privacidade

A janela tem **Ver diagnóstico**. Logs de início ficam em `%LOCALAPPDATA%\FasoloSimon\RP-Testes\logs`. Banco e anexos não são incluídos no ZIP nem enviados ao GitHub/Sites. O programa escuta somente em `127.0.0.1`, sem abrir acesso pela rede da empresa. Não contém serviço de atualização automática; baixar outra versão é uma ação explícita.

Este é um ambiente pessoal de testes. A base não é compartilhada com outros computadores e não será enviada automaticamente ao Sites. O limite operacional de 1 MiB e limite de 10 MiB por anexo continuam. OCR, integração fiscal e envio real de e-mail não são acrescentados aqui. Os exemplos fictícios ficam separados dos dados online da equipe.

## Geração e validação para manutenção

Workflow `.github/workflows/personal-windows.yml`, executado na branch `codex/shared-erp` quando houver mudanças de código ou manualmente. Runner Windows x64, Node oficial 22.21.1, `npm ci`, testes de domínio, build Sites, `npm run package:windows`. O pacote contém somente os arquivos explicitamente selecionados, dependências e runtime/licenças; não copia `.git`, `.env`, credenciais, `.dev-data` ou anexos de teste.

O iniciador é compilado pelo Windows PowerShell/.NET Framework. O CI chama `RP-Testes.exe --check`, que executa `desktop/smoke-local.mjs` pelo Node incluído: inicia o servidor local, verifica entrada como Admin, troca de cargos, consulta por outra sessão, bloqueio de ação indevida, bloqueio de segunda instância, encerramento, reinício, preservação do registro e backup na atualização. O resultado fica temporariamente em `diagnostico-pacote.txt`, removido antes do ZIP. Falha impede release.

Após o sucesso, o workflow publica uma pré-release `rp-testes-vVERSÃO`, ZIP e SHA256SUMS.txt. Usa apenas `github.token` temporário e limitado ao repositório; nenhum segredo do usuário. Atualizar a versão em package.json/package-lock.json antes de uma nova entrega; versões anteriores permanecem como releases separadas. Reexecução da mesma versão pode substituir seu ZIP, portanto use versão nova para mudanças.

Para validar o iniciador no ambiente de desenvolvimento: `npm run test:personal`. Para os fluxos completos: `npm run check` e roteiros Chromium existentes. Esta validação local não publica, nem comprova autenticação/hosting do Sites. A geração do executável requer Windows, conferida pelo workflow; não alegar execução do `.exe` a partir do teste Linux.
