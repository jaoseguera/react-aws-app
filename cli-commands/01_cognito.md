# AWS Infrastructure Deployment Commands

This document contains the CLI steps used to set up the Cognito service for the React AWS application.

> **Note:** Replace all placeholders like `[YOUR_ACCESS_KEY]`, `[YOUR_SECRET_KEY]`, and `[USER_POOL_ID]` with your actual environment values before running.

---

## 1. Environment Initialization
```bash
# List profiles and verify identity
aws configure list-profiles

aws configure --profile [YOUR_PROFILE]

    AWS Access Key ID [None]: [YOUR_ACCESS_KEY]
    AWS Secret Access Key [None]: [YOUR_SECRET_KEY]
    Default region name [None]: us-east-1
    Default output format [None]

# Verify identity and set profile
aws sts get-caller-identity --profile [YOUR_PROFILE]

# Set environment variable (Linux/macOS)
export AWS_PROFILE=[YOUR_PROFILE]

# Set environment variable (Windows PowerShell)
# $env:AWS_PROFILE = '[YOUR_PROFILE]'
```

## 2. Create Cognito User Pool
```bash
aws cognito-idp create-user-pool \
    --pool-name "react-aws-app-dev" \
    --username-attributes email \
    --auto-verified-attributes email \
    --policies "PasswordPolicy={MinimumLength=8,RequireUppercase=true,RequireLowercase=true,RequireNumbers=true,RequireSymbols=false}"
```

## 3. Create App Client for the User Pool
```bash
aws cognito-idp create-user-pool-client \
    --user-pool-id [USER_POOL_ID] \
    --client-name "react-aws-app-web" \
    --no-generate-secret \
    --explicit-auth-flows ALLOW_USER_SRP_AUTH ALLOW_REFRESH_TOKEN_AUTH \
    --allowed-o-auth-flows code \
    --allowed-o-auth-scopes email openid phone \
    --allowed-o-auth-flows-user-pool-client \
    --callback-urls "http://localhost:5173" \
    --logout-urls "http://localhost:5173" \
    --supported-identity-providers COGNITO
```

## 4. Infrastructure as Code (CloudFormation)
```bash
# Validate the template before deployment
aws cloudformation validate-template --template-body file://stacks/01_cognito.yml

# Deploy the stack
# Note: Use relative paths for better portability
aws cloudformation deploy \
    --template-file ./stacks/01_cognito.yml \
    --stack-name react-aws-app-dev \
    --parameter-overrides Environment=dev AppName=react-aws-app

# Get Stack Outputs (e.g., UserPoolId, ClientId)
aws cloudformation describe-stacks \
    --stack-name react-aws-app-dev \
    --query 'Stacks[0].Outputs'
```