import { existsSync } from 'node:fs'
import { loadEnvFile } from 'node:process'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { z } from 'zod'

// Source and compiled entry are each one directory below FrontEnd.
export const appRoot = fileURLToPath(new URL('../', import.meta.url))
const integer = (fallback: number, max: number) => z.coerce.number().int().min(1).max(max).default(fallback)
const envSchema = z.object({
  OPENAI_API_KEY: z.string().trim().default(''),
  OPENAI_MODEL: z.string().trim().min(1).default('gpt-4.1-mini'),
  AI_HOST: z.enum(['127.0.0.1', '::1', 'localhost']).default('127.0.0.1'),
  AI_PORT: integer(5175, 65535).refine((port) => ![4200, 8000].includes(port), 'Porta reservada a outro projeto'),
  AI_TIMEOUT_MS: integer(60000, 300000), AI_MAX_OUTPUT_TOKENS: integer(2000, 8000),
  AI_MAX_INPUT_TOKENS: integer(12000, 24000), AI_MAX_TOOL_ROUNDS: integer(4, 8),
  AI_MAX_TOOL_CALLS: integer(8, 20), AI_MAX_PROVIDER_CALLS: integer(6, 12),
  AI_RATE_LIMIT_PER_MINUTE: integer(10, 100), AI_MAX_CONCURRENT_REQUESTS: integer(2, 10),
  AI_DATA_DIR: z.string().min(1).default('./public/data'),
})
export function readConfig(env: NodeJS.ProcessEnv = process.env) {
  const values = envSchema.parse(env)
  return { ...values, dataDir: resolve(appRoot, values.AI_DATA_DIR) }
}
export function loadConfig() {
  const file = resolve(appRoot, '.env')
  if (existsSync(file)) loadEnvFile(file)
  return readConfig()
}
export type Config = ReturnType<typeof readConfig>
