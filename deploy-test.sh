#!/bin/bash

# Agents4Energy - Minimal Test Deployment Script
# This script helps verify prerequisites and guides through deployment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "======================================"
echo "Agents4Energy Deployment Helper"
echo "======================================"
echo ""

# Function to check command existence
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to print status
print_status() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✓${NC} $2"
    else
        echo -e "${RED}✗${NC} $2"
    fi
}

echo "Step 1: Checking Prerequisites..."
echo "-----------------------------------"

# Check Node.js
if command_exists node; then
    NODE_VERSION=$(node --version)
    echo -e "${GREEN}✓${NC} Node.js installed: $NODE_VERSION"
    
    # Check if version is >= 20
    NODE_MAJOR=$(echo $NODE_VERSION | cut -d'.' -f1 | sed 's/v//')
    if [ "$NODE_MAJOR" -lt 20 ]; then
        echo -e "${YELLOW}⚠${NC} Warning: Node.js version should be >= 20.9.0"
        echo "  Current version: $NODE_VERSION"
    fi
else
    echo -e "${RED}✗${NC} Node.js not found"
    echo "  Install from: https://nodejs.org/"
    exit 1
fi

# Check npm
if command_exists npm; then
    NPM_VERSION=$(npm --version)
    echo -e "${GREEN}✓${NC} npm installed: v$NPM_VERSION"
else
    echo -e "${RED}✗${NC} npm not found"
    exit 1
fi

# Check AWS CLI
if command_exists aws; then
    AWS_VERSION=$(aws --version 2>&1)
    echo -e "${GREEN}✓${NC} AWS CLI installed: $AWS_VERSION"
else
    echo -e "${RED}✗${NC} AWS CLI not found"
    echo "  Install from: https://aws.amazon.com/cli/"
    exit 1
fi

echo ""
echo "Step 2: Checking AWS Configuration..."
echo "---------------------------------------"

# Check AWS credentials
if aws sts get-caller-identity >/dev/null 2>&1; then
    AWS_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
    AWS_USER=$(aws sts get-caller-identity --query Arn --output text)
    AWS_REGION=$(aws configure get region)
    
    echo -e "${GREEN}✓${NC} AWS credentials configured"
    echo "  Account ID: $AWS_ACCOUNT"
    echo "  User/Role: $AWS_USER"
    echo "  Region: ${AWS_REGION:-'not set (will use default)'}"
else
    echo -e "${RED}✗${NC} AWS credentials not configured"
    echo "  Run: aws configure"
    exit 1
fi

echo ""
echo "Step 3: Checking Bedrock Model Access..."
echo "------------------------------------------"
echo -e "${YELLOW}⚠${NC} Manual verification required:"
echo "  1. Go to AWS Console → Amazon Bedrock → Model Access"
echo "  2. Ensure these models are enabled:"
echo "     - Anthropic Claude 3 Sonnet"
echo "     - Amazon Titan Embeddings"
echo "  3. Wait for 'Access granted' status"
echo ""

read -p "Have you enabled Bedrock model access? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${RED}Please enable Bedrock models before continuing${NC}"
    echo "Visit: https://console.aws.amazon.com/bedrock/home#/modelaccess"
    exit 1
fi

echo ""
echo "Step 4: Checking Project Dependencies..."
echo "------------------------------------------"

if [ -d "node_modules" ]; then
    echo -e "${GREEN}✓${NC} node_modules directory exists"
else
    echo -e "${YELLOW}⚠${NC} node_modules not found"
    read -p "Install dependencies now? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "Installing dependencies..."
        npm install
        echo -e "${GREEN}✓${NC} Dependencies installed"
    else
        echo "Please run: npm install"
        exit 1
    fi
fi

echo ""
echo "Step 5: Deployment Options"
echo "====================================="
echo ""
echo "Choose your deployment method:"
echo ""
echo "1) AWS Amplify Hosting (Recommended)"
echo "   - Full deployment with hosting"
echo "   - ~45 minutes deployment time"
echo "   - ~\$500/month cost"
echo "   - Best for: Complete testing"
echo ""
echo "2) Local Development + Cloud Backend"
echo "   - Backend in AWS, Frontend local"
echo "   - ~45 minutes initial deployment"
echo "   - Reduced hosting costs"
echo "   - Best for: Development/debugging"
echo ""
echo "3) Check Prerequisites Only"
echo "   - Just verify setup"
echo "   - Deploy manually later"
echo ""

read -p "Enter your choice (1-3): " choice

case $choice in
    1)
        echo ""
        echo "AWS Amplify Hosting Deployment"
        echo "================================"
        echo ""
        echo "Next steps:"
        echo "1. Fork this repository to your GitHub account"
        echo "2. Go to: https://console.aws.amazon.com/amplify/"
        echo "3. Click 'Deploy an app'"
        echo "4. Connect your GitHub repository"
        echo "5. Configure build settings:"
        echo "   - Build Image: aws/codebuild/standard:7.0"
        echo "   - Environment Variable: _BUILD_TIMEOUT = 120"
        echo "6. Click 'Save and deploy'"
        echo ""
        echo "For detailed instructions, see: MINIMAL_DEPLOYMENT_GUIDE.md"
        ;;
    2)
        echo ""
        echo "Local Development + Cloud Backend"
        echo "=================================="
        echo ""
        echo "Starting Amplify sandbox deployment..."
        echo ""
        echo -e "${YELLOW}⚠${NC} This will deploy AWS resources and incur costs!"
        echo -e "${YELLOW}⚠${NC} Estimated time: ~45 minutes"
        echo ""
        read -p "Continue with deployment? (y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            echo ""
            echo "Deploying backend to AWS..."
            npx ampx sandbox
        else
            echo "Deployment cancelled"
            exit 0
        fi
        ;;
    3)
        echo ""
        echo -e "${GREEN}✓${NC} Prerequisites check complete!"
        echo ""
        echo "You're ready to deploy. Choose a deployment method:"
        echo "- See MINIMAL_DEPLOYMENT_GUIDE.md for detailed instructions"
        echo "- Run this script again to deploy"
        ;;
    *)
        echo "Invalid choice. Exiting."
        exit 1
        ;;
esac

echo ""
echo "======================================"
echo "For more information:"
echo "- MINIMAL_DEPLOYMENT_GUIDE.md"
echo "- DEPLOYMENT.md"
echo "- README.md"
echo "======================================"
