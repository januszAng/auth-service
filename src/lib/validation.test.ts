import { describe, it, expect } from "bun:test";
import {
  emailSchema,
  passwordSchema,
  registerSchema,
  loginSchema,
  tokenSchema,
} from "./validation.js";

describe("emailSchema", () => {
  it("accepts valid emails", () => {
    expect(emailSchema.safeParse("user@example.com").success).toBe(true);
    expect(emailSchema.safeParse("a@b.c.co").success).toBe(true);
    expect(emailSchema.safeParse("user+tag@domain.com").success).toBe(true);
  });

  it("rejects emails without @", () => {
    const result = emailSchema.safeParse("notanemail");
    expect(result.success).toBe(false);
  });

  it("rejects empty string", () => {
    const result = emailSchema.safeParse("");
    expect(result.success).toBe(false);
  });

  it("rejects emails over 255 characters", () => {
    const longEmail = "a".repeat(256) + "@b.com";
    const result = emailSchema.safeParse(longEmail);
    expect(result.success).toBe(false);
  });
});

describe("passwordSchema", () => {
  it("accepts valid passwords", () => {
    expect(passwordSchema.safeParse("Str0ngPas*").success).toBe(true);
  });

  it("rejects passwords shorter than 10 characters", () => {
    const result = passwordSchema.safeParse("Ab1defg*p");
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toContain("at least 10");
  });

  it("rejects passwords without uppercase", () => {
    const result = passwordSchema.safeParse("alllowercase1");
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toContain("uppercase");
  });

  it("rejects passwords without lowercase", () => {
    const result = passwordSchema.safeParse("ALLUPPERCASE1");
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toContain("lowercase");
  });

  it("rejects passwords without digit", () => {
    const result = passwordSchema.safeParse("NoDigitsHere");
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toContain("digit");
  });

  it("rejects passwords over 128 characters", () => {
    const result = passwordSchema.safeParse("Ab1" + "x".repeat(126));
    expect(result.success).toBe(false);
  });

  it("rejects empty password", () => {
    const result = passwordSchema.safeParse("");
    expect(result.success).toBe(false);
  });
});

describe("registerSchema", () => {
  it("accepts valid input", () => {
    expect(
      registerSchema.safeParse({
        email: "user@example.com",
        password: "Str0ngPass^",
      }).success,
    ).toBe(true);
  });

  it("rejects invalid email", () => {
    expect(
      registerSchema.safeParse({ email: "bad", password: "Str0ngPass" })
        .success,
    ).toBe(false);
  });

  it("rejects invalid password", () => {
    expect(
      registerSchema.safeParse({ email: "a@b.com", password: "short" }).success,
    ).toBe(false);
  });
});

describe("loginSchema", () => {
  it("accepts valid input", () => {
    expect(
      loginSchema.safeParse({
        email: "user@example.com",
        password: "anything",
      }).success,
    ).toBe(true);
  });

  it("rejects empty password", () => {
    expect(
      loginSchema.safeParse({ email: "a@b.com", password: "" }).success,
    ).toBe(false);
  });
});

describe("tokenSchema", () => {
  it("accepts valid token", () => {
    expect(
      tokenSchema.safeParse({ accessToken: "some.jwt.token" }).success,
    ).toBe(true);
  });

  it("rejects empty token", () => {
    expect(tokenSchema.safeParse({ accessToken: "" }).success).toBe(false);
  });
});
