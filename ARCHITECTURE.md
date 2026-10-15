> Documento de arquitetura e especificação de implementação para uma API RESTful de gerenciamento de tarefas com Node.js, TypeScript, Express, MongoDB, JWT com sessões controladas no backend e documentação OpenAPI/Swagger.

- **Status:** especificação inicial
- **Versão do documento:** 1.0
- **Prefixo da API:** `/api/v1`
- **Objetivo:** projeto de portfólio com qualidade de produção, segurança demonstrável, testes e documentação reproduzível.

---

## 1. Objetivos e princípios

### Objetivos funcionais

1. Permitir cadastro e autenticação de usuários.
2. Controlar sessões no backend, incluindo expiração, renovação, revogação e logout em todos os dispositivos.
3. Permitir que cada usuário gerencie suas próprias tarefas.
4. Expor uma API REST consistente e documentada com OpenAPI e Swagger UI.
5. Oferecer filtros, ordenação e paginação.
6. Automatizar lint, verificação de tipos, testes e validação da documentação.

### Princípios arquiteturais

- Monólito modular organizado por domínio.
- TypeScript com modo estrito.
- Validação de entradas na fronteira HTTP.
- Regras de negócio concentradas em services.
- Persistência isolada em repositories quando isso trouxer benefício real.
- Autorização verificada no servidor para cada recurso.
- Respostas e erros consistentes.
- Segurança por padrão e privilégio mínimo.
- Testes automatizados como requisito de aceite.
- Sem microserviços nesta fase: a complexidade não se justifica para o escopo.

## 2. Stack tecnológica

| Área | Tecnologia / abordagem |
|---|---|
| Runtime | Node.js LTS, em versão compatível com as dependências |
| Linguagem | TypeScript, `strict: true` |
| HTTP | Express |
| Banco de dados | MongoDB |
| ODM | Mongoose |
| Validação | Zod |
| Senhas | Argon2id |
| Access token | JWT assinado |
| Sessões / refresh | Coleção própria no MongoDB e refresh token opaco |
| Documentação | OpenAPI 3.1 + Swagger UI |
| Testes | Vitest + Supertest |
| Segurança HTTP | Helmet, CORS explícito, rate limiting |
| Logging | Logger estruturado, por exemplo Pino |
| Containerização | Docker + Docker Compose |
| Gerenciador de pacotes | pnpm |
| Qualidade | ESLint + Prettier |
| CI | GitHub Actions ou Gitea Actions |

Fixar as versões das dependências e commitar `pnpm-lock.yaml`. Confirmar compatibilidade entre versões antes de atualizar o stack.

## 3. Arquitetura em camadas

```text
Cliente
  │ HTTPS / JSON / Authorization: Bearer
  ▼
Express
  ├── Middlewares globais
  │    ├── requestId
  │    ├── segurança HTTP
  │    ├── rate limiting
  │    └── parsing de body
  ├── Rotas versionadas
  ├── Validação (Zod)
  ├── Autenticação e autorização
  ├── Controllers — contrato HTTP
  ├── Services — regras de negócio
  ├── Repositories — acesso a dados
  └── Models Mongoose
         └── MongoDB
```

### Responsabilidades

- **Routes:** mapeiam métodos HTTP, middlewares e controllers.
- **Controllers:** leem os dados validados, chamam services e retornam status/body.
- **Services:** implementam as regras de negócio e orquestram operações.
- **Repositories:** encapsulam consultas e persistência quando a separação é útil.
- **Models:** definem estrutura, validações, índices e regras de persistência.
- **Schemas:** validam body, params, query strings e configuração do ambiente.
- **Middlewares:** tratam autenticação, limites, rastreamento e erros.
- **Config:** centraliza configuração e inicialização de dependências.

Evitar abstrações sem propósito. Não criar interfaces para todas as classes apenas por convenção; criar quando ajudarem a testar, substituir uma dependência ou proteger um limite arquitetural.

