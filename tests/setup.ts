import { MongoMemoryServer } from 'mongodb-memory-server';

export default async function setup(): Promise<() => Promise<void>> {
  const mongo = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongo.getUri();

  return async () => {
    await mongo.stop();
  };
}
