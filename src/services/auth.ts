import { Code, ConnectError, type ServiceImpl } from "@connectrpc/connect";
import { eq } from "drizzle-orm";
import { db } from "../db/connection.js";
import { users } from "../db/schema/index.js";
import type { AuthService } from "../gen/auth_pb.js";
import { Role } from "../gen/auth_pb.js";
import {
  createTokenPair,
  verifyAccessToken,
  verifyRefreshToken,
} from "../lib/jwt.js";
import { logger } from "../lib/logger.js";
import { hashPassword, verifyPassword } from "../lib/password.js";
import {
  loginSchema,
  refreshTokenSchema,
  registerSchema,
  tokenSchema,
} from "../lib/validation.js";

const authLogger = logger.child({ component: "auth" });

function roleFromDb(dbRole: string): Role {
  if (dbRole === "admin") return Role.ADMIN;
  return Role.USER;
}

const authServiceImpl: ServiceImpl<typeof AuthService> = {
  async register(req) {
    const parsed = registerSchema.safeParse(req);
    if (!parsed.success) {
      const message = parsed.error.issues.map((i) => i.message).join(", ");
      authLogger.warn("register validation failed", { reason: message });
      throw new ConnectError(message, Code.InvalidArgument);
    }

    const { email, password } = parsed.data;

    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existing.length > 0) {
      authLogger.warn("register duplicate email", { email });
      throw new ConnectError("Email already registered", Code.AlreadyExists);
    }

    const passwordHash = await hashPassword(password);

    const [user] = await db
      .insert(users)
      .values({ email, passwordHash })
      .returning({ id: users.id, role: users.role });

    if (!user) {
      authLogger.error("register insert failed to return user", { email });
      throw new ConnectError("Failed to create user", Code.Internal);
    }

    const { accessToken, refreshToken } = await createTokenPair({
      sub: user.id,
      email,
      role: user.role,
    });

    authLogger.info("user registered", { userId: user.id, email });
    return {
      userId: user.id,
      accessToken,
      refreshToken,
    };
  },

  async login(req) {
    const parsed = loginSchema.safeParse(req);
    if (!parsed.success) {
      const message = parsed.error.issues.map((i) => i.message).join(", ");
      authLogger.warn("login validation failed", { reason: message });
      throw new ConnectError(message, Code.InvalidArgument);
    }

    const { email, password } = parsed.data;

    const rows = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    const user = rows[0];
    if (!user) {
      authLogger.warn("login unknown email", { email });
      throw new ConnectError("Invalid email or password", Code.Unauthenticated);
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      authLogger.warn("login wrong password", { email, userId: user.id });
      throw new ConnectError("Invalid email or password", Code.Unauthenticated);
    }

    const { accessToken, refreshToken } = await createTokenPair({
      sub: user.id,
      email: user.email,
      role: user.role,
    });

    authLogger.info("user logged in", { userId: user.id, email });
    return { accessToken, refreshToken };
  },

  async verifyToken(req) {
    const parsed = tokenSchema.safeParse(req);
    if (!parsed.success) {
      const message = parsed.error.issues.map((i) => i.message).join(", ");
      authLogger.warn("verifyToken validation failed", { reason: message });
      throw new ConnectError(message, Code.InvalidArgument);
    }

    try {
      const result = await verifyAccessToken(parsed.data.accessToken);
      authLogger.debug("token verified", { userId: result.userId });
      return {
        userId: result.userId,
        email: result.email,
        role: roleFromDb(result.role),
      };
    } catch {
      authLogger.warn("verifyToken invalid token");
      throw new ConnectError(
        "Invalid or expired access token",
        Code.Unauthenticated,
      );
    }
  },

  async refreshToken(req) {
    const parsed = refreshTokenSchema.safeParse(req);
    if (!parsed.success) {
      const message = parsed.error.issues.map((i) => i.message).join(", ");
      authLogger.warn("refreshToken validation failed", { reason: message });
      throw new ConnectError(message, Code.InvalidArgument);
    }

    try {
      const result = await verifyRefreshToken(parsed.data.refreshToken);
      const { accessToken, refreshToken } = await createTokenPair({
        sub: result.userId,
        email: result.email,
        role: result.role,
      });
      authLogger.debug("token refreshed", { userId: result.userId });
      return { accessToken, refreshToken };
    } catch {
      authLogger.warn("refreshToken invalid token");
      throw new ConnectError(
        "Invalid or expired refresh token",
        Code.Unauthenticated,
      );
    }
  },
};

export { authServiceImpl };
