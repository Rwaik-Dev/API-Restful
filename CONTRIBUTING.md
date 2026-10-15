# Guia de contribuição

## Preparando o ambiente

```bash
corepack enable
pnpm install
cp .env.example .env
```

Veja o [README](README.md) para subir o MongoDB e rodar a API.

## Fluxo de trabalho

1. Crie uma branch a partir de `main` (`feat/...`, `fix/...`, `docs/...`).
2. Escreva primeiro o teste que demonstra o comportamento ou o bug.
3. Implemente a menor mudança que faz o teste passar.
4. Antes de abrir o PR, rode a mesma sequência do CI:

```bash
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
pnpm openapi:lint
pnpm build
```

5. Abra o PR descrevendo o quê e o porquê. Mudanças de contrato devem atualizar `src/docs/openapi.yaml`; os testes de contrato falham se a resposta real divergir do documento.

## Convenções

- Commits no estilo [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `chore:`).
- Cada módulo de domínio fica em `src/modules/<domínio>` com `routes`, `validation`, `controller`, `service` e `repository`.
- Toda entrada HTTP passa por um schema Zod; use `z.strictObject` para rejeitar campos desconhecidos.
- Consultas a recursos do usuário sempre filtram pelo `userId` da identidade autenticada.
- Nunca registre senhas, tokens ou cookies em logs.
- Não adicione abstrações sem um uso concreto.

## Testes

- Testes de integração usam `useTestDatabase()` (`tests/helpers/database.ts`), que cria um banco isolado por arquivo.
- Factories ficam em `tests/factories/`.
- Novos endpoints precisam de testes de autorização (acesso sem token e acesso a recursos de outro usuário) e de contrato.
