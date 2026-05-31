import { Code, ConnectError, type ServiceImpl } from "@connectrpc/connect";
import { eq } from "drizzle-orm";
import { db } from "../db/connection.js";
import { passwordResetTokens, users } from "../db/schema/index.js";
import type { AuthService } from "../gen/auth_pb.js";
import { Role } from "../gen/auth_pb.js";
import {
  createTokenPair,
  verifyAccessToken,
  verifyRefreshToken,
} from "../lib/jwt.js";
import { logger } from "../lib/logger.js";
import { hashPassword, verifyPassword } from "../lib/password.js";
import { publishToQueue } from "../lib/rabbitmq.js";
import {
  forgotPasswordSchema,
  loginSchema,
  refreshTokenSchema,
  registerSchema,
  resetPasswordSchema,
  tokenSchema,
} from "../lib/validation.js";

function generateToken(): string {
  return crypto.randomUUID();
}

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

    const verificationToken = generateToken();
    await publishToQueue({
      type: "VERIFY_EMAIL",
      email,
      token: verificationToken,
    });

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

  async verifyEmail() {
    throw new ConnectError("Not implemented", Code.Unimplemented);
  },

  async forgotPassword(req) {
    const parsed = forgotPasswordSchema.safeParse(req);
    if (!parsed.success) {
      const message = parsed.error.issues.map((i) => i.message).join(", ");
      authLogger.warn("forgotPassword validation failed", { reason: message });
      throw new ConnectError(message, Code.InvalidArgument);
    }

    const { email } = parsed.data;

    const rows = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    const user = rows[0];
    if (user) {
      const token = generateToken();
      const expiresAt = new Date(Date.now() + 900_000);

      await db
        .delete(passwordResetTokens)
        .where(eq(passwordResetTokens.userId, user.id));

      await db.insert(passwordResetTokens).values({
        userId: user.id,
        token,
        expiresAt,
      });

      await publishToQueue({
        type: "RESET_PASSWORD",
        email,
        token,
      });

      authLogger.info("password reset token generated", { userId: user.id });
    } else {
      authLogger.debug("forgotPassword for unknown email", { email });
    }

    return {};
  },

  async resetPassword(req) {
    const parsed = resetPasswordSchema.safeParse(req);
    if (!parsed.success) {
      const message = parsed.error.issues.map((i) => i.message).join(", ");
      authLogger.warn("resetPassword validation failed", { reason: message });
      throw new ConnectError(message, Code.InvalidArgument);
    }

    const { token, newPassword } = parsed.data;

    const tokenRows = await db
      .select()
      .from(passwordResetTokens)
      .where(eq(passwordResetTokens.token, token))
      .limit(1);

    const tokenRow = tokenRows[0];
    if (!tokenRow) {
      authLogger.warn("resetPassword invalid token");
      throw new ConnectError(
        "Invalid or expired reset token",
        Code.InvalidArgument,
      );
    }

    if (tokenRow.expiresAt < new Date()) {
      authLogger.warn("resetPassword expired token", {
        userId: tokenRow.userId,
      });
      await db
        .delete(passwordResetTokens)
        .where(eq(passwordResetTokens.id, tokenRow.id));
      throw new ConnectError(
        "Invalid or expired reset token",
        Code.InvalidArgument,
      );
    }

    const userRows = await db
      .select()
      .from(users)
      .where(eq(users.id, tokenRow.userId))
      .limit(1);

    const user = userRows[0];
    if (!user) {
      authLogger.error("resetPassword user not found for token", {
        userId: tokenRow.userId,
      });
      throw new ConnectError("User not found", Code.Internal);
    }

    const passwordHash = await hashPassword(newPassword);

    await db
      .update(users)
      .set({ passwordHash, updatedAt: new Date() })
      .where(eq(users.id, user.id));

    await db
      .delete(passwordResetTokens)
      .where(eq(passwordResetTokens.id, tokenRow.id));

    authLogger.info("password reset", { userId: user.id });
    return {};
  },
};

export { authServiceImpl };
