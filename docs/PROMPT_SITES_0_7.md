# Prompt para o Sites · Segurança 0.7

Copie e envie ao Sites:

---

Atualize somente o **RP — Testes** com a versão 0.7 mais recente de https://github.com/brunomezz/RP, branch `codex/shared-erp`. Não substitua o site da equipe e não crie/reset banco ou bucket. Preserve o login oficial do ChatGPT já conectado e os mesmos recursos D1/R2 da homologação. Não use identidades de teste nem o adapter provisório do repositório para substituir a integração real.

Leia README.md, docs/CONTEXTO.md, docs/SEGURANCA.md e docs/IMPLANTACAO_SITES.md. Importe também o backend atualizado, não apenas a interface. Execute npm ci e os checks. Aplique apenas migrações pendentes, em ordem 0001–0004; em homologação 0.6 já atualizada, aplicar **0004_user_powers.sql** sem apagar dados. Não há novo segredo nesta atualização.

Segurança agora tem Usuários, Poderes por cargo, Obras e Histórico. Na ficha da pessoa, escolher cargo e obras. Poderes individuais são Seguir cargo, Permitir ou Bloquear por pessoa/obra, com resultado efetivo. Bloqueio individual prevalece mesmo com vários cargos. Sem vínculo à obra, exceções não liberam acesso. Mudanças precisam de motivo, identidade autenticada, revisão e histórico.

**Admin tem acesso total a todas as obras atuais e futuras, todos os poderes e Segurança.** Administradores já explicitamente cadastrados passam a representar Admin nesta versão; preserve suas identidades reais. Não promova visitantes, pessoas por nome/e-mail nem o primeiro a entrar. Admin não pode ser reduzido por exceção ou edição do cargo; para limitar a pessoa, escolher outro cargo. Manter proteção do último Admin ativo e suspensão de conta. Acesso total não ignora etapas, aprovações, orçamento, saldos ou integridade.

Teste pela interface e API com duas contas reais: atribuição de cargo, obras autorizadas, permitir/bloquear individual sem alterar colegas, voltar a seguir cargo, prioridade de bloqueio com vários cargos, atualização imediata, Admin em todas as obras e obra nova, bloqueio de autopromoção e remoção do último Admin, histórico e persistência. Relatórios/destinatários/notificações devem considerar os poderes efetivos e Admin. Verifique também os fluxos antigos de solicitação, aprovação, recebimento e PDFs. Não afirme teste real com fixtures locais.

Informe a URL da homologação, o que foi testado e o que falta. Não publique sobre produção.