## 4. Estrutura de diretórios

```text
task-management-api/
├── src/
│   ├── app.ts
│   ├── server.ts
│   ├── config/
│   │   ├── env.ts
│   │   ├── database.ts
│   │   ├── logger.ts
│   │   └── swagger.ts
│   ├── shared/
│   │   ├── errors/
│   │   │   ├── AppError.ts
│   │   │   └── errorHandler.ts
│   │   ├── middlewares/
│   │   │   ├── authenticate.ts
│   │   │   ├── authorize.ts
│   │   │   ├── validate.ts
│   │   │   ├── requestId.ts
│   │   │   └── rateLimiter.ts
│   │   ├── utils/
│   │   └── types/
│   ├── modules/
│   │   ├── auth/
│   │   │   ├── auth.routes.ts
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.service.ts
│   │   │   ├── auth.validation.ts
│   │   │   └── auth.types.ts
│   │   ├── users/
│   │   │   ├── user.model.ts
│   │   │   ├── user.repository.ts
│   │   │   ├── user.service.ts
│   │   │   ├── user.controller.ts
│   │   │   ├── user.routes.ts
│   │   │   └── user.validation.ts
│   │   ├── sessions/
│   │   │   ├── session.model.ts
│   │   │   ├── session.repository.ts
│   │   │   ├── session.service.ts
│   │   │   └── session.routes.ts
│   │   └── tasks/
│   │       ├── task.model.ts
│   │       ├── task.repository.ts
│   │       ├── task.service.ts
│   │       ├── task.controller.ts
│   │       ├── task.routes.ts
│   │       └── task.validation.ts
│   ├── routes/
│   │   └── index.ts
│   └── docs/
│       ├── openapi.yaml
│       └── components/
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── factories/
│   └── setup.ts
├── .github/
│   └── workflows/
│       └── ci.yml
├── .env.example
├── .gitignore
├── .dockerignore
├── Dockerfile
├── docker-compose.yml
├── eslint.config.js
├── prettier.config.js
├── tsconfig.json
├── vitest.config.ts
├── package.json
├── pnpm-lock.yaml
├── README.md
├── CONTRIBUTING.md
├── SECURITY.md
├── ARCHITECTURE.md
└── LICENSE
```

`app.ts` cria e configura o Express sem abrir uma porta, para permitir testes. `server.ts` conecta o banco, inicia o listener e trata sinais de encerramento.

## 5. Modelagem de dados

### 5.1 `users`

Campos conceituais:

