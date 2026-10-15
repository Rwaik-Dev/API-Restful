import { Ajv2020 } from 'ajv/dist/2020.js';
import addFormatsModule from 'ajv-formats';
import type { Response } from 'supertest';
import { expect } from 'vitest';
import { loadOpenApiDocument } from '../../src/config/swagger.js';

type Json = Record<string, unknown>;
export type HttpMethod = 'get' | 'post' | 'patch' | 'delete' | 'put';

export const openApiDocument = loadOpenApiDocument();

const addFormats = addFormatsModule as unknown as (ajv: Ajv2020) => void;
const ajv = new Ajv2020({ strict: false, allErrors: true });
addFormats(ajv);
ajv.addFormat('password', true);
ajv.addSchema(openApiDocument, 'openapi');

function escapePointer(segment: string): string {
  return segment.replaceAll('~', '~0').replaceAll('/', '~1');
}

function resolvePointer(pointer: string): unknown {
  return pointer
    .replace(/^#\//, '')
    .split('/')
    .map((part) => part.replaceAll('~1', '/').replaceAll('~0', '~'))
    .reduce<unknown>((node, key) => (node as Json | undefined)?.[key], openApiDocument);
}

function operationPointer(method: HttpMethod, path: string): string {
  return `#/paths/${escapePointer(path)}/${method}`;
}

export function getOperation(method: HttpMethod, path: string): Json | undefined {
  return resolvePointer(operationPointer(method, path)) as Json | undefined;
}

/** Retorna o JSON pointer do schema da resposta documentada, seguindo `$ref` de responses. */
function responseSchemaPointer(method: HttpMethod, path: string, status: number): string | null {
  let pointer = `${operationPointer(method, path)}/responses/${status}`;
  let response = resolvePointer(pointer) as Json | undefined;
  if (!response) {
    throw new Error(`Status ${status} não documentado para ${method.toUpperCase()} ${path}`);
  }
  if (typeof response.$ref === 'string') {
    pointer = response.$ref;
    response = resolvePointer(pointer) as Json;
  }
  const content = response.content as Json | undefined;
  if (!content?.['application/json']) return null;
  return `${pointer}/content/application~1json/schema`;
}

/**
 * Valida status e body de uma resposta real contra o documento OpenAPI.
 * `path` é o template documentado (ex.: `/tasks/{taskId}`).
 */
export function expectToMatchContract(
  res: Response,
  method: HttpMethod,
  path: string,
  expectedStatus?: number,
): void {
  if (expectedStatus !== undefined) expect(res.status).toBe(expectedStatus);
  const pointer = responseSchemaPointer(method, path, res.status);

  if (pointer === null) {
    expect(res.text).toBe('');
    return;
  }

  const validate = ajv.getSchema(`openapi${pointer}`) ?? ajv.compile({ $ref: `openapi${pointer}` });
  const valid = validate(res.body);
  expect(
    valid,
    `${method.toUpperCase()} ${path} ${res.status} diverge do contrato: ${ajv.errorsText(validate.errors)}`,
  ).toBe(true);
}

export interface DocumentedOperation {
  method: HttpMethod;
  path: string;
  requiresAuth: boolean;
  serverUrl: string;
}

export function listDocumentedOperations(): DocumentedOperation[] {
  const paths = openApiDocument.paths as Record<string, Json>;
  const globalSecurity = openApiDocument.security as unknown[];
  const defaultServer = ((openApiDocument.servers as Json[])[0]?.url as string | undefined) ?? '';

  return Object.entries(paths).flatMap(([path, item]) => {
    const serverUrl =
      ((item.servers as Json[] | undefined)?.[0]?.url as string | undefined) ?? defaultServer;
    return (['get', 'post', 'patch', 'delete', 'put'] as const)
      .filter((method) => item[method])
      .map((method) => {
        const operation = item[method] as Json;
        const security = (operation.security as unknown[] | undefined) ?? globalSecurity;
        return { method, path, requiresAuth: security.length > 0, serverUrl };
      });
  });
}
