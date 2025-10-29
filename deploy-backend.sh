#!/bin/bash

# Agents4Energy Backend Deployment Script
# Deploys the backend infrastructure to AWS using Amplify Gen2

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}======================================"
echo "Agents4Energy Backend Deployment"
echo -e "======================================${NC}"
echo ""

# Check if AWS credentials are configured
echo "Checking AWS credentials..."
if ! aws sts get-caller-identity &>/dev/null; then
    echo -e "${RED}✗ AWS credentials not configured${NC}"
    echo ""
    echo "Please configure AWS CLI first:"
    echo "  aws configure"
    exit 1
fi

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text 2>/dev/null)
REGION=$(aws configure get region 2>/dev/null || echo "us-east-1")

echo -e "${GREEN}✓ AWS Account: $ACCOUNT_ID${NC}"
echo -e "${GREEN}✓ Region: $REGION${NC}"
echo ""

# Warning about costs
echo -e "${YELLOW}⚠️  WARNING: Backend Deployment${NC}"
echo "This will deploy the following AWS resources:"
echo "  • VPC with public and private subnets"
echo "  • RDS PostgreSQL databases (2)"
echo "  • Amazon Bedrock Agents (4)"
echo "  • Lambda functions (10+)"
echo "  • S3 buckets with sample data"
echo "  • Cognito User Pool"
echo "  • AppSync GraphQL API"
echo "  • Athena workgroups"
echo ""
echo -e "${RED}Estimated monthly cost: ~$500${NC}"
echo -e "${RED}Initial deployment time: ~45 minutes${NC}"
echo ""

read -p "Do you want to continue? (yes/no): " confirm
if [[ ! "$confirm" =~ ^[Yy][Ee][Ss]$ ]]; then
    echo "Deployment cancelled."
    exit 0
fi

echo ""
echo -e "${BLUE}Starting backend deployment...${NC}"
echo ""

# Deploy using Amplify sandbox
echo "Deploying backend infrastructure with Amplify..."
echo ""
echo -e "${YELLOW}This will take approximately 45 minutes.${NC}"
echo "You can monitor progress in:"
echo "  • This terminal"
echo "  • AWS CloudFormation Console"
echo "  • AWS Amplify Console"
echo ""

# Use npx to run amplify sandbox
npx ampx sandbox

echo ""
echo -e "${GREEN}======================================"
echo "Backend Deployment Complete!"
echo -e "======================================${NC}"
echo ""
echo "Next steps:"
echo "1. Check CloudFormation stacks in AWS Console"
echo "2. Verify Bedrock agents are created"
echo "3. Ensure Knowledge Bases are synced"
echo "4. Test the application"
echo ""
echo "To stop the sandbox (keeps resources but stops sync):"
echo "  Press Ctrl+C in this terminal"
echo ""
echo "To completely delete all resources:"
echo "  npx ampx sandbox delete"
echo ""