```ts
interface User {
  _id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: "user" | "admin";
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

Regras:

- Normalizar o e-mail antes de persistir e consultar.
- Criar índice único para e-mail normalizado.
- Armazenar apenas o hash Argon2id da senha.
- Nunca retornar `passwordHash` em respostas.
- O cadastro público sempre cria `role: "user"`; o cliente não pode se promover a administrador.
- Contas desativadas não podem iniciar sessões nem utilizar sessões existentes.
- Não usar `select`/serialização que exponha campos sensíveis.

### 5.2 `tasks`

```ts
interface Task {
  _id: string;
  userId: string;
  title: string;
  description?: string;
  status: "pending" | "in_progress" | "completed";
  priority: "low" | "medium" | "high";
  dueDate?: Date;
  tags: string[];
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
```

Regras:

- `userId` é sempre obtido da identidade autenticada, nunca confiado ao payload.
- Título obrigatório, após trim, com limites documentados.
- Limitar tamanho da descrição, número de tags e tamanho de cada tag.
- `completedAt` é preenchido ao concluir a tarefa e limpo quando ela sai do estado concluído.
- Atualizações usam allowlist de campos editáveis.
- Rejeitar campos desconhecidos ou protegidos, conforme política de validação adotada.
- Datas são validadas e armazenadas em UTC.
- Listagens sempre são limitadas e paginadas.

Índices iniciais sugeridos:

```ts
taskSchema.index({ userId: 1, createdAt: -1 });
taskSchema.index({ userId: 1, status: 1, createdAt: -1 });
taskSchema.index({ userId: 1, dueDate: 1 });
```

Confirmar os índices com as consultas reais e o plano de execução. Índices extras têm custo de armazenamento e escrita.

### 5.3 `sessions`

```ts
interface Session {
  _id: string; // sid usado pelo access token
  userId: string;
  refreshTokenHash: string;
  tokenFamilyId: string;
  expiresAt: Date;
  lastUsedAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deviceName?: string;
  userAgent?: string;
}
```

Decisões:

- `refreshTokenHash` contém hash do refresh token opaco, nunca o valor original.
- Access tokens JWT não precisam ser persistidos.
- `sid` identifica a sessão no JWT.
- `tokenFamilyId` permite identificar uma família de refresh tokens e responder à detecção de reutilização.
- Metadados de IP/user-agent devem ser mínimos, protegidos e ter política de retenção.
- Índices para `userId`, expiração e identificadores de sessão.
- TTL pode limpar sessões expiradas, mas **não substitui a verificação explícita de expiração e revogação pela aplicação**.

## 6. Autenticação e controle de sessão

### 6.1 Política inicial

| Item | Decisão inicial |
|---|---|
| Access token | JWT de curta duração, por exemplo 10–15 minutos |
| Refresh token | Valor opaco aleatório com alta entropia |
| Armazenamento de sessão | MongoDB |
| Hash do refresh | SHA-256 do token aleatório ou HMAC com segredo dedicado; nunca texto puro |
| Logout | Revoga sessão no backend |
| Logout global | Revoga todas as sessões do usuário |
| Refresh | Rotaciona o refresh token a cada utilização |
| Reutilização de token anterior | Revoga a família afetada e registra evento de segurança |
| Conta desativada | Bloqueia login e acessos autenticados |
| Transporte | HTTPS obrigatório em produção |

Como o refresh token é aleatório e de alta entropia, um hash criptográfico apropriado é adequado para armazená-lo; não usar esse raciocínio para senhas, que exigem hash lento como Argon2id.

### 6.2 Claims do access token

Claims mínimas:

- `sub`: ID do usuário.
- `sid`: ID da sessão.
- `iss`: emissor esperado.
- `aud`: audiência esperada.
- `iat`: instante de emissão.
- `exp`: expiração.
- `jti`: identificador único do token, se necessário para auditoria.

Validar algoritmo explicitamente, assinatura, emissor, audiência, expiração e formato das claims. Não aceitar o algoritmo indicado pelo token sem política configurada no servidor. Não colocar segredos ou dados pessoais desnecessários no JWT.

### 6.3 Fluxo de login

1. Validar formato de e-mail e senha.
2. Aplicar rate limit ao endpoint.
3. Consultar usuário pelo e-mail normalizado.
4. Verificar senha usando Argon2id.
5. Retornar mensagem genérica em caso de credenciais inválidas.
6. Recusar contas desativadas.
7. Criar registro de sessão no MongoDB.
8. Gerar access token associado ao `sid`.
9. Gerar refresh token aleatório e armazenar somente seu hash.
10. Retornar o access token e entregar o refresh token pelo transporte seguro escolhido.

### 6.4 Middleware de autenticação

Para cada rota protegida:

1. Extrair `Authorization: Bearer <token>`.
2. Verificar assinatura e claims do JWT.
3. Consultar a sessão identificada por `sid`.
4. Rejeitar sessão inexistente, revogada ou expirada.
5. Verificar que o usuário existe e está ativo.
6. Anexar ao contexto da requisição apenas a identidade necessária.
7. Continuar para autorização e controller.

Essa estratégia consulta o estado da sessão a cada requisição protegida. O custo adicional é intencional para permitir revogação imediata. Se for introduzido cache posteriormente, documentar como ele afeta o tempo de revogação.

### 6.5 Refresh token e concorrência

- Rotacionar o refresh token em cada renovação.
- Invalidar o token anterior de forma atômica.
- Detectar reutilização de token anterior.
- Revogar a família de tokens quando houver evidência de reutilização.
- Tratar duas requisições simultâneas de refresh: apenas uma deve vencer a rotação.
- Nunca devolver ou registrar o refresh token anterior.
- Usar transação se a operação envolver múltiplos documentos que exijam atomicidade; verificar a configuração do MongoDB necessária para transações.
- Definir a experiência do cliente para renovação concorrente e erros de reutilização.

### 6.6 Transporte no cliente

- Access token: header `Authorization: Bearer`.
- Cliente navegador: preferir refresh token em cookie `HttpOnly`, `Secure`, `SameSite` adequado e proteção CSRF quando necessária.
- Cliente não navegador: escolher armazenamento seguro compatível com a plataforma.
- Não armazenar refresh tokens em `localStorage`.
- Nunca enviar tokens por query string.

## 7. Endpoints

Todos os endpoints de negócio ficam sob `/api/v1`.

### 7.1 Autenticação

| Método | Caminho | Objetivo | Resultado típico |
|---|---|---|---|
| POST | `/auth/register` | Criar usuário | `201` |
| POST | `/auth/login` | Abrir sessão | `200` |
| POST | `/auth/refresh` | Rotacionar refresh token | `200` |
| POST | `/auth/logout` | Revogar sessão atual | `204` |
| POST | `/auth/logout-all` | Revogar todas as sessões do usuário | `204` |
| GET | `/auth/me` | Retornar perfil do usuário atual | `200` |
| GET | `/sessions` | Listar sessões do usuário | `200` |
| DELETE | `/sessions/:sessionId` | Revogar uma sessão do usuário | `204` |

O logout deve ter comportamento idempotente e ser definido de modo consistente para sessão já revogada ou inexistente. A listagem de sessões deve ocultar tokens e dados sensíveis.

### 7.2 Tarefas

| Método | Caminho | Objetivo | Resultado típico |
|---|---|---|---|
| POST | `/tasks` | Criar tarefa | `201` |
| GET | `/tasks` | Listar tarefas próprias | `200` |
| GET | `/tasks/:taskId` | Buscar tarefa própria | `200` |
| PATCH | `/tasks/:taskId` | Atualizar campos permitidos | `200` |
| DELETE | `/tasks/:taskId` | Excluir tarefa própria | `204` |
| PATCH | `/tasks/:taskId/status` | Alterar status com regras específicas | `200` |

O endpoint de status pode ser omitido se a alteração de status pelo `PATCH /tasks/:taskId` já tiver regras explícitas e testadas. Evitar duplicar operações sem necessidade.

### 7.3 Infraestrutura

| Método | Caminho | Objetivo |
|---|---|---|
| GET | `/health` | Healthcheck de processo |
| GET | `/ready` | Verificar se dependências essenciais estão prontas |
| GET | `/api/docs` | Swagger UI |
| GET | `/api/docs.json` | Especificação OpenAPI em JSON |

Healthchecks não devem expor credenciais, configurações internas ou detalhes sensíveis.

## 8. Contrato REST

### 8.1 Criar tarefa

`POST /api/v1/tasks`

Headers:

```http
Authorization: Bearer <access-token>
Content-Type: application/json
```

Exemplo de body:

```json
{
  "title": "Documentar a API",
  "description": "Finalizar os contratos OpenAPI",
  "priority": "high",
  "status": "pending",
  "dueDate": "2026-10-25T18:00:00.000Z",
  "tags": ["backend", "documentacao"]
}
```

Resposta `201 Created`:

```json
{
  "success": true,
  "data": {
    "id": "671a1234567890abcdef1234",
    "title": "Documentar a API",
    "description": "Finalizar os contratos OpenAPI",
    "priority": "high",
    "status": "pending",
    "dueDate": "2026-10-25T18:00:00.000Z",
    "tags": ["backend", "documentacao"],
    "completedAt": null,
    "createdAt": "2026-10-15T17:00:00.000Z",
    "updatedAt": "2026-10-15T17:00:00.000Z"
  }
}
```

Os valores são exemplos ilustrativos, não resultados de uma execução real. O servidor deve gerar ID e timestamps; o cliente não pode definir `userId`, `completedAt`, `createdAt` ou `updatedAt`.

### 8.2 Listar tarefas

Exemplo:

```http
GET /api/v1/tasks?page=1&limit=20&status=pending&priority=high&sortBy=dueDate&order=asc&search=documentar
```

Parâmetros:

- `page`: inteiro a partir de 1.
- `limit`: inteiro entre 1 e 100.
- `status`: `pending`, `in_progress` ou `completed`.
- `priority`: `low`, `medium` ou `high`.
- `sortBy`: allowlist, por exemplo `createdAt`, `updatedAt`, `dueDate`, `title`, `priority`.
- `order`: `asc` ou `desc`.
- `search`: string limitada e validada.
- `tags`: filtro documentado para uma ou mais tags.
- `dueBefore` / `dueAfter`: datas ISO válidas, se implementadas.

Resposta:

```json
{
  "success": true,
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "totalItems": 0,
    "totalPages": 0
  }
}
```

A consulta deve sempre filtrar pelo usuário autenticado. Aplicar `limit` máximo e não concatenar diretamente valores de entrada em operadores MongoDB. Definir ordenação padrão estável para evitar resultados imprevisíveis.

## 9. Respostas e tratamento de erros

### 9.1 Sucesso

Resposta com conteúdo:

```json
{
  "success": true,
  "data": {}
}
```

Listagens também incluem `meta` para paginação. Respostas `204 No Content` não contêm body.

### 9.2 Erro

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Os dados enviados são inválidos.",
    "details": [
      {
        "field": "title",
        "message": "O título é obrigatório."
      }
    ],
    "requestId": "req_abc123"
  }
}
```

