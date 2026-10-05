# Prompt para atualização no Sites · homologação 0.6

Copie o texto abaixo para o Sites:

---

Atualize uma versão SEPARADA de homologação do ERP Fasolo e Simon a partir de https://github.com/brunomezz/RP, branch `codex/shared-erp`, versão 0.6. Não substitua nem publique sobre o site usado pela equipe. Não reutilize recursos de produção.

Leia README.md, docs/CONTEXTO.md, docs/IMPLANTACAO_SITES.md, docs/RELATORIOS_DOCUMENTOS.md e as instruções do projeto. Preserve telas, identidade visual e regras de suprimentos. Preserve o helper oficial de autenticação ChatGPT e os bindings D1/R2 que já funcionam na homologação; não sobrescreva essa integração pelo adapter provisório `hosting/sites-auth.mjs`. Se criar outra homologação, use o starter oficial para integrar autenticação server-side, DB, BUCKET e assets; nunca identidades fictícias.

Importe a versão mais recente da branch e aplique apenas as migrações pendentes, em ordem: 0001_shared.sql, 0002_security.sql e 0003_communication.sql. Preserve dados/recursos; não resete o banco. Backend Fetch/Workers, não iniciar npm start ou servidor Node em produção. Execute npm ci e npm run check; integre o bundle/rotas ao starter real e valide seus limites.

Verifique relatórios das 11 etapas, exportação PDF, notificações individuais e importação de PDFs com extração e revisão nos formulários antes do cadastro. Importar não cria compras automaticamente. PDFs digitalizados não têm OCR configurado: guardar original e orientar preenchimento manual. Deduplicação por obra/conteúdo e confirmação única devem funcionar pela API.

Na aba Segurança, o administrador cadastra e-mails e concede poderes de relatórios/envio/importação, além de obra/cargo. Autenticação não concede poderes automaticamente. Se o envio real ainda não estiver configurado, concluir PDF/notificações/documentos e informar essa pendência. Configurar Resend somente com RESEND_API_KEY como segredo server-side e REPORT_EMAIL_FROM como variável server-side, usando domínio verificado. Nunca solicitar/mostrar segredos no chat ou incluí-los no código, navegador, manifesto ou GitHub. Nunca ativar FES_TEST_MAIL no Sites.

Teste com duas contas reais e sessões distintas: compartilhamento e persistência após logout/republicação com os mesmos recursos, API sem permissão bloqueada, notificações/lidas isoladas, relatórios/PDF por obra, importação textual com revisão e confirmação concorrente única, download autorizado por outra conta, e-mail a colaborador autorizado. Envio real só para destinatário de teste consentido; conferir aceite e caixa de entrada separadamente. Não afirmar entrega real com serviço simulado.

Entregue URL somente da homologação, resultado dos testes executados e configuração que faltar. Não publique sobre produção.
