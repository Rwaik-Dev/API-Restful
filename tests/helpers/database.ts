import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import { afterAll, beforeAll, beforeEach } from 'vitest';

function testDatabaseUri(): string {
  const base = process.env.MONGODB_URI;
  if (!base) throw new Error('MONGODB_URI não definido pelo global setup dos testes');
  const url = new URL(base);
  url.pathname = `/test_${randomUUID().replaceAll('-', '')}`;
  return url.toString();
}

export async function clearDatabase(): Promise<void> {
  const collections = Object.values(mongoose.connection.collections);
  await Promise.all(collections.map((collection) => collection.deleteMany({})));
}

/** Conecta o arquivo de teste a um banco isolado e limpa as coleções antes de cada teste. */
export function useTestDatabase(): void {
  beforeAll(async () => {
    await mongoose.connect(testDatabaseUri());
    await Promise.all(Object.values(mongoose.models).map((model) => model.syncIndexes()));
  });

  beforeEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });
}