Não incluir stack trace, segredo, query completa, tokens ou detalhes internos em respostas de produção.

### 9.3 Status HTTP

| Status | Uso |
|---|---|
| `200` | Operação concluída com resposta |
| `201` | Recurso criado |
| `204` | Operação concluída sem conteúdo |
| `400` | Requisição malformada ou parâmetro inválido |
| `401` | Credenciais ausentes ou inválidas, token inválido/expirado |
| `403` | Identidade autenticada sem permissão para a ação |
| `404` | Recurso não encontrado ou não acessível ao usuário |
| `409` | Conflito, por exemplo e-mail duplicado |
| `422` | Conteúdo válido sintaticamente, mas incompatível com regra de negócio |
| `429` | Rate limit excedido |
| `500` | Erro inesperado |

Escolher e documentar a distinção entre `400` e `422`. Para recursos privados, pode-se responder `404` quando o recurso existe, mas pertence a outro usuário, reduzindo a exposição de sua existência.

## 10. Validação e regras de negócio

- Validar body, params, query e ambiente com Zod.
- Definir limites de tamanho para JSON e strings.
- Rejeitar tipos e enums inválidos.
- Normalizar e-mail e tags de forma consistente.
- Atualizar somente campos explicitamente permitidos.
- Não permitir atribuição de role por endpoint público.
- Não aceitar `userId` fornecido pelo cliente como fonte de autorização.
- Validar IDs antes de consultar o banco.
- Traduzir erros conhecidos do Mongoose para erros de domínio/HTTP.
- Evitar que validação duplicada tenha regras divergentes entre controller, service e model: cada camada deve ter um propósito claro.

