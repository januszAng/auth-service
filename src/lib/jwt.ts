import * as jose from "jose";
import { env } from "../../env.js";

interface TokenPayload {
  sub: string;
  email: string;
  role: string;
}

function getSecret(): Uint8Array {
  const secret = env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET environment variable is not set");
  }
  return new TextEncoder().encode(secret);
}

function getIssuer(): string {
  return "auth-service";
}

function getAudience(): string {
  return "proton";
}

export async function createAccessToken(
  payload: TokenPayload,
): Promise<string> {
  return new jose.SignJWT({ email: payload.email, role: payload.role })
    .setProtectedHeader({ alg: env.JWT_ALGORITHM })
    .setSubject(payload.sub)
    .setIssuer(getIssuer())
    .setAudience(getAudience())
    .setIssuedAt()
    .setExpirationTime(env.JWT_ACCESS_TOKEN_EXPIRES_IN)
    .sign(getSecret());
}

export async function createRefreshToken(
  payload: TokenPayload,
): Promise<string> {
  return new jose.SignJWT({ email: payload.email, role: payload.role })
    .setProtectedHeader({ alg: env.JWT_ALGORITHM })
    .setSubject(payload.sub)
    .setIssuer(getIssuer())
    .setAudience(getAudience())
    .setIssuedAt()
    .setExpirationTime(env.JWT_REFRESH_TOKEN_EXPIRES_IN)
    .sign(getSecret());
}

export async function verifyAccessToken(
  token: string,
): Promise<{ userId: string; email: string; role: string }> {
  const { payload } = await jose.jwtVerify(token, getSecret(), {
    issuer: getIssuer(),
    audience: getAudience(),
    algorithms: [env.JWT_ALGORITHM],
  });
  return {
    userId: payload.sub as string,
    email: payload.email as string,
    role: payload.role as string,
  };
}

export async function verifyRefreshToken(
  token: string,
): Promise<{ userId: string; email: string; role: string }> {
  const { payload } = await jose.jwtVerify(token, getSecret(), {
    issuer: getIssuer(),
    audience: getAudience(),
    algorithms: [env.JWT_ALGORITHM],
  });
  return {
    userId: payload.sub as string,
    email: payload.email as string,
    role: payload.role as string,
  };
}

export async function createTokenPair(payload: TokenPayload) {
  const [accessToken, refreshToken] = await Promise.all([
    createAccessToken(payload),
    createRefreshToken(payload),
  ]);
  return { accessToken, refreshToken };
}
