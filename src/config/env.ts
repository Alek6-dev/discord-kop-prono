import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DISCORD_TOKEN: z.string().min(1).optional(),
  DISCORD_CLIENT_ID: z.string().min(1).optional(),
  DISCORD_GUILD_ID: z.string().min(1).optional(),
  DISCORD_PRONOSTICS_CHANNEL_ID: z.string().min(1).optional(),
  DISCORD_RESULTS_CHANNEL_ID: z.string().min(1).optional(),
  DISCORD_ADMIN_CHANNEL_ID: z.string().min(1).optional(),
  DATABASE_URL: z.string().url(),
  ADMIN_HOST: z.string().default("127.0.0.1"),
  ADMIN_PORT: z.coerce.number().int().positive().default(3000)
});

export const env = envSchema.parse(process.env);
