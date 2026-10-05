# Prompt para o Sites · Cadastro único de obras 0.8

Copie e envie ao Sites:

---

Atualize somente o **RP — Testes** com a versão 0.8 mais recente de https://github.com/brunomezz/RP, branch `codex/shared-erp`. Não substitua o site da equipe. Preserve o login oficial já conectado e os MESMOS recursos D1/R2 da homologação, seus dados, anexos e administradores. Não crie/reset banco ou bucket, não substitua autenticação por fixtures locais ou pelo adapter provisório do repositório.

Leia README.md, docs/CONTEXTO.md, docs/SEGURANCA.md e docs/IMPLANTACAO_SITES.md. Atualize backend e interface juntos. Execute npm ci e npm run check. Aplique somente migrações pendentes 0001–0005 em ordem; se já estiver na 0.7, apenas **0005_company_works.sql**. Não há novo segredo.

**Uma obra é cadastrada uma única vez e pertence à empresa.** Basta informar o nome; código opcional, automático. Nomes/códigos repetidos são recusados. Todos os usuários ativos com cargo recebem acesso às obras atuais e futuras, sem seleção de obras por pessoa. O cargo é global e pode ser atribuído antes da primeira obra; Mais de um cargo permite acumular funções. A migração conserva a união dos cargos antigos ativos e amplia seu acesso para todas as obras, preservando dados, exceções e Admins. Não atribua cargo a visitantes nem promova ninguém automaticamente.

Poderes por cargo e exceções por usuário/obra permanecem. Admin continua total; sem cargo ou suspenso não acessa o ERP. Estoque/orçamento e vínculos dos registros continuam separados por obra. Etapas, aprovações, anexos privados, histórico autenticado, idempotência, concorrência e proteção do último Admin permanecem.

Teste com duas contas reais: cadastrar obra com nome, aparecer nos dois seletores sem associar pessoas; criar solicitação e visualizar na outra conta; nova obra; cargo antes da primeira obra; troca/remoção de cargo e suspensão; duplicidade de obra; poderes individuais e aprovação indevida via API; histórico e persistência após republicação. Revalidar os fluxos de compras, recebimento, PDFs e notificações. Não declarar login/implantação validados apenas com testes locais. Não enviar e-mails reais sem destinatário de teste autorizado.

Informe a URL de homologação, resultados reais e pendências. Não publique sobre produção.
