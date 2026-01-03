#!/bin/bash
# LocalStack initialization script
# This runs when LocalStack is ready

echo "Initializing LocalStack resources..."

# Create KMS key
aws --endpoint-url=http://localhost:4566 kms create-key \
  --key-spec SYMMETRIC_DEFAULT \
  --key-usage ENCRYPT_DECRYPT \
  --description "RemoraNotes CMK for envelope encryption" \
  --tags TagKey=Project,TagValue=RemoraNotes \
  --output json > /tmp/kms-key.json

KEY_ID=$(cat /tmp/kms-key.json | grep -o '"KeyId": "[^"]*' | cut -d'"' -f4)

echo "Created KMS key: $KEY_ID"

# Create an alias for easier reference
aws --endpoint-url=http://localhost:4566 kms create-alias \
  --alias-name alias/remoranotes-cmk \
  --target-key-id "$KEY_ID"

echo "Created KMS alias: alias/remoranotes-cmk"

# Verify SES (no setup needed for LocalStack, but we can test)
aws --endpoint-url=http://localhost:4566 ses verify-email-identity \
  --email-address noreply@localhost.test

echo "Verified SES email identity"

# Store a test secret in Secrets Manager
aws --endpoint-url=http://localhost:4566 secretsmanager create-secret \
  --name remoranotes/hash-pepper \
  --secret-string "local-dev-hash-pepper-for-testing-only-32"

echo "Created test secret in Secrets Manager"

echo "LocalStack initialization complete!"
echo ""
echo "KMS Key ARN: arn:aws:kms:us-east-1:000000000000:key/$KEY_ID"
echo "KMS Alias: alias/remoranotes-cmk"
echo ""
echo "Update your .env file with:"
echo "KMS_CMK_ARN=arn:aws:kms:us-east-1:000000000000:key/$KEY_ID"
