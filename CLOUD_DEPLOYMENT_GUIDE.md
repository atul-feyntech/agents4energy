# Agents4Energy – Full Cloud Deployment Guide

> **Goal:** Provision the complete Agents4Energy stack (backend + frontend) in AWS from a clean workstation.
>
> The steps below assume you manage the infrastructure in your own AWS account and deploy the web app through AWS Amplify Hosting.

---

## 1. Prerequisites

| Requirement | Details |
| --- | --- |
| AWS Account | IAM user or role with Administrator access. |
| CLI Tooling | Node.js ≥ 20.9.0, npm, AWS CLI v2, git, Docker Desktop (for local image builds). |
| Network | Ability to reach public.ecr.aws (required for Lambda build images).
| Repository | GitHub fork or private clone of `atul-feyntech/agents4energy`.
| Costs | End-to-end deployment runs **~USD 500/month**; provision and teardown responsibly.

### 1.1 One-Time AWS Setup

1. **Configure AWS CLI credentials**
   ```bash
   aws configure
   ```
   Supply access key, secret key, and default region (recommended: `ap-south-1` to match Amplify configuration).

2. **Request Amazon Bedrock access**
   - Open the [Bedrock console](https://console.aws.amazon.com/bedrock/home#/modelaccess).
   - Enable the following models:
     - `anthropic.claude-3-sonnet-20240229-v1:0`
     - `anthropic.claude-3-haiku-20240307-v1:0`
     - `amazon.titan-embed-text-v2`
   - Submit the "Anthropic model use case" form. Approval typically takes 15–60 minutes.

3. **Check service quotas** (VPCs, NAT Gateways, RDS instances). Increase limits if your account is near default caps.

4. **Create a Budget alert** *(optional but recommended)*
   ```bash
   aws budgets create-budget \
     --account-id <ACCOUNT_ID> \
     --budget 'Name=Agents4EnergySandbox,TimeUnit=MONTHLY,BudgetType=COST,Limit={Amount=100,Unit=USD}'
   ```

---

## 2. Workstation Preparation

```bash
# clone and install dependencies
git clone https://github.com/<your-org>/agents4energy.git
cd agents4energy
npm install

# authenticate Docker to AWS public ECR (avoids 403 during Lambda builds)
npm run ecrAuth
```

> **Tip:** If you previously committed AWS keys, scrub the repository before pushing (`git filter-repo --strip-blobs-with-ids`).

### 2.1 Configure environment variables (frontend + tests)

1. Deploying the backend (next section) generates `amplify_outputs.json`.
2. Convert it into a single-line JSON for frontend builds:
   ```bash
   node -p "JSON.stringify(require('./amplify_outputs.json'))" > /tmp/amplify_outputs.min.json
   ```
3. Store that value in environments:
   - Local dev: create `.env.local` with
     ```bash
     NEXT_PUBLIC_AMPLIFY_OUTPUTS_JSON=$(cat /tmp/amplify_outputs.min.json)
     ```
   - Amplify Hosting: add the same key under *App settings → Environment variables*.

---

## 3. Backend Deployment (Amplify Gen 2 Sandbox)

1. **Choose an identifier** for your sandbox (e.g. your username).
2. **Deploy once** (blocks until CloudFormation finishes):
   ```bash
   npx ampx sandbox --identifier <identifier> --once
   ```
3. **If Docker fails with 403 Forbidden:** rerun ECR auth and retry the command.
4. **Watch progress**
   - Terminal logs show CDK synthesis and stack events.
   - CloudFormation console: check stack `amplify-agentsforenergy-<identifier>-sandbox-<hash>`.
5. **On success** you’ll see outputs including AppSync URL, API key, Cognito IDs, and Bedrock agent IDs. `amplify_outputs.json` is regenerated at the project root.

> **Redeploying changes:** Repeat the command above (or run `npx ampx sandbox` to keep a watch process open).

### 3.1 Common Backend Issues

| Symptom | Fix |
| --- | --- |
| `Multiple sandbox instances detected` | Stop other `ampx sandbox` processes (Ctrl+C) before redeploying. |
| `Authentication token is invalid` (Docker) | Run `npm run ecrAuth`. |
| `bedrock:InvokeModelWithResponseStream AccessDenied` | Ensure latest deployment includes IAM helper updates granting Bedrock permissions. |
| `Model use case details have not been submitted` | Wait for Anthropic access approval. |

---

## 4. Frontend Deployment (Amplify Hosting)

1. Push your repo to GitHub (public or private).
2. In the [Amplify console](https://console.aws.amazon.com/amplify/home), choose **Deploy without Git** or **Connect app** → select repository and branch.
3. **Build settings**
   - Runtime image: `aws/codebuild/standard:7.0`
   - Build command: `npm ci && npm run build`
   - Set environment variables:
     - `NEXT_PUBLIC_AMPLIFY_OUTPUTS_JSON=<single-line JSON from amplify_outputs.json>`
   - Increase build timeout if needed: `_BUILD_TIMEOUT=120`.
4. Start the deploy. First build pulls `amplify_outputs.json` from the repo at build time.
5. After the build completes, Amplify serves the app at the provided domain (e.g. `https://main.<id>.amplifyapp.com`).

> **Local fallback:** You can keep running `npm run dev` for debugging; it uses `.env.local`.

---

## 5. Post-Deployment Tasks

1. **Pre-sign-up email domain allowlist**
   - Lambda `preSignUp` restricts user pool signups to specific suffixes (e.g. `.com`, `@amazon.com`, `@feyntech.in`).
   - Update `ALLOWED_EMAIL_SUFFIXES` in the Lambda configuration if you need additional domains, then redeploy or update via console.

2. **Create test users**
   - Visit `/login` on the deployed site.
   - Use **Create account**, go through email verification, then sign in.

3. **Validate agents**
   ```bash
   aws bedrock-agent list-agents --region ap-south-1
   ```
   Confirm IDs match the values in `amplify_outputs.json`.

4. **Run smoke tests**
   - From the UI, start conversations with Maintenance, Production, Regulatory, and Petrophysics agents.
   - Check CloudWatch logs if responses fail.

5. **Monitor logs**
   - CloudWatch Logs groups: `/aws/lambda/amplify-agentsforenergy-…`
   - Amplify Hosting build logs: console → App → Deployments.

---

## 6. Monitoring & Cost Management

| Task | Command / Console |
| --- | --- |
| Tail Lambda logs | `aws logs tail /aws/lambda/<function> --follow`
| Check RDS status | `aws rds describe-db-instances`
| Track CloudFormation | `aws cloudformation describe-stack-events --stack-name amplify-agentsforenergy-...`
| Remove sandbox | `npx ampx sandbox delete`
| Manual cleanup | Delete CloudFormation stack + Amplify app + S3 buckets.

**Cost tips**
- Stop sandbox watch processes when idle (resources remain but no incremental builds occur).
- Delete the stack when finished to avoid recurring RDS/NAT costs.
- Use AWS Budgets and Cost Explorer for daily tracking.

---

## 7. Troubleshooting Reference

| Issue | Resolution |
| --- | --- |
| `Invalid email domain` during signup | Update `preSignUp` Lambda env var `ALLOWED_EMAIL_SUFFIXES`. Redeploy. |
| Bedrock access denied | Ensure IAM role grants `bedrock:InvokeModel*` and `aws-marketplace:ViewSubscriptions`. Redeploy. |
| Marketplace subscription error | Submit/confirm Anthropic subscription and wait 15–30 minutes. |
| AppSync API key leakage risk | Treat `awsAppsyncApiKey` as secret; never commit `amplify_outputs.json`. |
| Next.js runtime error `fs.existsSync is not a function` | Use environment variable path (`NEXT_PUBLIC_AMPLIFY_OUTPUTS_JSON`) rather than filesystem access in the client bundle. |

---

## 8. Command Quick Reference

```bash
# Authenticate Docker (once per session)
npm run ecrAuth

# Deploy backend once (no watcher)
npx ampx sandbox --identifier <identifier> --once

# Delete sandbox resources when done
npx ampx sandbox delete --identifier <identifier>

# Generate minified Amplify outputs for env vars
node -p "JSON.stringify(require('./amplify_outputs.json'))"
```

---

## 9. Next Steps

- Integrate monitoring (CloudWatch dashboards, alarms).
- Automate teardown for demo environments.
- Add CI/CD pipeline (GitHub Actions) to run lint/tests before Amplify builds.
- Update this guide as infrastructure evolves (new models, additional regions, etc.).

Happy deploying! 🎉
