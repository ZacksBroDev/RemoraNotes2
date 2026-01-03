import { KMSClient, GenerateDataKeyCommand, DecryptCommand } from '@aws-sdk/client-kms';
import { SESClient } from '@aws-sdk/client-ses';
import { SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import { config } from './index.js';

// AWS client configuration
const awsConfig = {
  region: config.aws.region,
  ...(config.aws.accessKeyId && {
    credentials: {
      accessKeyId: config.aws.accessKeyId,
      secretAccessKey: config.aws.secretAccessKey!,
    },
  }),
  ...(config.aws.endpointUrl && {
    endpoint: config.aws.endpointUrl,
  }),
};

// KMS Client
export const kmsClient = new KMSClient(awsConfig);

// SES Client
export const sesClient = new SESClient(awsConfig);

// Secrets Manager Client
export const secretsManagerClient = new SecretsManagerClient(awsConfig);

// Generate a new Data Encryption Key
export async function generateDataKey(): Promise<{
  plaintext: Buffer;
  encrypted: Buffer;
}> {
  const command = new GenerateDataKeyCommand({
    KeyId: config.kms.cmkArn,
    KeySpec: 'AES_256',
  });

  const response = await kmsClient.send(command);

  return {
    plaintext: Buffer.from(response.Plaintext!),
    encrypted: Buffer.from(response.CiphertextBlob!),
  };
}

// Decrypt an encrypted Data Encryption Key
export async function decryptDataKey(encryptedDEK: Buffer): Promise<Buffer> {
  const command = new DecryptCommand({
    KeyId: config.kms.cmkArn,
    CiphertextBlob: encryptedDEK,
  });

  const response = await kmsClient.send(command);
  return Buffer.from(response.Plaintext!);
}
