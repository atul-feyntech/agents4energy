# Minimal Deployment Guide for Agents4Energy Testing

This guide provides a streamlined approach to deploy Agents4Energy for testing purposes.

## Prerequisites

### 1. AWS Account Requirements
- AWS account with administrative access
- AWS CLI installed and configured
- AWS region that supports Amazon Bedrock (e.g., us-east-1, us-west-2)

### 2. Local Development Environment
```bash
# Check versions
node --version   # Should be v20.9.0 or higher
npm --version    # Should be 9.x or higher
aws --version    # Should be AWS CLI v2
```

### 3. Bedrock Model Access
**CRITICAL**: Before deployment, enable Bedrock models in your AWS account:

1. Go to AWS Console → Amazon Bedrock → Model Access
2. Enable the following models (minimum):
   - Anthropic Claude 3 Sonnet
   - Anthropic Claude models (select all)
   - Amazon Titan Embeddings models
3. Wait for "Access granted" status
4. Test models in the Chat/Text playground

## Quick Start Deployment

### Option 1: AWS Amplify Hosting (Recommended for Testing)

This is the **simplest** approach for testing - Amplify handles everything:

#### Step 1: Fork the Repository
```bash
# Fork this repository to your GitHub account first
# Then clone your fork
git clone https://github.com/YOUR_USERNAME/agents4energy.git
cd agents4energy
```

#### Step 2: Deploy via AWS Amplify Console

1. **Navigate to AWS Amplify Console**
   - Go to: https://console.aws.amazon.com/amplify/home
   - Click "Deploy an app"

2. **Connect GitHub Repository**
   - Select GitHub
   - Authorize AWS Amplify
   - Select your forked repository
   - Choose branch: `main` or your test branch

3. **Configure Build Settings**
   - Amplify will auto-detect Next.js configuration
   - **IMPORTANT**: Update Advanced Settings:
     - Build Image: `aws/codebuild/standard:7.0`
     - Add Environment Variable: `_BUILD_TIMEOUT` = `120`

4. **Configure Service Role**
   - Create new service role or select existing one
   - Ensure it has permissions for:
     - Amplify
     - CloudFormation
     - S3
     - Lambda
     - Bedrock
     - RDS
     - VPC/EC2

5. **Deploy**
   - Click "Save and deploy"
   - **DEPLOYMENT TIME**: ~45 minutes for initial deployment
   - **COST WARNING**: This will create resources costing ~$500/month

#### Step 3: Monitor Deployment
```bash
# Monitor in AWS Console:
# - Amplify Console: Shows build/deploy progress
# - CloudFormation: Shows stack deployment details
# - CloudWatch Logs: Shows detailed logs if errors occur
```

#### Step 4: Access the Application
Once deployed:
1. Copy the domain URL from Amplify Console
2. Open in browser
3. Create account (will send verification code to email)
4. Test agents with sample prompts

### Option 2: Local Development + Cloud Backend (Faster for Testing)

This deploys the backend to AWS but runs the frontend locally:

#### Step 1: Install Dependencies
```bash
cd /Users/atulchavan/Repository/agents4energy
npm install
```

#### Step 2: Deploy Backend Only
```bash
# This uses Amplify Gen2 sandbox
npx ampx sandbox

# This will:
# - Deploy auth, data, storage, functions to AWS
# - Create all agent stacks
# - Generate amplify_outputs.json locally
# - Take ~45 minutes for first deployment
```

#### Step 3: Run Frontend Locally
```bash
# In a separate terminal
npm run dev

# Access at: http://localhost:3000
```

## Minimal Configuration for Testing

If you want to reduce costs for testing, you can temporarily disable agents:

### Create Minimal Backend (Single Agent Only)

Create file: `amplify/backend.minimal.ts`

```typescript
// This is a minimal version with only one agent for testing
import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { storage } from './storage/resource';

const backend = defineBackend({
  auth,
  data,
  storage,
});

// Minimal setup without agents for basic testing
export { backend };
```

To use minimal backend:
```bash
# Temporarily rename files
mv amplify/backend.ts amplify/backend.full.ts
mv amplify/backend.minimal.ts amplify/backend.ts

# Deploy
npx ampx sandbox

# Restore after testing
mv amplify/backend.ts amplify/backend.minimal.ts
mv amplify/backend.full.ts amplify/backend.ts
```

## Troubleshooting

### Common Issues

1. **Bedrock Access Denied**
   - Solution: Enable model access in Bedrock console
   - Verify region supports Bedrock

2. **Build Timeout**
   - Solution: Increase `_BUILD_TIMEOUT` to 120 minutes
   - Use custom build image: `aws/codebuild/standard:7.0`

3. **VPC Creation Fails**
   - Solution: Check VPC limits in your account
   - May need to request limit increase

4. **RDS Connection Timeout**
   - Solution: Check security group rules
   - Verify Lambda functions are in VPC

5. **Knowledge Base Sync Failed**
   - Solution: Manually sync in Bedrock console
   - Check S3 bucket permissions

### Verification Steps

After deployment, verify:

1. **CloudFormation Stacks**
   ```bash
   aws cloudformation list-stacks --stack-status-filter CREATE_COMPLETE
   ```

2. **Bedrock Agents**
   ```bash
   aws bedrock-agent list-agents
   ```

3. **S3 Buckets**
   ```bash
   aws s3 ls | grep amplify
   ```

4. **Lambda Functions**
   ```bash
   aws lambda list-functions | grep agents
   ```

## Testing the Deployment

### Test Production Agent
```
Search the well files for the well with API number 30-045-29202 to make a table with type of operation (drilling, completion, workover, plugging, other), text from the report describing operational details, and document title.
```

### Test Maintenance Agent
```
How many biodiesel tanks are located in the biodiesel unit?
```

### Test Regulatory Agent
```
What are the EPA requirements for offshore decommissioning?
```

## Cost Management

**IMPORTANT**: To avoid ongoing costs:

### Stop Development
```bash
# Stop sandbox (keeps resources but stops charging for active compute)
npx ampx sandbox delete
```

### Complete Cleanup
```bash
# Delete all resources
aws cloudformation delete-stack --stack-name <root-stack-name>

# Or use Amplify Console:
# 1. Go to Amplify Console
# 2. Select your app
# 3. Actions → Delete app
# 4. Confirm deletion
```

### Monitor Costs
- Set up AWS Budgets alert for $100/month
- Monitor CloudWatch dashboards
- Check Cost Explorer daily during testing

## Estimated Costs

| Component | Monthly Cost (approx) |
|-----------|----------------------|
| RDS PostgreSQL | $150-200 |
| Bedrock API calls | $100-150 |
| Lambda Functions | $50-100 |
| S3 Storage | $20-30 |
| VPC & Networking | $30-50 |
| Amplify Hosting | $50-70 |
| **TOTAL** | **~$500/month** |

For minimal testing (1-2 days):
- Stop services when not in use
- Expected cost: $20-50 for short test

## Next Steps

1. Review deployed resources in AWS Console
2. Test each agent with sample prompts
3. Check CloudWatch logs for errors
4. Explore S3 buckets with sample data
5. Query RDS databases using RDS Query Editor
6. Monitor costs in Cost Explorer

## Support Resources

- [AWS Amplify Gen2 Docs](https://docs.amplify.aws/gen2/)
- [Amazon Bedrock Docs](https://docs.aws.amazon.com/bedrock/)
- [Project README](./README.md)
- [Full Deployment Guide](./DEPLOYMENT.md)
