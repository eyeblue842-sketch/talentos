import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

const jwtOptions = {
  algorithm: 'HS256',
  expiresIn: env.jwtExpiresIn,
};

export function signToken(payload) {
  return jwt.sign(payload, env.jwtSecret, jwtOptions);
}

export function verifyToken(token) {
  return jwt.verify(token, env.jwtSecret, { algorithms: [jwtOptions.algorithm] });
}

export function getTokenExpiryIso() {
  const decoded = jwt.decode(signToken({ probe: true }));
  return new Date(decoded.exp * 1000).toISOString();
}
