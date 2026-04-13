#!/bin/bash
set -e

ENV=${1:-dev}
REGION="us-east-1"
AWS_PROFILE=${2:-personal}
# CODE_VERSION=$(date +%s)
CODE_VERSION="v1.0.0"
APP_NAME="react-aws-app"
BUCKET="$APP_NAME-lambdas-$ENV"
STACK_NAME="$APP_NAME-rds-stack-$ENV"

VPC_ID=$(aws ec2 describe-vpcs \
  --filters "Name=isDefault,Values=true" \
  --query "Vpcs[0].VpcId" \
  --output text --region $REGION)

if [ "$VPC_ID" == "None" ] || [ -z "$VPC_ID" ]; then
  echo "Error: Default VPC not found!"
  exit 1
fi

echo "Deploying stack: $STACK_NAME to region: $REGION with profile: $PROFILE"
echo "Code version: $CODE_VERSION"
echo "Using VPC: $VPC_ID"

# ─── CREATE THE S3 BUCKET IF NOT EXISTING ─────────────────────────────────────
aws s3 mb s3://$BUCKET --region $REGION 2>/dev/null

# ─── UPLOAD CODE ──────────────────────────────────────────────────────────────
echo "Uploading code..."
aws s3 cp ../lambdas/db-init-lambda.zip s3://$BUCKET/db-init-$CODE_VERSION.zip --region $REGION
aws s3 cp ../lambdas/user-rights-lambda.zip s3://$BUCKET/user-rights-$CODE_VERSION.zip --region $REGION
echo "Code uploaded to S3 bucket: $BUCKET"

# ─── COGNITO INFORMATION ──────────────────────────────────────────────────────────────
echo "Getting Cognito information..."
COGNITO_USERPOOLID=$(aws cognito-idp list-user-pools --max-results 1 \
  --region $REGION \
  --query "UserPools[?contains(Name, 'react')].Id" \
  --output text)
COGNITO_CLIENTID=$(aws cognito-idp list-user-pool-clients \
  --user-pool-id $COGNITO_USERPOOLID \
  --region $REGION \
  --query "UserPoolClients[0].ClientId" \
  --output text)

# ─── CLOUDFORMATION DEPLOYMENT ────────────────────────────────────────────────
echo "Deploying CloudFormation stack..."
aws cloudformation deploy \
  --stack-name $STACK_NAME \
  --template-file ../stacks/02_rds.yml \
  --parameter-overrides Environment=$ENV VpcId=$VPC_ID AppName=$APP_NAME CodeVersion=$CODE_VERSION Bucket=$BUCKET \
  CognitoUserPoolId=$COGNITO_USERPOOLID CognitoClientId=$COGNITO_CLIENTID\
  --capabilities CAPABILITY_NAMED_IAM \
  --region $REGION

aws lambda invoke --function-name $APP_NAME-db-init-$ENV --payload '{}' response.json

aws cloudformation describe-stacks \
  --stack-name $STACK_NAME \
  --region $REGION \
  --query "Stacks[0].Outputs" \
  --output table

  aws cloudformation deploy \
  --stack-name $STACK_NAME \
  --template-file ../stacks/02_rds.yml \
  --parameter-overrides Environment=$ENV VpcId=$VPC_ID AppName=$APP_NAME CodeVersion=$CODE_VERSION Bucket=$BUCKET \
  CognitoUserPoolId=$COGNITO_USERPOOLID CognitoClientId=$COGNITO_CLIENTID\
  --capabilities CAPABILITY_NAMED_IAM \
  --region $REGION