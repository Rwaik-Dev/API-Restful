# Política de segurança

## Reportando uma vulnerabilidade

Não abra issues públicas para vulnerabilidades. Entre em contato com o mantenedor de forma privada (pelo recurso de _security advisories_ do repositório, se disponível) e inclua:

- descrição do problema e impacto esperado;
- passos para reproduzir ou prova de conceito;
- versão ou commit afetado.

Você receberá uma confirmação de recebimento e, após a correção, o crédito pela descoberta, se desejar.

## Controles implementados

- Senhas com Argon2id (parâmetros mínimos recomendados pela OWASP).
- Access token JWT HS256 de curta duração; algoritmo, emissor, audiência e expiração validados no servidor.
- Refresh token opaco de alta entropia, armazenado apenas como HMAC, rotacionado a cada uso; reutilização revoga a sessão.
- Estado da sessão verificado a cada requisição autenticada (revogação imediata).
- Isolamento de recursos por usuário, coberto por testes de BOLA.
- Validação estrita de entrada, allowlist de campos editáveis e rejeição de campos protegidos.
- Rate limiting em cadastro, login e refresh, além de um limite global.
- Helmet, CORS restrito às origens configuradas, limite de payload e timeouts.
- Erros de produção sem stack trace ou detalhes internos.
- Logs estruturados com redação de `authorization`, senhas e tokens.
- Container sem root e sem dependências de desenvolvimento; MongoDB sem porta pública no Compose.
- Auditoria de dependências no CI.

## Recomendações de implantação

- Exponha a API somente via HTTPS e use `NODE_ENV=production` (habilita HSTS e `upgrade-insecure-requests`).
- Use segredos longos, aleatórios e distintos para `JWT_ACCESS_SECRET` e `REFRESH_TOKEN_SECRET`, gerenciados por um secret manager.
- Habilite `TRUST_PROXY` apenas atrás de um proxy reverso confiável.
- Defina uma política de retenção para logs e metadados de sessão (`userAgent`, `deviceName`). Sessões expiradas são removidas automaticamente pelo índice TTL.
