import { describe, expect, it } from "bun:test";
import { users } from "./users.js";

const nameSymbol = Object.getOwnPropertySymbols(users).find(
  (s) => s.toString() === "Symbol(drizzle:Name)",
);

if (!nameSymbol) {
  throw new Error("drizzle:Name symbol not found on users table");
}

describe("users table schema", () => {
  it("has the correct table name", () => {
    const name = (users as unknown as Record<symbol, string>)[nameSymbol];
    expect(name).toBe("users");
  });

  it("has expected column names", () => {
    const col = users.id as { name: string };
    expect(col.name).toBe("id");
    expect(users.email.name).toBe("email");
    expect(users.passwordHash.name).toBe("password_hash");
    expect(users.role.name).toBe("role");
    expect(users.createdAt.name).toBe("created_at");
    expect(users.updatedAt.name).toBe("updated_at");
  });

  it("email has notNull constraint", () => {
    expect(users.email.notNull).toBe(true);
  });

  it("email has isUnique constraint", () => {
    expect(users.email.isUnique).toBe(true);
  });

  it("id is the primary key", () => {
    expect(users.id.primary).toBe(true);
  });

  it("passwordHash has notNull constraint", () => {
    expect(users.passwordHash.notNull).toBe(true);
  });

  it("role has notNull constraint", () => {
    expect(users.role.notNull).toBe(true);
  });
});
