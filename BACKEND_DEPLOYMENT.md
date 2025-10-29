# Backend Deployment Instructions

Since your frontend is already deployed, here's how to deploy the backend infrastructure.

## Quick Deploy (Recommended)

### Option 1: Using the Deployment Script

```bash
# Make script executable
chmod +x deploy-backend.sh

# Run deployment
./deploy-backend.sh
```

### Option 2: Direct Command

```bash
# Deploy backend to AWS using Amplify sandbox
npx ampx sandbox
```

This command will:
- Deploy all backend resources to AWS
- Create a local `amplify_outputs.json` file
- Watch for changes and auto-deploy
- Take approximately **45 minutes** for initial deployment

## What Gets Deployed

### Core Infrastructure
- ✅ **VPC** with public/private subnets across 3 AZs
- ✅ **Cognito User Pool** for authentication
- ✅ **AppSync GraphQL API** for data access
- ✅ **S3 Buckets** for file storage

### AI Agents (Bedrock)
- ✅ **Production Agent** - Oil & gas production analysis
- ✅ **Maintenance Agent** - CMMS and maintenance tracking
- ✅ **Regulatory Agent** - Compliance and regulations
- ✅ **Petrophysics Agent** - Geological analysis

### Databases
- ✅ **RDS PostgreSQL** for production data
- ✅ **RDS PostgreSQL** for maintenance data
- ✅ **Athena** workgroups for queries

### Lambda Functions
- ✅ Bedrock agent invocation
- ✅ PDF processing
- ✅ Structured output generation
- ✅ Database configuration
- ✅ Multiple agent toolbox functions

### Knowledge Bases
- ✅ SQL table definitions
- ✅ Petroleum engineering documents
- ✅ Maintenance manuals
- ✅ Regulatory documents

## Prerequisites Checklist

Before deploying, ensure:

- [ ] AWS CLI configured with credentials
- [ ] Node.js 20.9.0+ installed
- [ ] npm dependencies installed (`npm install`)
- [ ] Bedrock model access enabled (Anthropic Claude, Titan Embeddings)
- [ ] AWS account has sufficient service limits (VPCs, RDS, etc.)

## Deployment Steps

### 1. Configure AWS Credentials

If not already done:
```bash
aws configure
# Enter:
# - AWS Access Key ID
# - AWS Secret Access Key  
# - Default region (e.g., us-east-1)
# - Default output format (json)
```

### 2. Verify Prerequisites

```bash
# Check AWS connection
aws sts get-caller-identity

# Check Node version
node --version  # Should be v20.9.0+

# Check if dependencies are installed
ls node_modules | head
```

### 3. Start Backend Deployment

```bash
npx ampx sandbox
```

The deployment will:
1. **Provision Phase** (~20 min)
   - Create VPC and networking
   - Set up security groups
   - Create IAM roles

2. **Database Phase** (~15 min)
   - Create RDS instances
   - Configure databases
   - Load sample data

3. **Agent Phase** (~10 min)
   - Deploy Bedrock agents
   - Create knowledge bases
   - Configure agent tools

4. **Finalization** (~5 min)
   - Deploy Lambda functions
   - Configure AppSync
   - Upload sample data to S3

### 4. Monitor Deployment

**In Terminal:**
Watch the deployment logs in your terminal

**In AWS Console:**

CloudFormation:
```
https://console.aws.amazon.com/cloudformation/
```

Amplify:
```
https://console.aws.amazon.com/amplify/
```

Bedrock Agents:
```
https://console.aws.amazon.com/bedrock/home#/agents
```

## Troubleshooting

### Common Issues

**1. Build Timeout**
```bash
# If deployment times out, it will automatically retry
# You can also increase timeout in amplify.yml
```

**2. VPC Limit Exceeded**
```bash
# Request VPC limit increase in AWS Service Quotas
aws service-quotas request-service-quota-increase \
  --service-code vpc \
  --quota-code L-F678F1CE \
  --desired-value 10
```

**3. RDS Creation Slow**
```bash
# RDS creation can take 10-15 minutes
# Check status in RDS console
aws rds describe-db-instances --query 'DBInstances[*].[DBInstanceIdentifier,DBInstanceStatus]'
```

**4. Bedrock Model Access**
```bash
# Verify model access
aws bedrock list-foundation-models --region us-east-1 --query 'modelSummaries[?contains(modelId, `claude`)].modelId'
```

