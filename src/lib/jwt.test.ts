import { describe, it, expect, beforeAll } from "bun:test";
import {
  createAccessToken,
  createRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  createTokenPair,
} from "./jwt.js";

beforeAll(() => {
  process.env.JWT_SECRET = "test-secret-for-unit-tests-only";
});

describe("createAccessToken", () => {
  it("creates a string JWT", async () => {
    const token = await createAccessToken({
      sub: "user-123",
      email: "test@example.com",
      role: "user",
    });
    expect(typeof token).toBe("string");
    expect(token.split(".").length).toBe(3);
  });
});

describe("createRefreshToken", () => {
  it("creates a string JWT", async () => {
    const token = await createRefreshToken({
      sub: "user-123",
      email: "test@example.com",
      role: "user",
    });
    expect(typeof token).toBe("string");
    expect(token.split(".").length).toBe(3);
  });
});

describe("missing JWT_SECRET", () => {
  it("throws when JWT_SECRET is not set", async () => {
    const original = process.env.JWT_SECRET;
    delete process.env.JWT_SECRET;
    await expect(
      createAccessToken({ sub: "u", email: "e@t.com", role: "user" }),
    ).rejects.toThrow("JWT_SECRET environment variable is not set");
    process.env.JWT_SECRET = original;
  });
});

describe("verifyAccessToken", () => {
  it("verifies a valid token", async () => {
    const token = await createAccessToken({
      sub: "user-456",
      email: "verify@example.com",
      role: "user",
    });
    const result = await verifyAccessToken(token);
    expect(result.userId).toBe("user-456");
    expect(result.email).toBe("verify@example.com");
    expect(result.role).toBe("user");
  });

  it("throws on a malformed token", async () => {
    await expect(verifyAccessToken("not.a.token")).rejects.toThrow();
  });

  it("throws on an empty token", async () => {
    await expect(verifyAccessToken("")).rejects.toThrow();
  });

  it("throws on a token signed with different secret", async () => {
    const token = await createAccessToken({
      sub: "user-789",
      email: "secret@example.com",
      role: "user",
    });
    const originalSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = "a-different-secret";
    await expect(verifyAccessToken(token)).rejects.toThrow();
    process.env.JWT_SECRET = originalSecret;
  });
});

describe("verifyRefreshToken", () => {
  it("verifies a valid token", async () => {
    const token = await createRefreshToken({
      sub: "user-456",
      email: "verify@example.com",
      role: "user",
    });
    const result = await verifyRefreshToken(token);
    expect(result.userId).toBe("user-456");
    expect(result.email).toBe("verify@example.com");
  });

  it("throws on a malformed token", async () => {
    await expect(verifyRefreshToken("not.a.token")).rejects.toThrow();
  });
});

describe("createTokenPair", () => {
  it("returns both tokens", async () => {
    const pair = await createTokenPair({
      sub: "user-999",
      email: "pair@example.com",
      role: "user",
    });
    expect(typeof pair.accessToken).toBe("string");
    expect(typeof pair.refreshToken).toBe("string");
    expect(pair.accessToken).not.toBe(pair.refreshToken);
  });

  it("produces access and refresh tokens of different lengths", async () => {
    const pair = await createTokenPair({
      sub: "user-1",
      email: "a@b.com",
      role: "admin",
    });
    expect(pair.accessToken.length).toBeGreaterThan(0);
    expect(pair.refreshToken.length).toBeGreaterThan(0);
  });
});
