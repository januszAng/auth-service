import { beforeEach, describe, expect, it, mock } from "bun:test";
import type { HandlerContext } from "@connectrpc/connect";
import type {
  ForgotPasswordRequest,
  LoginRequest,
  RefreshTokenRequest,
  RegisterRequest,
  ResetPasswordRequest,
  VerifyTokenRequest,
} from "../gen/auth_pb.js";
import { Role } from "../gen/auth_pb.js";

// Build a mock Drizzle query builder chain
function mockDb() {
  let selectResults: unknown[][] = [];
  let insertResult: unknown[] = [{ id: "uuid-123", role: "user" }];

  const db = {
    select: mock(() => db),
    from: mock(() => db),
    where: mock(() => db),
    limit: mock(() => {
      const result = selectResults.shift() ?? [];
      return result;
    }),
    insert: mock(() => db),
    values: mock(() => db),
    returning: mock(() => insertResult),
    delete: mock(() => db),
    update: mock(() => db),
    set: mock(() => db),
  };

  return {
    db: db as unknown as Record<string, unknown>,
    setSelectResults: (rows: unknown[][]) => {
      selectResults = [...rows];
    },
    setSelectResult: (rows: unknown[]) => {
      selectResults = [rows];
    },
    setInsertResult: (rows: unknown[]) => {
      insertResult = rows;
    },
  };
}

const {
  db: mockDbInstance,
  setSelectResult,
  setSelectResults,
  setInsertResult,
} = mockDb();

const mockCtx = {
  method: { name: "", kind: "unary" },
  service: { typeName: "" },
  signal: new AbortController().signal,
} as unknown as HandlerContext;

mock.module("../db/connection.js", () => ({
  db: mockDbInstance,
}));

mock.module("../lib/password.js", () => ({
  hashPassword: mock(async (pw: string) => `hashed:${pw}`),
  verifyPassword: mock(
    async (pw: string, hash: string) => hash === `hashed:${pw}`,
  ),
}));

mock.module("../lib/jwt.js", () => ({
  createTokenPair: mock(
    async (payload: { sub: string; email: string; role: string }) => ({
      accessToken: `access.${payload.sub}`,
      refreshToken: `refresh.${payload.sub}`,
    }),
  ),
  verifyAccessToken: mock(async (token: string) => {
    if (token.startsWith("access.")) {
      const userId = token.slice(7);
      return { userId, email: "test@test.com", role: "user" };
    }
    throw new Error("Invalid token");
  }),
  verifyRefreshToken: mock(async (token: string) => {
    if (token.startsWith("refresh.")) {
      const userId = token.slice(8);
      return { userId, email: "test@test.com", role: "user" };
    }
    throw new Error("Invalid token");
  }),
}));

const mockPublishToQueue = mock(async () => {});

mock.module("../lib/rabbitmq.js", () => ({
  publishToQueue: mockPublishToQueue,
}));

const { authServiceImpl } = await import("./auth.js");

describe("AuthService.register", () => {
  beforeEach(() => {
    setSelectResult([]);
    setInsertResult([{ id: "uuid-123", role: "user" }]);
  });

  it("registers a new user and returns tokens", async () => {
    const result = await authServiceImpl.register(
      { email: "new@example.com", password: "Str0ngPass#" } as RegisterRequest,
      mockCtx,
    );

    expect(result.userId).toBe("uuid-123");
    expect(result.accessToken).toStartWith("access.");
    expect(result.refreshToken).toStartWith("refresh.");
  });

  it("throws on duplicate email", async () => {
    setSelectResult([{ id: "existing-uuid" }]);

    await expect(
      authServiceImpl.register(
        {
          email: "exists@example.com",
          password: "Str0ngPass*",
        } as RegisterRequest,
        mockCtx,
      ),
    ).rejects.toThrow("Email already registered");
  });

  it("throws on invalid email", async () => {
    await expect(
      authServiceImpl.register(
        { email: "not-an-email", password: "Str0ngPass$" } as RegisterRequest,
        mockCtx,
      ),
    ).rejects.toThrow();
  });

  it("throws on invalid password", async () => {
    await expect(
      authServiceImpl.register(
        { email: "valid@example.com", password: "short" } as RegisterRequest,
        mockCtx,
      ),
    ).rejects.toThrow();
  });

  it("throws when insert fails to return user", async () => {
    setInsertResult([]);

    await expect(
      authServiceImpl.register(
        {
          email: "new@example.com",
          password: "Str0ngPass#",
        } as RegisterRequest,
        mockCtx,
      ),
    ).rejects.toThrow("Failed to create user");
  });
});

describe("AuthService.login", () => {
  beforeEach(() => {
    setSelectResult([
      {
        id: "user-1",
        email: "login@test.com",
        passwordHash: "hashed:Str0ngPass1",
        role: "user",
      },
    ]);
  });

  it("returns tokens for valid credentials", async () => {
    const result = await authServiceImpl.login(
      { email: "login@test.com", password: "Str0ngPass1" } as LoginRequest,
      mockCtx,
    );

    expect(result.accessToken).toStartWith("access.");
    expect(result.refreshToken).toStartWith("refresh.");
  });

  it("throws on wrong password", async () => {
    await expect(
      authServiceImpl.login(
        { email: "login@test.com", password: "wrong-password" } as LoginRequest,
        mockCtx,
      ),
    ).rejects.toThrow("Invalid email or password");
  });

  it("throws on unknown email", async () => {
    setSelectResult([]);

    await expect(
      authServiceImpl.login(
        { email: "no@user.com", password: "anything123" } as LoginRequest,
        mockCtx,
      ),
    ).rejects.toThrow("Invalid email or password");
  });

  it("throws on invalid email format", async () => {
    await expect(
      authServiceImpl.login(
        { email: "bad-email", password: "anything123" } as LoginRequest,
        mockCtx,
      ),
    ).rejects.toThrow();
  });
});