## 11. Swagger / OpenAPI

### Requisitos

- Especificação versionada em `src/docs/openapi.yaml`.
- Swagger UI em `/api/docs`.
- JSON OpenAPI em `/api/docs.json`.
- Schemas reutilizáveis para User, Task, SessionSummary, PaginationMeta e Error.
- Security scheme Bearer JWT.
- Descrição de todos os endpoints, parâmetros, body, respostas e erros.
- Exemplos realistas sem credenciais reais.
- Documentação de filtros, limites e ordenação.
- Documentação do refresh token e do transporte específico por tipo de cliente.
- Validação automática do documento no CI.
- Verificação de que os endpoints documentados correspondem ao comportamento real.

Esqueleto inicial:

```yaml
openapi: 3.1.0
info:
  title: Task Management API
  version: 1.0.0
  description: API REST para gerenciamento seguro de tarefas.

servers:
  - url: /api/v1

components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT

  schemas:
    TaskStatus:
      type: string
      enum:
        - pending
        - in_progress
        - completed

security:
  - bearerAuth: []

paths:
  /tasks:
    get:
      summary: Listar tarefas do usuário autenticado
      operationId: listTasks
      responses:
        "200":
          description: Lista de tarefas retornada
        "401":
          description: Autenticação inválida
    post:
      summary: Criar tarefa
      operationId: createTask
      responses:
        "201":
          description: Tarefa criada
        "400":
          description: Dados inválidos
        "401":
          description: Autenticação inválida
```