**5. Knowledge Base Sync Failed**
```bash
# Manually trigger sync in Bedrock console
# Or via CLI:
aws bedrock-agent start-ingestion-job \
  --knowledge-base-id <kb-id> \
  --data-source-id <ds-id>
```

## Verify Deployment

### Check CloudFormation Stacks
```bash
aws cloudformation list-stacks \
  --stack-status-filter CREATE_COMPLETE UPDATE_COMPLETE \
  --query 'StackSummaries[?contains(StackName, `amplify`)].StackName'
```

### List Deployed Agents
```bash
aws bedrock-agent list-agents \
  --region us-east-1 \
  --query 'agentSummaries[*].[agentName,agentId,agentStatus]'
```

### Check RDS Databases
```bash
aws rds describe-db-instances \
  --query 'DBInstances[*].[DBInstanceIdentifier,DBInstanceStatus,Endpoint.Address]'
```

### Verify Lambda Functions
```bash
aws lambda list-functions \
  --query 'Functions[?contains(FunctionName, `amplify`)].FunctionName'
```

### Test AppSync API
```bash
# Get API details
aws appsync list-graphql-apis \
  --query 'graphqlApis[*].[name,apiId,uris.GRAPHQL]'
```

## Post-Deployment Steps

### 1. Sync Knowledge Bases

Go to Bedrock Console → Knowledge Bases → Select each KB → Sync

### 2. Initialize Databases

Run the database initialization Lambda function:
```bash
# Find the function name
aws lambda list-functions --query 'Functions[?contains(FunctionName, `PrepDb`)].FunctionName'

# Invoke it
aws lambda invoke \
  --function-name <function-name> \
  --payload '{}' \
  response.json
```

### 3. Test Agent Connectivity

Use the test integration in your test folder:
```bash
# Run integration tests (if available)
npm run test:integration
```

### 4. Connect Frontend to Backend

Your frontend needs the `amplify_outputs.json` file that was generated.

If frontend is deployed via Amplify Hosting, it will automatically have access.

If frontend is separate:
```bash
# Copy amplify_outputs.json to your frontend
cp amplify_outputs.json /path/to/frontend/
```

## Sandbox Commands

### Keep Running (File Watch Mode)
```bash
npx ampx sandbox
# This keeps running and auto-deploys changes
```

### Deploy Once and Exit
```bash
npx ampx sandbox --once
```

### Delete All Resources
```bash
npx ampx sandbox delete
```

### View Logs
```bash
# CloudWatch logs for a specific function
aws logs tail /aws/lambda/<function-name> --follow
```

## Cost Management

### Current Deployment Costs

Approximately $500/month:
- RDS PostgreSQL: ~$200
- Bedrock API calls: ~$100
- Lambda executions: ~$50
- VPC (NAT Gateway): ~$40
- S3 storage: ~$30
- Other services: ~$80

### Reduce Costs for Testing

1. **Stop sandbox when not testing**
   ```bash
   # Press Ctrl+C to stop file watching
   # Resources remain but stop incurring compute costs
   ```

2. **Delete unused agents**
   - Temporarily comment out agents in `amplify/backend.ts`
   - Redeploy with `npx ampx sandbox`

3. **Use on-demand RDS**
   - Already configured in the codebase

4. **Delete everything after testing**
   ```bash
   npx ampx sandbox delete
   ```

## Next Steps

After successful deployment:

1. ✅ Test agents via the frontend application
2. ✅ Check CloudWatch logs for any errors
3. ✅ Monitor costs in AWS Cost Explorer
4. ✅ Review deployed resources in AWS Console
5. ✅ Run integration tests
6. ✅ Add your own data to S3 buckets

## Support

If you encounter issues:

1. Check CloudWatch Logs for detailed error messages
2. Review CloudFormation events for stack failures
3. Ensure all Bedrock models are enabled
4. Verify service limits in AWS Service Quotas
5. Check the main DEPLOYMENT.md for detailed troubleshooting

## Cleanup

When done testing:

```bash
# Delete all backend resources
npx ampx sandbox delete

# Verify deletion in CloudFormation console
aws cloudformation list-stacks --stack-status-filter DELETE_COMPLETE
```

---

**Ready to deploy?** Run: `./deploy-backend.sh` or `npx ampx sandbox`
