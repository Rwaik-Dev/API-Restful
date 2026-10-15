import { readFileSync } from 'node:fs';
import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';
import { parse } from 'yaml';

const specPath = new URL('../docs/openapi.yaml', import.meta.url);

export function loadOpenApiDocument(): Record<string, unknown> {
  return parse(readFileSync(specPath, 'utf8')) as Record<string, unknown>;
}

export function createDocsRouter(): Router {
  const document = loadOpenApiDocument();
  const router = Router();

  router.get('/docs.json', (_req, res) => {
    res.json(document);
  });
  router.use(
    '/docs',
    swaggerUi.serve,
    swaggerUi.setup(document, { customSiteTitle: 'Task Management API' }),
  );

  return router;
}
