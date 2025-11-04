






Here’s a first-principles walkthrough of everything we set up, tied directly to the repo and the deployment flow captured in @CLOUD_DEPLOYMENT_GUIDE.md.

---

## 1. Understand the system from scratch

### What the app is
- **Frontend:** a Next.js 14 app that lives in [src/](cci:7://file:///Users/atulchavan/Repository/agents4energy/src:0:0-0:0). It renders dashboards, chat, and login pages, and talks to AWS services via Amplify.  
- **Backend:** defined programmatically in [amplify/backend.ts](cci:7://file:///Users/atulchavan/Repository/agents4energy/amplify/backend.ts:0:0-0:0) using Amplify “Gen 2.” It provisions:
  - Cognito for authentication
  - AppSync GraphQL API
  - Multiple Lambda functions for agents, data prep, and tooling
  - S3 buckets for knowledge files
  - RDS PostgreSQL + Athena for data
  - Amazon Bedrock agents and knowledge bases

### How the repo is organized
- `src/components/ConfigureAmplify.tsx` reads the deployment outputs and calls `Amplify.configure`.
- [src/amplifyOutputs.ts](cci:7://file:///Users/atulchavan/Repository/agents4energy/src/amplifyOutputs.ts:0:0-0:0) loads those outputs from an environment variable (`NEXT_PUBLIC_AMPLIFY_OUTPUTS_JSON`).
- `amplify/functions/**` contains Lambda source code (TypeScript/Node).
- [amplify/functions/utils/cdkUtils.ts](cci:7://file:///Users/atulchavan/Repository/agents4energy/amplify/functions/utils/cdkUtils.ts:0:0-0:0) holds shared IAM policies for agent Lambdas.
- Scripts like [deploy-backend.sh](cci:7://file:///Users/atulchavan/Repository/agents4energy/deploy-backend.sh:0:0-0:0) and [deploy-test.sh](cci:7://file:///Users/atulchavan/Repository/agents4energy/deploy-test.sh:0:0-0:0) automate checks or deployment sequences.
- Docs ([MINIMAL_DEPLOYMENT_GUIDE.md](cci:7://file:///Users/atulchavan/Repository/agents4energy/MINIMAL_DEPLOYMENT_GUIDE.md:0:0-0:0), [BACKEND_DEPLOYMENT.md](cci:7://file:///Users/atulchavan/Repository/agents4energy/BACKEND_DEPLOYMENT.md:0:0-0:0), [CLOUD_DEPLOYMENT_GUIDE.md](cci:7://file:///Users/atulchavan/Repository/agents4energy/CLOUD_DEPLOYMENT_GUIDE.md:0:0-0:0)) record everything we learned.

---

## 2. What we did, step by step, and why

### 2.1 Prep the AWS account (Guide §1)
1. **Set up credentials** so CLI commands work (`aws configure`).
2. **Request Bedrock access** to the specific Anthropic models; without this, Lambdas can’t call Claude.
3. **Check limits** for VPC, RDS, etc., because the stack builds dozens of resources.
4. **Optionally create a cost budget** warning (we suggested `aws budgets create-budget`).

*Why?* We need permissions, model access, and resource headroom to avoid failures halfway through deployment.

### 2.2 Prepare the workstation (Guide §2)
1. `git clone` the repo; run `npm install`.
2. Authenticate Docker to AWS public ECR via `npm run ecrAuth` to prevent 403 errors when Lambdas package Python/Node dependencies.
3. After deployment we convert [amplify_outputs.json](cci:7://file:///Users/atulchavan/Repository/agents4energy/amplify_outputs.json:0:0-0:0) into a single-line string and store it in `.env.local` or Amplify Hosting env vars.

*Why?* Local builds use Docker to bundle Lambda layers, and the frontend reads backend details from the env so it knows where to call.

### 2.3 Deploy the backend with Amplify sandbox (Guide §3)
1. Pick a sandbox identifier (e.g., your name).
2. Run `npx ampx sandbox --identifier <id> --once`. Amplify synthesizes the CDK stacks and drives CloudFormation in your account.
3. Watch the terminal and CloudFormation console; this takes ~45 minutes.
4. On success, Amplify writes a fresh [amplify_outputs.json](cci:7://file:///Users/atulchavan/Repository/agents4energy/amplify_outputs.json:0:0-0:0) containing AppSync URL, Cognito IDs, Bedrock agent IDs, etc.
5. Redeploy later by re-running the sandbox command (or using watch mode).

*Why?* Amplify Gen 2 lets us define the backend as code and provision it automatically. The outputs file contains the secrets/config the frontend needs.

### 2.4 Deploy the frontend with Amplify Hosting (Guide §4)
1. Push the repo to GitHub.
2. In Amplify console: connect the repo/branch.
3. Set build image (`aws/codebuild/standard:7.0`), run `npm ci && npm run build`, and add `NEXT_PUBLIC_AMPLIFY_OUTPUTS_JSON`.
4. Start the build. Amplify handles the containerization in AWS, so Docker isn’t required locally.
5. Amplify provides a hosted URL once the build succeeds.

*Why?* Amplify Hosting gives managed CI/CD and hosting for the Next.js app without manual server setup.

### 2.5 Post-deploy tasks (Guide §5)
1. **Adjust signup rules** if needed by editing the `preSignUp` Lambda env var list (`ALLOWED_EMAIL_SUFFIXES`).
2. Create test user accounts via [/login](cci:7://file:///Users/atulchavan/Repository/agents4energy/src/app/login:0:0-0:0), complete verification, then sign in.
3. List Bedrock agents (`aws bedrock-agent list-agents`) to confirm they’re `PREPARED`.
4. Run smoke tests through the UI, check CloudWatch logs for Bedrock/Lambda errors.

*Why?* Ensures authentication works, agents respond, and we catch configuration gaps early.

### 2.6 Monitor and manage costs (Guide §6)
- Tail Lambda logs with `aws logs tail`.
- Inspect RDS/Athena statuses.
- Delete the sandbox (`npx ampx sandbox delete`) or CloudFormation stack when done.
- Track costs in Cost Explorer and budgets.

*Why?* The stack costs roughly $500/month; turning it off when idle prevents surprise bills.

### 2.7 Troubleshooting knowledge (Guide §7)
We documented the failure modes we hit:
- Signup blocked → expand email suffix list.
- Bedrock access denied → fix IAM/policies or wait for model approval.
- Marketplace subscription error → add `aws-marketplace:ViewSubscriptions`.
- `fs.existsSync` runtime error → rely on env var rather than filesystem.
- API key handling → keep [amplify_outputs.json](cci:7://file:///Users/atulchavan/Repository/agents4energy/amplify_outputs.json:0:0-0:0) out of git.

*Why?* These were real issues we corrected by adjusting IAM ([addLlmAgentPolicies](cci:1://file:///Users/atulchavan/Repository/agents4energy/amplify/functions/utils/cdkUtils.ts:4:0-120:1)), env handling, or waiting for AWS approvals.

### 2.8 Quick commands (Guide §8)
- `npm run ecrAuth`: authenticate Docker.
- `npx ampx sandbox --identifier … --once`: deploy backend.
- `npx ampx sandbox delete`: remove resources.
- `node -p "JSON.stringify(require('./amplify_outputs.json'))"`: minify outputs for env vars.

*Why?* Ready-made commands reduce the chance of human error.

---

## 3. Key code changes we made along the way

- **[src/amplifyOutputs.ts](cci:7://file:///Users/atulchavan/Repository/agents4energy/src/amplifyOutputs.ts:0:0-0:0)** now parses config from `NEXT_PUBLIC_AMPLIFY_OUTPUTS_JSON` only—no `fs` in the client bundle.
- **[amplify/functions/preSignUp/resource.ts](cci:7://file:///Users/atulchavan/Repository/agents4energy/amplify/functions/preSignUp/resource.ts:0:0-0:0)** includes `@feyntech.in` in the allowed signup suffixes.
- **IAM helper ([amplify/functions/utils/cdkUtils.ts](cci:7://file:///Users/atulchavan/Repository/agents4energy/amplify/functions/utils/cdkUtils.ts:0:0-0:0))** ensures agent Lambdas can call Bedrock and view AWS Marketplace subscriptions.
- **[CLOUD_DEPLOYMENT_GUIDE.md](cci:7://file:///Users/atulchavan/Repository/agents4energy/CLOUD_DEPLOYMENT_GUIDE.md:0:0-0:0)** (the doc we referenced) consolidates all of the above.

These are exact reflections of the work we did, not hypothetical.

---

## 4. Putting it all together

From first principles:
1. **Define the outcomes** (Agents, APIs, auth, UI) and the AWS services required.
2. **Capture them as code** ([amplify/backend.ts](cci:7://file:///Users/atulchavan/Repository/agents4energy/amplify/backend.ts:0:0-0:0), Lambda handlers, Next.js frontend).
3. **Fulfill prerequisites** (AWS access, Bedrock approvals, Docker authentication).
4. **Provision infrastructure** with Amplify sandbox → CloudFormation builds the AWS stacks.
5. **Wire the frontend** to the backend via [amplify_outputs.json](cci:7://file:///Users/atulchavan/Repository/agents4energy/amplify_outputs.json:0:0-0:0) and deploy it on Amplify Hosting.
6. **Verify behavior** end-to-end (sign up, log in, invoke agents).
7. **Maintain** by monitoring, troubleshooting, and managing costs.

The CLOUD_DEPLOYMENT_GUIDE.md document is the authoritative reference that captures these steps in actionable form. Let me know if you’d like diagrams, a slide-style summary, or automation scripts to wrap any part of the flow.














### When the sample data uploads happen

1. **BucketDeployment in [backend.ts](cci:7://file:///Users/atulchavan/Repository/agents4energy/amplify/backend.ts:0:0-0:0):**  
   - `uploadToS3Deployment` copies everything under [sampleData/](cci:7://file:///Users/atulchavan/Repository/agents4energy/sampleData:0:0-0:0) into the Amplify storage bucket as part of the production agent stack setup @amplify/backend.ts#195-206.  
   - It does **not** run immediately. We hook it behind a custom “delay” Lambda and multiple dependencies so files only land in S3 once the services that consume them (PDF converter, crawler, queues) are ready.  
   - After the delay and dependencies resolve, CDK’s `BucketDeployment` synchronizes the sample PDFs, structured CSVs, etc., into prefixes like:
     - `production-agent/well-files/` (PDFs)
     - `production-agent/structured-data-files/` (CSV/structured data)
     - `maintenance-agent/` (documents for maintenance KB)
     - `petrophysics-agent/` (geology docs), etc.

2. **Event-driven follow-up:**  
   - When the files appear, S3 notifications kick off downstream Lambdas and Step Functions to process them. That means the “upload” moment is the trigger for initial data conversions, knowledge-base ingestions, and database seeding.

---

### First-principles walkthrough of each agent pipeline

#### 1. Production Agent
Purpose: answer production engineering questions by combining PDFs, structured tables, and Bedrock knowledge bases.

Flow:
1. **Data provisioning**  
   - `BucketDeployment` uploads sample PDFs and CSVs (production-agent folder).  
   - `DelayResource` guarantees Lambdas/queues exist before the files arrive @amplify/backend.ts#226-252.

2. **Unstructured file pipeline**  
   - S3 upload of `production-agent/well-files/*.pdf` → S3 event posts to `pdfProcessingQueue` (SQS) @productionAgent.ts#169-188.  
   - `convertPdfToYamlFunction` consumes the queue, calls Textract + Bedrock to turn each PDF into YAML or text summary, and writes the result back to S3 (same bucket). This gives the agent structured context from scanned documents.

3. **Structured data pipeline**  
   - Sample CSVs in `production-agent/structured-data-files/` trigger `triggerCrawlerSfnFunction` which starts a Step Functions state machine @productionAgent.ts#736-733,652-704.  
   - The state machine runs a Glue crawler to infer schema → invokes `recordTableDefAndStartKbIngestionJob` Lambda → writes table definitions to S3 → starts Bedrock KB ingestion, so tables become searchable.

4. **Relational data**  
   - `configureProdDbFunction` populates the Aurora Postgres production DB with sample rows and records metadata for Athene/knowledge base @productionAgent.ts#433-512.

5. **Bedrock knowledge bases**  
   - `AuroraBedrockKnowledgeBase` indexes table definitions stored in S3.  
   - Another KB (`PetroleumKB`) crawls Petrowiki online content and indexes it.

6. **Lambda exposed to AppSync**  
   - `productionAgentFunction` (from [data/resource.ts](cci:7://file:///Users/atulchavan/Repository/agents4energy/amplify/data/resource.ts:0:0-0:0)) queries knowledge bases, the database, and tools like PDF summaries to answer the user’s question @data/resource.ts#22-37.

![Production agent ingestion pipeline](<Complete diagram.png>)

#### 2. Maintenance Agent
Purpose: simulate a CMMS (maintenance) workflow with RDS and knowledge bases.

Flow:
1. **Storage**  
   - Same `BucketDeployment` provides documents under `maintenance-agent/` for knowledge-base ingest.

2. **Database seeding**  
   - Aurora Postgres cluster (`maintDb`) stands up; `prepDbFunction` populates it via SQL executed in a custom resource @maintenanceAgent.ts#60-136.

3. **Knowledge base**  
   - Bedrock KB indexes S3 docs and crawls Nova Oilfield Services website to build maintenance context @maintenanceAgent.ts#138-157.

4. **Action group tool**  
   - `QueryCMMS` Lambda is registered as an agent tool; it uses RDS Data API to read the maintenance DB @maintenanceAgent.ts#161-189.

5. **Agent orchestration**  
   - Bedrock Agent (`MaintenanceAgent`) uses Claude Sonnet, the KB, and the CMMS tool to respond to AppSync queries.

![Maintenance agent architecture](<Maintenance-%20Diagram.png>)

#### 3. Regulatory Agent
Purpose: respond to compliance/regulation questions.

Flow:
1. **Data**  
   - S3 prefix `regulatory-agent/` contains regulation PDFs. When uploaded, the same S3 deployment ensures they exist once bedrock ingestion jobs are configured.

2. **Builder**  
   - `regulatoryAgentBuilder` creates the Bedrock agent, hooking in knowledge bases or action groups defined there.

3. **Outputs**  
   - The agent IDs/alises are exported so the UI knows which alias to target @amplify/backend.ts#288-302.

#### 4. Petrophysics Agent
Purpose: ingest geology documents and allow Q&A.

Flow:
1. **Data**  
   - S3 prefix `petrophysics-agent/` stores logs and geology files (deployed up front).

2. **Builder**  
   - `petrophysicsAgentBuilder` packages the Bedrock agent plus knowledge base connection.

3. **Output**  
   - Agent IDs exported to AppSync/Amplify for later use.

---

### Tool usage summary (first principles)

| Tool / Function | Trigger | What it does | Why it matters |
| --- | --- | --- | --- |
| **BucketDeployment** | CDK deploy | Copies bundled [sampleData/](cci:7://file:///Users/atulchavan/Repository/agents4energy/sampleData:0:0-0:0) into the live S3 bucket. | Makes sure demo files exist in the cloud without manual upload. |
| **convertPdfToYamlFunction** | SQS message for each new PDF | Uses Textract + Bedrock to create YAML summaries. | Converts raw well files into structured context agents can search. |
| **recordTableDefAndStartKbIngestionJob** | Glue crawler completion / EventBridge rule | Writes Athena table schemas to S3 and triggers knowledge base ingestion. | Keeps the KB updated whenever structured data changes. |
| **configureProdDbFunction** | Custom resource on deploy | Runs SQL via Data API to seed the production database. | Ensures the agent has realistic production metrics to query. |
| **triggerCrawlerSfnFunction** | S3 upload of structured data | Starts the Glue crawler state machine. | Keeps schemas in sync with new CSV files. |
| **PrepDbFunction (maintenance)** | Custom resource on deploy | Seeds CMMS database. | Agent has immediate data to answer maintenance questions. |
| **QueryCMMS Lambda** | Agent tool invocation | Runs SQL against maintenance DB to fetch live data. | Gives the agent an actionable tool beyond static knowledge. |

---

### End-to-end flow recap

1. **Deployment stage**
   - CDK deploys infrastructure (VPC, DBs, knowledge bases, agents).
   - After dependencies settle, `BucketDeployment` pushes sample docs to S3.
   - Custom resources seed databases and start ingestion jobs.

2. **Agent-startup stage**
   - S3 events → convert PDFs and ingest table schemas.
   - Knowledge bases finish ingesting docs and data.

3. **Runtime (user asks a question)**
   - Frontend calls the appropriate AppSync query.
   - Lambda or Bedrock agent:
     1. Pulls chat history from DynamoDB.
     2. Uses Bedrock knowledge bases to retrieve context from processed PDFs/CSVs/web crawl.
     3. Invokes tools (RDS via RDS Data API, PDF summaries from S3).
     4. Composes final answer and streams it back via AppSync.

That’s the full “first principles” picture: every component exists either to seed realistic demo data when the stack deploys or to fulfill a user query by combining Bedrock knowledge with live database/tool calls.





### System components (first principles inventory)

**Frontend (Next.js 14)**  
- [src/amplifyOutputs.ts](cci:7://file:///Users/atulchavan/Repository/agents4energy/src/amplifyOutputs.ts:0:0-0:0) parses `NEXT_PUBLIC_AMPLIFY_OUTPUTS_JSON` so the browser knows AppSync URL, Cognito IDs, and Bedrock agent aliases without bundling secrets @src/amplifyOutputs.ts#1-24.  
- React components call Amplify APIs configured from those outputs, then render chat/agent UIs.

**Amplify backend definition**  
- [amplify/backend.ts](cci:7://file:///Users/atulchavan/Repository/agents4energy/amplify/backend.ts:0:0-0:0) is the wiring blueprint: it registers auth, data, storage, and Lambda functions; creates the VPC; adds IAM policies; and builds nested stacks for each agent, production tooling, and configurator @amplify/backend.ts#1-355.  
- Custom outputs (agent IDs, API ID) are exported for the frontend @amplify/backend.ts#144-150 @amplify/backend.ts#296-333.

**AppSync data layer**  
- [amplify/data/resource.ts](cci:7://file:///Users/atulchavan/Repository/agents4energy/amplify/data/resource.ts:0:0-0:0) defines GraphQL schema, resolvers, and Lambda integrations (invoke Bedrock, production agent orchestration, plan-and-execute agent) @amplify/data/resource.ts#4-210.

**Shared infrastructure**  
- A dedicated VPC with public/private subnets, flow logs, and destruction policy provides network isolation for all agents and databases @amplify/backend.ts#152-179.  
- S3 bucket (Amplify storage) holds sample documents, structured datasets, and Athena results – populated via `BucketDeployment` after dependencies are ready @amplify/backend.ts#195-252.

**Agent stacks**  
- **Production agent**: Managed in [amplify/agents/production/productionAgent.ts](cci:7://file:///Users/atulchavan/Repository/agents4energy/amplify/agents/production/productionAgent.ts:0:0-0:0), combines PDF-to-YAML Lambda, SQS queue, Glue crawler, Step Functions, Aurora Postgres, Athena workgroup, and Bedrock knowledge bases @amplify/backend.ts#192-284 @amplify/agents/production/productionAgent.ts#91-708.  
- **Maintenance agent**: Provisions its own Aurora CMMS database, seeding Lambda, Bedrock knowledge base, and text-to-SQL action group @amplify/backend.ts#286-302 @amplify/agents/maintenance/maintenanceAgent.ts#26-189.  
- **Regulatory & Petrophysics agents**: Each nested stack connects agent builders with shared VPC and bucket, then exports alias IDs @amplify/backend.ts#304-334.

**Custom configurator**  
- `AppConfigurator` configures AppSync, Cognito pre-sign-up Lambda, and database metadata once shared resources are available @amplify/backend.ts#337-355.

---

### End-to-end flow (first principles)

1. **Provisioning (deployment time)**  
   - Amplify synthesizes CloudFormation from [backend.ts](cci:7://file:///Users/atulchavan/Repository/agents4energy/amplify/backend.ts:0:0-0:0), creating VPC, Cognito, AppSync, S3, RDS, Step Functions, and Bedrock resources.  
   - `BucketDeployment` waits for processing Lambdas/queues, then uploads sample PDFs/CSVs/web assets into S3 prefixes (production, maintenance, petrophysics, regulatory) @amplify/backend.ts#195-252.  
   - Custom resources seed databases (`configureProdDbFunction`, maintenance `PrepDbFunction`), kick off Glue crawlers, and start Bedrock knowledge-base ingestions so documents and table schemas are indexed @amplify/agents/production/productionAgent.ts#433-708 @amplify/agents/maintenance/maintenanceAgent.ts#94-189.

2. **Background automation**  
   - S3 events enqueue PDFs for the `convertPdfToYaml` Lambda → Textract + Bedrock transform unstructured well files into YAML/text artifacts the agent can query @amplify/agents/production/productionAgent.ts#91-188.  
   - Structured CSV uploads trigger a Step Functions workflow that runs the Glue crawler, captures schema metadata, and ingests it into the table-definition knowledge base @amplify/agents/production/productionAgent.ts#602-708.  
   - Maintenance agent ingest adds S3 docs plus crawled external knowledge, and registers a text-to-SQL Lambda tool against the CMMS database @amplify/agents/maintenance/maintenanceAgent.ts#138-189.

3. **Runtime (user interaction)**  
   - User signs in via Cognito + Amplify Auth (outputs exposed to frontend) @amplify/backend.ts#144-150.  
   - Frontend GraphQL queries hit AppSync, which routes to Lambda resolvers or Bedrock HTTP data sources to invoke agents @amplify/data/resource.ts#112-178.  
   - Production agent Lambda orchestrates: reads chat state, retrieves knowledge from Bedrock KB (table definitions, PetroWiki crawl), queries Aurora via RDS Data API, and returns structured answers @amplify/agents/production/productionAgent.ts#433-708.  
   - Maintenance/Regulatory/Petrophysics agents respond similarly, each with their own knowledge base and optional action groups, returning outputs through AppSync back to the UI.

---

### Putting it all together

- The **backend blueprint** ([backend.ts](cci:7://file:///Users/atulchavan/Repository/agents4energy/amplify/backend.ts:0:0-0:0)) wires AWS primitives so every agent has shared networking, storage, and explicit outputs for the frontend.
- **Sample data deployment plus event-driven Lambdas/Step Functions** ensure the knowledge bases and databases are populated automatically right after infrastructure stands up.
- **AppSync queries + agent Lambdas** orchestrate Bedrock calls, knowledge retrieval, and live database/tool invocations, streaming answers back to the Next.js UI configured via the Amplify outputs JSON.
- Each agent stack is isolated in its own nested CloudFormation stack, but reuses shared S3, VPC, and IAM helpers to stay consistent @amplify/backend.ts#286-334.

This end-to-end view—components, interactions, and the provisioning/runtime timelines—captures the entire system “from first principles.”




























### Cost impact: Amplify vs. DIY deployment

**Key point:** The expensive parts of Agents4Energy—Aurora Serverless, NAT gateways, Bedrock usage, AppSync, Cognito, Lambda, S3 storage, Step Functions—are identical whether you use Amplify or roll your own cloud pipeline. Amplify mainly adds managed build/hosting charges on top of those base services.

| Component | With Amplify Hosting/Sandbox | DIY (S3 + CloudFront + CodePipeline/CodeBuild) | Notes |
|-----------|------------------------------|-----------------------------------------------|-------|
| Front-end hosting | Amplify CDN: first 5 GB stored free, then ~$0.023/GB-month; first 15 GB served free, then $0.15/GB; requests $0.30 per 1 M (per AWS Amplify pricing, Jul 2025) | CloudFront: first 1 TB/mo free; next 9 TB ≈ $0.085/GB in US/EU; requests ~$0.01 per 10 k. Static assets stored in S3 at ~$0.023/GB-month (matches Amplify) | DIY can be cheaper for higher traffic because CloudFront bandwidth is ~40% less than Amplify’s post-free tier, but you lose Amplify’s integrated rewrites, auth helpers, and SSL automation. |
| Build minutes | Amplify CI: up to 1,000 free minutes; paid tier $0.01/min until Jun 2025, $0.025/min afterward (plan-dependent) | CodeBuild standard.small: $0.005–$0.01/min (region); you also pay for CodePipeline ($1/stage/month) or orchestrate builds in GitHub Actions. | Amplify includes orchestration and cache invalidations; DIY requires you to provision the pipeline. |
| Backend deploy tooling | `npx ampx sandbox` (no extra fee; uses CloudFormation under the hood) | CDK/CloudFormation or Terraform; possibly CodeBuild jobs to run `cdk deploy`. Same base service charges. | No cost delta—just operational effort. |
| Monitoring, SSL, custom domains | Included in Amplify app fee (WAF add-on optional $15/app/month) | CloudFront + ACM certificates are free; Route 53 DNS still paid per hosted zone. | Comparable costs. |
| Total incremental cost (typical small app) | If you exceed free tier: 300 build min + 50 GB served ≈ $0.01*300 + $0.15*35 ≈ **$7.5/mo** | Same workload: CodeBuild 300 min @$0.005 ≈ $1.5 + CloudFront $0.085*35 ≈ **$4.5/mo** | Savings of ~$3/mo—tiny relative to the ~$500/mo base stack. |

> **Base stack (~$500/mo)**: Aurora Serverless (always-on CPU capacity), NAT gateway hours + data, Bedrock model invocations, AppSync resolver usage, Lambda compute, S3 storage, and CloudWatch logs dominate the bill. Those remain unchanged outside Amplify.

### When skipping Amplify makes sense
1. **You already run CI/CD elsewhere** and don’t need Amplify’s hosted builds.
2. **Large-scale traffic**: CloudFront’s lower egress pricing amortizes better once you outgrow Amplify’s free 15 GB/month.
3. **Strict control/finops**: You prefer to budget each building block (S3, CloudFront, CodeBuild) explicitly.

### Reasons to keep Amplify
- Integrated previews, easy rewrites, Cognito/SSR integration, and one-click rollbacks.
- No separate pipeline maintenance; Amplify auto-invalidates CDN cache after each build.
- Sandbox CLI handles nested stacks and outputs without custom scripting.

### Bottom line
Switching away from Amplify can trim a *few dollars per month* in hosting/build fees, but won’t materially change the overall spend. The heavy hitters—Aurora, Bedrock, VPC networking—remain, so any cost optimization effort should target those resources (e.g., auto-pausing Aurora, rightsizing NAT usage, throttling Bedrock calls) rather than the Amplify layer.