describe("AuthService.verifyToken", () => {
  it("returns user info with role for good token", async () => {
    const result = await authServiceImpl.verifyToken(
      { accessToken: "access.user-1" } as VerifyTokenRequest,
      mockCtx,
    );

    expect(result.userId).toBe("user-1");
    expect(result.email).toBe("test@test.com");
    expect(result.role).toBe(Role.USER);
  });

  it("throws for bad token", async () => {
    await expect(
      authServiceImpl.verifyToken(
        { accessToken: "some.bad.token" } as VerifyTokenRequest,
        mockCtx,
      ),
    ).rejects.toThrow("Invalid or expired access token");
  });

  it("throws on empty token", async () => {
    await expect(
      authServiceImpl.verifyToken(
        { accessToken: "" } as VerifyTokenRequest,
        mockCtx,
      ),
    ).rejects.toThrow();
  });
});

describe("AuthService.refreshToken", () => {
  it("returns new token pair for valid refresh token", async () => {
    const result = await authServiceImpl.refreshToken(
      { refreshToken: "refresh.user-1" } as RefreshTokenRequest,
      mockCtx,
    );

    expect(result.accessToken).toStartWith("access.");
    expect(result.refreshToken).toStartWith("refresh.");
  });

  it("throws for bad refresh token", async () => {
    await expect(
      authServiceImpl.refreshToken(
        { refreshToken: "invalid.token" } as RefreshTokenRequest,
        mockCtx,
      ),
    ).rejects.toThrow("Invalid or expired refresh token");
  });

  it("throws on empty refresh token", async () => {
    await expect(
      authServiceImpl.refreshToken(
        { refreshToken: "" } as RefreshTokenRequest,
        mockCtx,
      ),
    ).rejects.toThrow();
  });
});

describe("AuthService.forgotPassword", () => {
  beforeEach(() => {
    mockPublishToQueue.mockClear();
  });

  it("generates token and publishes for known email", async () => {
    setSelectResult([{ id: "user-1" }]);

    const result = await authServiceImpl.forgotPassword(
      { email: "known@example.com" } as ForgotPasswordRequest,
      mockCtx,
    );

    expect(result).toEqual({});
    expect(mockPublishToQueue).toHaveBeenCalledWith({
      type: "RESET_PASSWORD",
      email: "known@example.com",
      token: expect.any(String),
    });
  });

  it("returns empty without publishing for unknown email", async () => {
    setSelectResult([]);

    const result = await authServiceImpl.forgotPassword(
      { email: "unknown@example.com" } as ForgotPasswordRequest,
      mockCtx,
    );

    expect(result).toEqual({});
    expect(mockPublishToQueue).not.toHaveBeenCalled();
  });

  it("throws on invalid email", async () => {
    await expect(
      authServiceImpl.forgotPassword(
        { email: "not-an-email" } as ForgotPasswordRequest,
        mockCtx,
      ),
    ).rejects.toThrow();
  });
});

describe("AuthService.resetPassword", () => {
  const validToken = {
    id: "token-id",
    userId: "user-1",
    token: "reset-token-123",
    expiresAt: new Date(Date.now() + 600_000),
  };

  const userRow = {
    id: "user-1",
    email: "user@example.com",
    passwordHash: "hashed:OldPass1",
    role: "user",
  };

  beforeEach(() => {
    mockPublishToQueue.mockClear();
  });

  it("resets password with valid token", async () => {
    setSelectResults([[validToken], [userRow]]);

    const result = await authServiceImpl.resetPassword(
      {
        token: "reset-token-123",
        newPassword: "NewStr0ngPass!",
      } as ResetPasswordRequest,
      mockCtx,
    );

    expect(result).toEqual({});
  });

  it("throws on invalid token", async () => {
    setSelectResult([]);

    await expect(
      authServiceImpl.resetPassword(
        {
          token: "bad-token",
          newPassword: "NewStr0ngPass!",
        } as ResetPasswordRequest,
        mockCtx,
      ),
    ).rejects.toThrow("Invalid or expired reset token");
  });

  it("throws on expired token", async () => {
    setSelectResult([{ ...validToken, expiresAt: new Date(Date.now() - 1) }]);

    await expect(
      authServiceImpl.resetPassword(
        {
          token: "expired-token",
          newPassword: "NewStr0ngPass!",
        } as ResetPasswordRequest,
        mockCtx,
      ),
    ).rejects.toThrow("Invalid or expired reset token");
  });

  it("throws on weak password", async () => {
    await expect(
      authServiceImpl.resetPassword(
        {
          token: "any-token",
          newPassword: "short",
        } as ResetPasswordRequest,
        mockCtx,
      ),
    ).rejects.toThrow();
  });
});
