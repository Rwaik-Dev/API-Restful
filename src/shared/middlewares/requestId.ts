import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';

const incomingIdPattern = /^[\w-]{1,64}$/;

export const requestId: RequestHandler = (req, res, next) => {
  const incoming = req.get('x-request-id');
  req.id = incoming && incomingIdPattern.test(incoming) ? incoming : `req_${randomUUID()}`;
  res.setHeader('X-Request-Id', req.id);
  next();
};
