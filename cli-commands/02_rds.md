# AWS Infrastructure Deployment Commands

This document contains the CLI steps used to set up the VPC, RDS (PostgreSQL), Lambda, and API Gateway for the React AWS application.

> **Note:** Replace all placeholders like `[VPC_ID]`, `[ACCOUNT_ID]`, and `[PASSWORD]` with your actual environment values before running.

---

## 1. Environment Initialization
```bash
# List profiles and verify identity
aws configure list-profiles

# Verify identity and set profile
aws sts get-caller-identity --profile [YOUR_PROFILE]

# Set environment variable (Linux/macOS)
export AWS_PROFILE=[YOUR_PROFILE]

# Set environment variable (Windows PowerShell)
# $env:AWS_PROFILE = '[YOUR_PROFILE]'
```

## 2. Network Configuration
```bash
# Identify the default VPC
aws ec2 describe-vpcs --filters "Name=isDefault,Values=true" --query 'Vpcs[0].{VpcId:VpcId,CidrBlock:CidrBlock}'

# {
#     "VpcId": "vpc-XXXXXXXXXXXXXXXXX",
#     "CidrBlock": "172.31.0.0/16"
# }

# List existing subnets for reference
aws ec2 describe-subnets --filters "Name=vpc-id,Values=[VPC_ID]" --query 'Subnets[*].{SubnetId:SubnetId,AZ:AvailabilityZone,CIDR:CidrBlock}' --output table

# --------------------------------------------------------------
# |                       DescribeSubnets                      |
# +------------+------------------+----------------------------+
# |     AZ     |      CIDR        |         SubnetId           |
# +------------+------------------+----------------------------+
# |  us-east-1b|  172.31.80.0/20  |  subnet-XXXXXXXXXXXXXXXXX  |
# |  us-east-1c|  172.31.16.0/20  |  subnet-XXXXXXXXXXXXXXXXX  |
# |  us-east-1f|  172.31.64.0/20  |  subnet-XXXXXXXXXXXXXXXXX  |
# |  us-east-1a|  172.31.0.0/20   |  subnet-XXXXXXXXXXXXXXXXX  |
# |  us-east-1e|  172.31.48.0/20  |  subnet-XXXXXXXXXXXXXXXXX  |
# |  us-east-1d|  172.31.32.0/20  |  subnet-XXXXXXXXXXXXXXXXX  |
# +------------+------------------+----------------------------+

# Create new Private Subnets for Database and Lambda
aws ec2 create-subnet --vpc-id [VPC_ID] --cidr-block 172.31.96.0/20 --availability-zone us-east-1a

# "SubnetId": "subnet-XXXXXXXXXXXXXXXXXX"
# MapPublicIpOnLaunch: false //Private

aws ec2 create-subnet --vpc-id [VPC_ID] --cidr-block 172.31.112.0/20 --availability-zone us-east-1b
```

## 3. Security Groups
```bash
# Database SG
aws ec2 create-security-group --group-name "rds-sg" --description "Security group for RDS PostgreSQL" --vpc-id [VPC_ID]

# Lambda SG
aws ec2 create-security-group --group-name "lambda-sg" --description "Security Group for Lambda" --vpc-id [VPC_ID]

# Allow Lambda to talk to RDS (Port 5432)
aws ec2 authorize-security-group-ingress \
    --group-id [RDS_SG_ID] \
    --protocol tcp \
    --port 5432 \
    --source-group [LAMBDA_SG_ID]
```

## 4. Database (RDS PostgreSQL) Setup
```bash
# Subnet Group
aws rds create-db-subnet-group \
    --db-subnet-group-name "rds-subnet-group" \
    --db-subnet-group-description "Subnet group for RDS" \
    --subnet-ids [SUBNET_ID_1] [SUBNET_ID_2]

aws rds describe-db-engine-versions --engine postgres --query 'DBEngineVersions[*].EngineVersion' --output table 

# Create Instance
aws rds create-db-instance \
    --db-instance-identifier "react-aws-app-dev" \
    --db-instance-class db.t3.micro \
    --engine postgres \
    --engine-version 16.13 \
    --master-username postgres \
    --master-user-password "[YOUR_SECURE_PASSWORD]" \
    --db-subnet-group-name rds-subnet-group \
    --vpc-security-group-ids [RDS_SG_ID] \
    --db-name appdb \
    --no-publicly-accessible \
    --storage-type gp2 \
    --allocated-storage 20

# Check status and get Endpoint
aws rds describe-db-instances --db-instance-identifier react-aws-app-dev --query 'DBInstances[0].{Status:DBInstanceStatus,Endpoint:Endpoint.Address}'
```