Esse exemplo é apenas um ponto de partida. A especificação entregue deve conter os schemas e contratos completos, incluindo `requestBody`, parâmetros e todos os status relevantes. Endpoints públicos, como cadastro e login, devem declarar explicitamente que não exigem Bearer token.

## 12. Segurança

### Checklist obrigatória

- [ ] Argon2id para senhas, com parâmetros de custo revisados.
- [ ] JWT com algoritmo permitido fixado no servidor e claims validadas.
- [ ] Access token de curta duração.
- [ ] Refresh token opaco, de alta entropia e armazenado somente como hash.
- [ ] Rotação de refresh tokens e detecção de reutilização.
- [ ] Revogação de sessão no backend.
- [ ] Isolamento de tarefas por usuário testado.
- [ ] Rate limit em login, cadastro e refresh.
- [ ] Helmet habilitado.
- [ ] CORS restrito a origens configuradas.
- [ ] HTTPS em produção.
- [ ] Limite de payload.
- [ ] Validação estrita de entrada e allowlist de campos atualizáveis.
- [ ] Segredos em variáveis de ambiente ou secret manager.
- [ ] `.env` ignorado pelo Git; `.env.example` sem segredos.
- [ ] Logs sem senhas, tokens ou payloads sensíveis.
- [ ] Respostas de produção sem stack traces.
- [ ] Dependências auditadas e atualizadas.
- [ ] Política de retenção para logs e metadados de sessão.
- [ ] Testes para acesso indevido a objetos (BOLA).
- [ ] Proteção CSRF se refresh token for transportado por cookie.
- [ ] Limites e timeouts para evitar consumo excessivo de recursos.

## 13. Testes

Stack: Vitest + Supertest. Usar banco isolado de testes, nunca a base de desenvolvimento ou produção.

### Unitários

- Regras de transição de status.
- Conclusão e reabertura de tarefa.
- Validações de negócio.
- Serviços com dependências simuladas quando apropriado.

### Integração

- Repositórios e queries.
- Índice único de e-mail.
- Persistência de sessões.
- Filtros e paginação.
- Tratamento de erros de persistência.

### HTTP e segurança

- Cadastro válido e inválido.
- E-mail duplicado.
- Login válido e inválido.
- JWT expirado, adulterado e com claims inválidas.
- Sessão revogada.
- Refresh token rotacionado e reutilizado.
- Logout e logout global.
- Usuário A tentando ler, editar ou excluir tarefa do usuário B.
- Tentativa de alterar role ou owner por mass assignment.
- Limites de paginação e parâmetros inválidos.
- Rate limit.
- Erro inesperado sem vazamento de detalhes.

