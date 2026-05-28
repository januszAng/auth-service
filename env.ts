import { z } from "zod";

export const STAGES = {
  DEV: "development",
  TEST: "test",
  PROD: "production",
};
// Defining the Schema
// using .default() in case if variable is missing in the .env file
const envSchema = z.object({
  NODE_ENV: z.enum([STAGES.DEV, STAGES.PROD, STAGES.TEST]).default(STAGES.DEV),

  PORT: z.coerce.number().positive().default(50051),
  DATABASE_URL: z.string().startsWith("postgres://"),
  DB_POOL_MAX: z.coerce.number().positive().default(5),
  DB_CONNECT_TIMEOUT: z.coerce.number().positive().default(10),
  DB_IDLE_TIMEOUT: z.coerce.number().positive().default(30),
  JWT_SECRET: z.string().min(32, "Must be at least 32 characters long"),
  LOG_LEVEL: z
    .enum(["info", "warn", "error", "debug", "trace"])
    .default("info"),
  JWT_ACCESS_TOKEN_EXPIRES_IN: z.string().default("15 minutes"),
  JWT_REFRESH_TOKEN_EXPIRES_IN: z.string().default("7 days"),
  JWT_ALGORITHM: z.enum(["HS256", "RS256"]).default("HS256"),
  BCRYPT_ROUNDS: z.coerce.number().positive().min(10).max(20).default(12),
});

export type Env = z.infer<typeof envSchema>;

// Parsing and Validating
let env: Env;

try {
  console.log("🔍 Validating environment variables...");
  console.log(process.env); // Log the raw environment variables for debugging
  env = envSchema.parse(process.env);
} catch (err) {
  if (err instanceof z.ZodError) {
    console.error("❌ Environment validation failed:");

    // This gives a clean breakdown of which variables are missing or wrong
    err.issues.forEach((issue) => {
      console.error(`   - ${issue.path.join(".")}: ${issue.message}`);
    });

    process.exit(1);
  }
  throw err;
}

// Helper exports
export const isProd = () => env.NODE_ENV === STAGES.PROD;
export const isDev = () => env.NODE_ENV === STAGES.DEV;
export const isTest = () => env.NODE_ENV === STAGES.TEST;

export { env };
