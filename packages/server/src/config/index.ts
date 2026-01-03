import { z } from 'zod';

const envSchema = z.object({
  // Environment
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Server
  PORT: z.coerce.number().default(3001),
  API_URL: z.string().url(),
  CLIENT_URL: z.string().url(),

  // MongoDB
  MONGODB_URI: z.string(),

  // Redis
  REDIS_URL: z.string().optional(),

  // JWT
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('7d'),

  // Google OAuth
  GOOGLE_CLIENT_ID: z.string(),
  GOOGLE_CLIENT_SECRET: z.string(),

  // AWS
  AWS_REGION: z.string().default('us-east-1'),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_ENDPOINT_URL: z.string().optional(), // For LocalStack

  // KMS
  KMS_CMK_ARN: z.string(),

  // SES
  SES_FROM_ADDRESS: z.string().email(),

  // Secrets
  HASH_PEPPER: z.string().min(32),

  // Feature Flags
  FEATURE_CALENDAR_SYNC: z.coerce.boolean().default(true),
  FEATURE_CONTACT_IMPORT: z.coerce.boolean().default(true),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error('❌ Invalid environment variables:');
    console.error(result.error.flatten().fieldErrors);
    process.exit(1);
  }

  return result.data;
}

export const env = loadEnv();

// Derived config
export const config = {
  env: env.NODE_ENV,
  isDev: env.NODE_ENV === 'development',
  isProd: env.NODE_ENV === 'production',
  isTest: env.NODE_ENV === 'test',

  server: {
    port: env.PORT,
    apiUrl: env.API_URL,
    clientUrl: env.CLIENT_URL,
  },

  mongodb: {
    uri: env.MONGODB_URI,
  },

  redis: {
    url: env.REDIS_URL,
  },

  jwt: {
    secret: env.JWT_SECRET,
    expiresIn: env.JWT_EXPIRES_IN,
  },

  google: {
    clientId: env.GOOGLE_CLIENT_ID,
    clientSecret: env.GOOGLE_CLIENT_SECRET,
    callbackUrl: `${env.API_URL}/api/v1/auth/google/callback`,
  },

  aws: {
    region: env.AWS_REGION,
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
    endpointUrl: env.AWS_ENDPOINT_URL,
  },

  kms: {
    cmkArn: env.KMS_CMK_ARN,
  },

  ses: {
    fromAddress: env.SES_FROM_ADDRESS,
  },

  security: {
    hashPepper: env.HASH_PEPPER,
  },

  features: {
    calendarSync: env.FEATURE_CALENDAR_SYNC,
    contactImport: env.FEATURE_CONTACT_IMPORT,
  },
} as const;
