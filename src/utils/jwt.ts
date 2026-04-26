import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-secret';
const JWT_REFRESH = process.env.JWT_REFRESH_SECRET ?? 'dev-refresh-secret';

export function signTokens(userId: string, email: string) {
  const accessToken = jwt.sign({ userId, email }, JWT_SECRET, { expiresIn: '15m' });
  const refreshToken = jwt.sign({ userId, email }, JWT_REFRESH, { expiresIn: '30d' });
  return { accessToken, refreshToken };
}

export function verifyAccess(token: string) {
  return jwt.verify(token, JWT_SECRET) as { userId: string; email: string };
}

export function verifyRefresh(token: string) {
  return jwt.verify(token, JWT_REFRESH) as { userId: string; email: string };
}
