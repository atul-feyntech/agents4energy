# Agents4Energy - Quick Start for Testing

## TL;DR - Fastest Path to Testing

### Prerequisites (5 minutes)
```bash
# 1. Verify tools
node --version  # Need v20.9.0+
aws --version   # Need AWS CLI v2

# 2. Configure AWS
aws configure
# Enter: Access Key, Secret Key, Region (us-east-1 recommended)

# 3. Enable Bedrock Models
# Go to: https://console.aws.amazon.com/bedrock/home#/modelaccess
# Enable: All Anthropic Claude models + Amazon Titan Embeddings
```

### Option A: Amplify Hosting (Simplest - Recommended)

**Time**: 45 minutes | **Cost**: ~$500/month

```bash
# 1. Run helper script
./deploy-test.sh

# 2. Follow prompts to check prerequisites

# 3. Choose Option 1 for Amplify Hosting

# 4. Deploy via AWS Console:
# - Go to: https://console.aws.amazon.com/amplify/
# - Deploy from GitHub
# - Wait ~45 minutes
# - Access via provided domain URL
```

### Option B: Local Development (For Testing/Debugging)

**Time**: 45 min + local dev | **Cost**: Reduced (no hosting fees)

```bash
# 1. Install dependencies
npm install

# 2. Deploy backend to AWS
npx ampx sandbox
# Takes ~45 minutes first time

# 3. Run frontend locally
npm run dev
# Access: http://localhost:3000
```

### Option C: Manual AWS Amplify Setup

1. **Fork** this repo to your GitHub
2. **AWS Amplify Console**: https://console.aws.amazon.com/amplify/
3. **Deploy an app** → Connect GitHub
4. **Advanced Settings**:
   - Build Image: `aws/codebuild/standard:7.0`
   - Env Variable: `_BUILD_TIMEOUT=120`
5. **Save and deploy** (wait 45 min)

## Test the Deployment

Once deployed, try these prompts:

### Production Agent
```
Search the well files for the well with API number 30-045-29202
```

### Maintenance Agent
```
How many biodiesel tanks are in the biodiesel unit?
```

## Common Issues & Quick Fixes

| Issue | Quick Fix |
|-------|-----------|
| Bedrock access denied | Enable models in Bedrock console |
| Build timeout | Set `_BUILD_TIMEOUT=120` in Amplify |
| VPC limit exceeded | Request limit increase in AWS Console |
| Lambda timeout | Check CloudWatch logs, increase timeout |
| Knowledge base not synced | Manually sync in Bedrock console |

## Cost Management

### During Testing (Keep Costs Low)
```bash
# Stop sandbox when not testing
npx ampx sandbox delete

# Or delete via Amplify Console
# This stops charges for compute resources
```

### After Testing (Complete Cleanup)
```bash
# Get stack name
aws cloudformation list-stacks --query 'StackSummaries[?contains(StackName, `amplify`)].StackName' --output table

# Delete everything
aws cloudformation delete-stack --stack-name <stack-name>

# Or use Amplify Console → Delete app
```

### Set Cost Alert
```bash
# Create budget alert for $100
aws budgets create-budget \
  --account-id YOUR_ACCOUNT_ID \
  --budget file://budget-config.json
```

## Architecture Overview

```
┌─────────────────────────────────────────────┐
│           Next.js Frontend                   │
│       (Amplify Hosting / Local)              │
└──────────────┬──────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────┐
│         AWS AppSync (GraphQL API)            │
└──────────────┬──────────────────────────────┘
               │
      ┌────────┴────────┐
      ▼                 ▼
┌──────────┐    ┌──────────────────┐
│ Cognito  │    │  Bedrock Agents  │
│  Auth    │    │  - Production    │
└──────────┘    │  - Maintenance   │
                │  - Regulatory    │
                │  - Petrophysics  │
                └────────┬─────────┘
                         │
              ┌──────────┴──────────┐
              ▼                     ▼
        ┌──────────┐         ┌───────────┐
        │    S3    │         │    RDS    │
        │ Storage  │         │ PostgreSQL│
        └──────────┘         └───────────┘
```

## Resource Locations After Deployment

| Resource | Where to Find |
|----------|---------------|
| Application URL | Amplify Console → Domain |
| API Endpoint | AppSync Console |
| Agent IDs | Bedrock Console → Agents |
| Database | RDS Console (check Secrets Manager for credentials) |
| Sample Data | S3 Console (bucket with "file" in name) |
| Logs | CloudWatch Logs |
| Costs | Cost Explorer |

## Monitoring Commands

```bash
# Check deployment status
aws cloudformation describe-stacks --stack-name <stack-name>

# List agents
aws bedrock-agent list-agents --region us-east-1

# View recent logs
aws logs tail /aws/lambda/<function-name> --follow

# Check costs (today)
aws ce get-cost-and-usage \
  --time-period Start=$(date -v-1d +%Y-%m-%d),End=$(date +%Y-%m-%d) \
  --granularity DAILY \
  --metrics BlendedCost
```

## Next Steps

1. ✅ **Deploy** using one of the methods above
2. 🧪 **Test** agents with sample prompts
3. 📊 **Monitor** CloudWatch logs and costs
4. 🗑️ **Cleanup** when done testing

## Get Help

- **Detailed Guide**: [MINIMAL_DEPLOYMENT_GUIDE.md](./MINIMAL_DEPLOYMENT_GUIDE.md)
- **Full Deployment**: [DEPLOYMENT.md](./DEPLOYMENT.md)
- **Project Info**: [README.md](./README.md)
- **Helper Script**: `./deploy-test.sh`

---

**⚠️ IMPORTANT**: Remember to delete resources after testing to avoid ongoing costs!

```bash
# Quick cleanup
aws amplify delete-app --app-id <app-id>
# Or via Amplify Console → Delete app
```