### Contrato

- Validar OpenAPI no CI.
- Testar que respostas reais seguem os schemas.
- Verificar que endpoints protegidos exigem autenticação e os públicos não.

Não usar apenas cobertura percentual como critério de qualidade. Os testes de autorização, sessão e regras de negócio são prioritários.

## 14. Docker e execução local

Serviços iniciais:

```text
Docker Compose
├── api       Express + TypeScript
└── mongodb   MongoDB com volume persistente
```

Requisitos:

- Dockerfile multi-stage.
- Usuário não root no container da API.
- Dependências de desenvolvimento ausentes na imagem final.
- `.dockerignore` adequado.
- MongoDB sem porta pública em produção.
- Segredos injetados pelo ambiente.
- Healthchecks para API e banco.
- Encerramento gracioso e fechamento das conexões.
- Logs em stdout/stderr.
- Volume persistente para dados locais.
- Documentar como inicializar e limpar o ambiente de desenvolvimento.

## 15. CI/CD

Pipeline proposto:

1. Instalar dependências usando lockfile (`pnpm install --frozen-lockfile`).
2. Executar ESLint.
3. Verificar formatação, caso configurada no CI.
4. Executar `tsc --noEmit`.
5. Executar testes unitários.
6. Iniciar MongoDB de teste e executar testes de integração.
7. Validar OpenAPI.
8. Executar auditoria de dependências conforme política do projeto.
9. Construir a imagem Docker.
10. Publicar imagem/deploy apenas após todas as verificações obrigatórias passarem.

Nunca imprimir segredos em logs do pipeline. Separar permissões e credenciais de build das credenciais de deploy.

## 16. Observabilidade

- Logger estruturado.
- `requestId` por requisição e propagação para logs.
- Tempo de resposta e contagem de erros.
- Healthcheck de processo e readiness de dependências.
- Eventos de segurança: login falho, refresh reutilizado, revogação e bloqueios por rate limit.
- Nunca registrar senha, access token, refresh token ou cookie completo.
- Definir retenção de logs e evitar coletar dados pessoais desnecessários.

Métricas básicas podem ser adicionadas depois que os fluxos centrais estiverem estáveis.

## 17. Variáveis de ambiente

Exemplo de `.env.example` (somente placeholders):

```dotenv
NODE_ENV=development
PORT=3000
API_PREFIX=/api/v1
MONGODB_URI=mongodb://localhost:27017/task_management
JWT_ACCESS_SECRET=replace-with-a-long-random-secret
JWT_ISSUER=task-management-api
JWT_AUDIENCE=task-management-clients
ACCESS_TOKEN_TTL=15m
REFRESH_TOKEN_TTL_DAYS=30
CORS_ORIGINS=http://localhost:5173
LOG_LEVEL=debug
```

A lista final deve refletir a implementação real. Validar todas as variáveis na inicialização e falhar com uma mensagem clara se alguma configuração obrigatória estiver ausente ou inválida. Em produção, usar um secret manager ou mecanismo equivalente. Não reutilizar a chave JWT como chave para outras finalidades.

## 18. Plano de implementação e critérios de aceite

### Fase 1 — Fundação

- [ ] Inicializar projeto Node.js + TypeScript + Express.
- [ ] Configurar `strict`, ESLint, Prettier e pnpm.
- [ ] Criar `app.ts` e `server.ts`.
- [ ] Validar ambiente com Zod.
- [ ] Configurar conexão MongoDB.
- [ ] Configurar logger, request ID e error handler.
- [ ] Criar healthcheck.
- [ ] Critério: app inicia, valida ambiente e encerra corretamente.

### Fase 2 — Usuários, autenticação e sessões

