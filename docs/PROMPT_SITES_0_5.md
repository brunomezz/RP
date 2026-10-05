# Texto para enviar ao Sites

Atualize a homologação do ERP Fasolo e Simon a partir de https://github.com/brunomezz/RP, branch `codex/shared-erp`, versão 0.5. Leia primeiro README.md, docs/CONTEXTO.md, docs/SEGURANCA.md e docs/IMPLANTACAO_SITES.md.

Traga a aba Segurança, as permissões configuráveis no servidor e os refinamentos de acesso/formulários. Preserve o helper oficial de login já conectado nesta homologação, o manifesto do starter e os bindings persistentes DB/R2. O adapter genérico do repositório é provisório: não substitua a integração real por ele. Não execute o servidor Node de desenvolvimento no Sites e não use identidades fictícias no login real.

Aplique somente as migrações pendentes no D1 de homologação, incluindo migrations/0002_security.sql, com o mecanismo oficial do starter. Não recrie o banco ou bucket. Configure explicitamente o primeiro administrador conforme docs/SEGURANCA.md, usando o identificador real da pessoa responsável que eu indicar. Se essa identidade ainda não tiver sido informada/verificada, mostre exatamente o que falta. Não promova o primeiro visitante nem deduza o identificador de um nome ou e-mail. Depois da primeira configuração, a liberação de pessoas e cargos deve funcionar pela aba Segurança.

Valide nesta homologação: usuário pendente aparece para o admin; admin libera cargo/obra; Verificar acesso permite entrar na mesma sessão; retirar um poder impede a ação também pela API; suspensão/reativação funciona; último admin não pode ser removido; dados/anexos existentes continuam disponíveis; histórico registra autoria; campos/anexos não salvos nos outros formulários do pedido sobrevivem à gravação da previsão.

Entregue a URL da homologação e os resultados reais das verificações. Não substitua nem publique sobre o site usado pela equipe. Não envie credenciais ao chat nem as inclua no GitHub. Registre no repositório a adaptação real do starter, sem segredos, para que o código corresponda ao aplicativo testado.
