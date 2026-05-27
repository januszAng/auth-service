import { describe, it, expect } from "bun:test";
import { hashPassword, verifyPassword } from "./password.js";

describe("hashPassword", () => {
  it("returns a bcrypt hash string", async () => {
    const hash = await hashPassword("test-password");
    expect(hash).toStartWith("$2b$12$");
  });

  it("produces different hashes for the same input", async () => {
    const hash1 = await hashPassword("same-password");
    const hash2 = await hashPassword("same-password");
    expect(hash1).not.toBe(hash2);
  });
});

describe("verifyPassword", () => {
  it("returns true for correct password", async () => {
    const hash = await hashPassword("my-password");
    const result = await verifyPassword("my-password", hash);
    expect(result).toBe(true);
  });

  it("returns false for incorrect password", async () => {
    const hash = await hashPassword("correct-password");
    const result = await verifyPassword("wrong-password", hash);
    expect(result).toBe(false);
  });

  it("handles empty string", async () => {
    const hash = await hashPassword("some-password");
    const result = await verifyPassword("", hash);
    expect(result).toBe(false);
  });
});

describe("round-trip", () => {
  const passwords = [
    "simple",
    "Str0ng!Pass#With$Special",
    "a".repeat(128),
    "unicode-password",
  ];

  for (const pw of passwords) {
    it(`hash and verify: "${pw.slice(0, 10)}..."`, async () => {
      const hash = await hashPassword(pw);
      expect(await verifyPassword(pw, hash)).toBe(true);
    });
  }
});