- [ ] Model e repository de usuários.
- [ ] Cadastro com e-mail único e hash Argon2id.
- [ ] Login e JWT com claims validadas.
- [ ] Coleção de sessões.
- [ ] Refresh token rotativo.
- [ ] Logout, logout global e listagem/revogação de sessões.
- [ ] Rate limit e respostas genéricas de autenticação.
- [ ] Testes de expiração, revogação e reutilização.
- [ ] Critério: sessão revogada não autoriza requisições futuras.

### Fase 3 — Tarefas

- [ ] Model, repository, service, controller e routes.
- [ ] CRUD completo.
- [ ] Filtros, ordenação e paginação.
- [ ] Regras de status e `completedAt`.
- [ ] Índices alinhados às queries.
- [ ] Testes de isolamento por usuário.
- [ ] Critério: usuário nunca acessa ou altera tarefas de terceiros.

### Fase 4 — Documentação e contrato

- [ ] OpenAPI completo.
- [ ] Swagger UI.
- [ ] Exemplos de requests e responses.
- [ ] Schemas de sucesso, erro e paginação.
- [ ] Validação do contrato no CI.
- [ ] Critério: outra pessoa consegue usar a API seguindo apenas a documentação.

### Fase 5 — Hardening e automação

- [ ] Helmet, CORS e limites de payload.
- [ ] Rate limiting revisado.
- [ ] Testes de segurança.
- [ ] Docker multi-stage e Compose.
- [ ] CI com lint, tipos, testes e OpenAPI.
- [ ] Revisão de logs, segredos e dependências.
- [ ] Critério: pipeline falha quando uma verificação obrigatória falha.

### Fase 6 — Portfólio

- [ ] README com visão geral, stack e funcionalidades.
- [ ] Instruções para rodar localmente e via Docker.
- [ ] Exemplo `.env.example`.
- [ ] Diagrama de arquitetura e fluxo de sessão.
- [ ] Exemplos cURL.
- [ ] Decisões arquiteturais e trade-offs.
- [ ] Limitações conhecidas e roadmap.
- [ ] Licença e guia de contribuição.
- [ ] Critério: clone limpo do repositório pode ser executado seguindo as instruções.

## 19. Fora do escopo inicial

Deixar para versões futuras:

- Equipes e compartilhamento de tarefas.
- Comentários e anexos.
- Notificações por e-mail/push.
- Tarefas recorrentes.
- Auditoria de alterações de negócio mais completa.
- Painel administrativo.
- Cache distribuído.
- Microserviços e filas.

Adicionar essas funcionalidades somente depois que autenticação, autorização, persistência, documentação e testes estiverem sólidos.

## 20. Definição de pronto

A primeira versão só será considerada pronta quando:

1. Os fluxos principais estiverem implementados.
2. Todos os endpoints estiverem documentados.
3. A validação de entrada estiver aplicada de forma consistente.
4. O isolamento entre usuários estiver comprovado por testes.
5. A revogação de sessão estiver funcional.
6. Refresh tokens forem rotacionados e reutilização for tratada.
7. Os testes passarem em ambiente isolado.
8. Docker Compose permitir execução reproduzível.
9. CI validar lint, tipos, testes e OpenAPI.
10. README explicar setup, decisões e uso da API.
11. Não houver segredos no repositório nem informações sensíveis nos logs.

---

## Referências técnicas para consulta

- Express — Production Best Practices: Security: https://expressjs.com/en/advanced/best-practice-security.html
- OpenAPI Specification: https://spec.openapis.org/oas/latest.html
- OWASP REST Security Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html
- OWASP Session Management Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html
- OWASP Password Storage Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html
- MongoDB TTL Indexes: https://www.mongodb.com/docs/manual/core/index-ttl/

> Este documento é a especificação de arquitetura. Ele não afirma que a API já foi implementada; os critérios de aceite devem ser verificados durante o desenvolvimento.