## 5. Lambda & IAM
```bash
# Create IAM Role for Lambda VPC Access
aws iam create-role --role-name lambda-rds-role --assume-role-policy-document '{"Version":"2012-10-17", "Statement":[{"Effect":"Allow", "Principal":{"Service":"lambda.amazonaws.com"},"Action":"sts:AssumeRole"}]}'

# Attach Execution Policies
aws iam attach-role-policy --role-name lambda-rds-role --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole
aws iam attach-role-policy --role-name lambda-rds-role --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole

# cd "C:\Users\XXXX\react-aws-app\lambdas\db-init-lambda"
# npm init -y
# npm install pg
# zip -r db-init.zip

# Create Function
aws lambda create-function \
    --function-name db-init \
    --runtime nodejs20.x \
    --handler index.handler \
    --role arn:aws:iam::[ACCOUNT_ID]:role/lambda-rds-role \
    --zip-file fileb://db-init.zip  --timeout 30 \
    --vpc-config SubnetIds=[SUBNET_1],[SUBNET_2],SecurityGroupIds=[LAMBDA_SG_ID] \
    --environment "Variables={DB_HOST=[RDS_ENDPOINT],DB_NAME=appdb,DB_USER=postgres,DB_PASSWORD=[PASSWORD]}"

aws lambda invoke --function-name db-init --payload '{}' response.json && cat response.json
aws lambda delete-function --function-name db-init

# Create Function
aws lambda create-function \
    --function-name user-rights \
    --runtime nodejs20.x \
    --handler index.handler \
    --role arn:aws:iam::[ACCOUNT_ID]:role/lambda-rds-role \
    --zip-file fileb://user-rights.zip --timeout 30 \
    --vpc-config SubnetIds=[SUBNET_1],[SUBNET_2],SecurityGroupIds=[LAMBDA_SG_ID] \
    --environment "Variables={DB_HOST=[RDS_ENDPOINT],DB_NAME=appdb,DB_USER=postgres,DB_PASSWORD=[PASSWORD]}"

```
## 6. API Gateway (HTTP API)
```bash
# Create API
aws apigatewayv2 create-api --name "react-aws-app-api" --protocol-type HTTP -cors-configuration AllowOrigins="http://localhost:5173",AllowMethods="GET",AllowHeaders="Authorization,Content-Type"

# Add Cognito Authorizer
aws apigatewayv2 create-authorizer \
    --api-id [API_ID] \
    --name "cognito-authorizer" \
    --authorizer-type JWT \
    --identity-source '$request.header.Authorization' \
    --jwt-configuration Audience=[CLIENT_ID],Issuer=https://cognito-idp.[REGION].amazonaws.com/[POOL_ID]

# Create Integration and Route
aws apigatewayv2 create-integration --api-id [API_ID] --integration-type AWS_PROXY --integration-uri [LAMBDA_ARN] --payload-format-version 2.0
aws apigatewayv2 create-route --api-id [API_ID] --route-key "GET /rights" --authorization-type JWT --authorizer-id [AUTH_ID] --target integrations/[INTEG_ID]
aws apigatewayv2 create-stage --api-id [API_ID] --stage-name [ENVIRONMENT] --auto-deploy

# Grant API Gateway permission to invoke Lambda
aws lambda add-permission \
    --function-name user-rights \
    --statement-id apigateway-invoke \
    --action lambda:InvokeFunction \
    --principal apigateway.amazonaws.com \
    --source-arn "arn:aws:execute-api:[REGION]:[ACCOUNT_ID]:[API_ID]/*/*/rights"

aws cloudformation describe-stacks --stack-name react-aws-app-rds-stack-dev --region us-east-1 --query "Stacks[0].Outputs" --output table
```

# TROUBLESHOOTING
```bash
# Check the events if the stack fails
aws cloudformation describe-stack-events   --stack-name react-aws-app-rds-stack-dev   --region us-east-1   --query "StackEvents[?ResourceStatus=='CREATE_FAILED'].[LogicalResourceId,ResourceStatusReason]"   --output table

aws cloudformation describe-stack-events --stack-name react-aws-app-rds-stack-dev

# Check the stack status
aws cloudformation describe-stacks \
  --stack-name react-aws-app-rds-stack-dev \
  --region us-east-1 \
  --query "Stacks[0].StackStatus"

# If it is ROLLBACK_COMPLETE or CREATE_FAILED
# Delte and redeploy
aws cloudformation delete-stack \
  --stack-name react-aws-app-rds-stack-dev \
  --region us-east-1

aws cloudformation wait stack-delete-complete \
  --stack-name react-aws-app-rds-stack-dev \
  --region us-east-1
```

# CLEANING
```bash
# S3 Bucket
aws s3 rm s3://react-aws-app-lambdas-dev --recursive
aws s3 rb s3://react-aws-app-lambdas-dev
```