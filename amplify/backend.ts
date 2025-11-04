// This file is the single entry point that tells Amplify Gen 2 which AWS resources to build.
// Think of it as the “wiring diagram” for the entire backend: we create Cognito for auth,
// AppSync for APIs, VPC networking, Bedrock agents, Lambdas, S3 buckets, and connect them all.
// The code below deliberately spells out every dependency so CloudFormation can deploy safely.

import path from 'path';
import { fileURLToPath } from 'url';
import { Stack } from 'aws-cdk-lib';
import { regulatoryAgentBuilder } from './agents/regulatory/regulatoryAgent';
import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import {
  data,
  invokeBedrockAgentFunction,
  getStructuredOutputFromLangchainFunction,
  productionAgentFunction,
  planAndExecuteAgentFunction,
} from './data/resource';
import { preSignUp } from './functions/preSignUp/resource';
import { storage } from './storage/resource';

import * as cdk from 'aws-cdk-lib'
import * as bedrock from 'aws-cdk-lib/aws-bedrock'
import {
  aws_iam as iam,
  aws_s3 as s3,
  aws_s3_deployment as s3Deployment,
  aws_ec2 as ec2,
  aws_lambda as lambda,
  custom_resources as cr,
  Aspects
} from 'aws-cdk-lib'

import { AwsSolutionsChecks } from 'cdk-nag'

import { productionAgentBuilder } from "./agents/production/productionAgent"
import { maintenanceAgentBuilder } from "./agents/maintenance/maintenanceAgent"
import { AppConfigurator } from './custom/appConfigurator'
import { cdkNagSupperssionsHandler } from './custom/cdkNagHandler';

import { addLlmAgentPolicies } from './functions/utils/cdkUtils'
import { petrophysicsAgentBuilder } from './agents/petrophysicsAgent/petrophysicsAgent';

// Tags help us find all resources that belong to this solution across the AWS console.
const resourceTags = {
  Project: 'agents-for-energy',
  Environment: 'dev',
  AgentsForEnergy: 'true'
}

// defineBackend() registers the high-level Amplify features (auth, data, functions, storage).
// Amplify translates this into a root CloudFormation stack with nested stacks underneath.
const backend = defineBackend({
  auth,
  data,
  storage,
  invokeBedrockAgentFunction,
  getStructuredOutputFromLangchainFunction,
  productionAgentFunction,
  planAndExecuteAgentFunction,
  preSignUp
});

const bedrockRuntimeDataSource = backend.data.resources.graphqlApi.addHttpDataSource(
  "bedrockRuntimeDS",
  `https://bedrock-runtime.${backend.auth.stack.region}.amazonaws.com`,
  {
    authorizationConfig: {
      signingRegion: backend.auth.stack.region,
      signingServiceName: "bedrock",
    },
  }
);

const bedrockAgentDataSource = backend.data.resources.graphqlApi.addHttpDataSource(
  "bedrockAgentDS",
  `https://bedrock-agent.${backend.auth.stack.region}.amazonaws.com`,
  {
    authorizationConfig: {
      signingRegion: backend.auth.stack.region,
      signingServiceName: "bedrock",
    },
  }
);

// The GraphQL API needs IAM policies that explicitly allow Bedrock runtime and agent calls.
// Without these statements AppSync resolvers would fail with AccessDenied.
bedrockRuntimeDataSource.grantPrincipal.addToPrincipalPolicy(
  new iam.PolicyStatement({
    resources: [
      `arn:aws:bedrock:${backend.auth.stack.region}::foundation-model/anthropic.claude-3-sonnet-20240229-v1:0`,
      `arn:aws:bedrock:${backend.auth.stack.region}::foundation-model/anthropic.*`,
    ],
    actions: ["bedrock:InvokeModel", "bedrock:InvokeModelWithResponseStream"],
  })
);

bedrockAgentDataSource.grantPrincipal.addToPrincipalPolicy(
  new iam.PolicyStatement({
    resources: [
      `arn:aws:bedrock:${backend.auth.stack.region}:${backend.auth.stack.account}:*`,
    ],
    actions: [
      "bedrock:ListAgents",
      "bedrock:ListAgentAliases"
    ],
  })
);

backend.invokeBedrockAgentFunction.resources.lambda.addToRolePolicy(
  new iam.PolicyStatement({
    resources: [
      `arn:aws:bedrock:${backend.auth.stack.region}:${backend.auth.stack.account}:agent-alias/*`,
    ],
    actions: ["bedrock:InvokeAgent"],
  }
  )
)

backend.invokeBedrockAgentFunction.resources.lambda.addToRolePolicy(
  new iam.PolicyStatement({
    resources: [
      `arn:aws:bedrock:${backend.auth.stack.region}::foundation-model/*`,
      `arn:aws:bedrock:us-*::foundation-model/*`,
    ],
    actions: ["bedrock:InvokeModel", "bedrock:InvokeModelWithResponseStream"],
  })
);

backend.getStructuredOutputFromLangchainFunction.resources.lambda.addToRolePolicy(
  new iam.PolicyStatement({
    resources: [
      `arn:aws:bedrock:${backend.auth.stack.region}:${backend.auth.stack.account}:inference-profile/*`,
      `arn:aws:bedrock:us-*::foundation-model/*`,
    ],
    actions: ["bedrock:InvokeModel"],
  })
)

const networkingStack = backend.createStack('networkingStack')
const rootStack = cdk.Stack.of(networkingStack).nestedStackParent
if (!rootStack) throw new Error('Root stack not found')

// Expose IDs of the key infrastructure so the frontend (and operators) can reference them later.
backend.addOutput({
  custom: {
    api_id: backend.data.resources.graphqlApi.apiId,
    root_stack_name: rootStack.stackName
  },
});

// Create a VPC so every agent and database runs inside an isolated network with public+private subnets.
const vpc = new ec2.Vpc(networkingStack, 'A4E-VPC', {
  ipAddresses: ec2.IpAddresses.cidr('10.0.0.0/16'),
  maxAzs: 3,
  enableDnsHostnames: true,
  enableDnsSupport: true,
  subnetConfiguration: [
    {
      cidrMask: 24,
      name: 'public',
      subnetType: ec2.SubnetType.PUBLIC,
    },
    {
      cidrMask: 24,
      name: 'private-with-egress',
      subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
    },
  ],
  flowLogs: {
    'flow-log': {
      destination: ec2.FlowLogDestination.toCloudWatchLogs(),
      trafficType: ec2.FlowLogTrafficType.ALL,
    }
  }
});

// Delete the VPC when the cloudformation template is deleted
vpc.applyRemovalPolicy(cdk.RemovalPolicy.DESTROY)

function applyTagsToRootStack() {
  if (!rootStack) throw new Error('Root stack not found')
  // Apply tags to every nested stack so they inherit cost and project metadata.
  Object.entries(resourceTags).map(([key, value]) => {
    cdk.Tags.of(rootStack).add(key, value)
  })
  cdk.Tags.of(rootStack).add('rootStackName', rootStack.stackName)
}
applyTagsToRootStack()


///////////////////////////////////////////////////////////
/////// Create the Production Agent Stack /////////////////
///////////////////////////////////////////////////////////
// Everything below (stacks + builders) works the same way: we create a nested stack per agent,
// deploy its Lambda functions, knowledge bases, queues, and return references (IDs, aliases, ARNs).
const productionAgentStack = backend.createStack('prodAgentStack');
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const uploadToS3Deployment = new s3Deployment.BucketDeployment(productionAgentStack, 'sample-deployment', {
  sources: [s3Deployment.Source.asset(path.join(rootDir, 'sampleData'))],
  destinationBucket: backend.storage.resources.bucket,
  memoryLimit: 3008,
  prune: false
  // destinationKeyPrefix: '/'
});

const {
  convertPdfToYamlFunction,
  triggerCrawlerSfnFunction,
  pdfProcessingQueue,
  wellFileDriveBucket,
  defaultProdDatabaseName,
  hydrocarbonProductionDb,
  sqlTableDefBedrockKnowledgeBase,
  petroleumEngineeringKnowledgeBase,
  athenaWorkgroup,
  // athenaPostgresCatalog,

} = productionAgentBuilder(productionAgentStack, {
  vpc: vpc,
  s3Deployment: uploadToS3Deployment, // This causes the assets here to not deploy until the s3 upload is complete.
  s3Bucket: backend.storage.resources.bucket,
})

// Delay uploading large sample PDFs until the Lambdas + Step Functions that process them exist.
const delayFunction = new lambda.Function(productionAgentStack, 'DelayFunction', {
  runtime: lambda.Runtime.NODEJS_18_X,
  handler: 'index.handler',
  timeout: cdk.Duration.minutes(15),
  memorySize: 3008, //increased memory size to maximum to avoid SIGKILL when there are a lot of sample files being uploaded to S3.
  code: lambda.Code.fromInline(`
    exports.handler = async () => {
      const secondsToWait = 600
      console.log('Waiting for ',secondsToWait,' seconds...');
      await new Promise(resolve => setTimeout(resolve, secondsToWait*1000));
      console.log('Wait complete.');
      return { statusCode: 200 };
    };
  `),
});
const delayProvider = new cr.Provider(productionAgentStack, 'DelayProvider', {
  onEventHandler: delayFunction,
});
const delayResource = new cdk.CustomResource(productionAgentStack, 'DelayResource', {
  serviceToken: delayProvider.serviceToken,
});
delayResource.node.addDependency(convertPdfToYamlFunction)
delayResource.node.addDependency(triggerCrawlerSfnFunction)
delayResource.node.addDependency(pdfProcessingQueue)
delayResource.node.addDependency(wellFileDriveBucket)
uploadToS3Deployment.node.addDependency(delayResource) //Don't deploy files until the resources handling uploads are deployed

// Wire runtime environment variables so the production agent Lambda knows where data lives.
backend.productionAgentFunction.addEnvironment('DATA_BUCKET_NAME', backend.storage.resources.bucket.bucketName)
backend.productionAgentFunction.addEnvironment('AWS_KNOWLEDGE_BASE_ID', sqlTableDefBedrockKnowledgeBase.knowledgeBase.attrKnowledgeBaseId)
backend.productionAgentFunction.addEnvironment('PETROLEUM_ENG_KNOWLEDGE_BASE_ID', petroleumEngineeringKnowledgeBase.knowledgeBaseId)
backend.productionAgentFunction.addEnvironment('ATHENA_WORKGROUP_NAME', athenaWorkgroup.name)
backend.productionAgentFunction.addEnvironment('DATABASE_NAME', defaultProdDatabaseName)
// backend.productionAgentFunction.addEnvironment('ATHENA_CATALOG_NAME', athenaPostgresCatalog.name)

addLlmAgentPolicies({
  role: backend.planAndExecuteAgentFunction.resources.lambda.role!,
  rootStack: rootStack,
  athenaWorkgroup: athenaWorkgroup,
  s3Bucket: backend.storage.resources.bucket
})

addLlmAgentPolicies({
  role: backend.productionAgentFunction.resources.lambda.role!,
  rootStack: rootStack,
  athenaWorkgroup: athenaWorkgroup,
  s3Bucket: backend.storage.resources.bucket
})

backend.productionAgentFunction.resources.lambda.addToRolePolicy(
  new iam.PolicyStatement({
    actions: ["bedrock:Retrieve"],
    resources: [
      sqlTableDefBedrockKnowledgeBase.knowledgeBase.attrKnowledgeBaseArn,
      petroleumEngineeringKnowledgeBase.knowledgeBaseArn
    ],
  })
)

///////////////////////////////////////////////////////////
/////// Create the Maintenance Agent Stack /////////////////
///////////////////////////////////////////////////////////
// Maintenance agent owns its own nested stack so it can scale independently and reuse shared assets.
const maintenanceAgentStack = backend.createStack('maintAgentStack')
const {defaultDatabaseName, maintenanceAgent, maintenanceAgentAlias} = maintenanceAgentBuilder(maintenanceAgentStack, {
  vpc: vpc,
  s3Deployment: uploadToS3Deployment, // This causes the assets here to not deploy until the s3 upload is complete.
  s3Bucket: backend.storage.resources.bucket,
})

backend.addOutput({
  custom: {
    maintenanceAgentId: maintenanceAgent.attrAgentId,
    maintenanceAgentAliasId: maintenanceAgentAlias.attrAgentAliasId,
  },
})

///////////////////////////////////////////////////////////
/////// Create the Regulatory Agent Stack /////////////////
///////////////////////////////////////////////////////////
// Regulatory agent packages compliance datasets and prompts in its own stack but still relies on shared VPC + bucket.
const regulatoryAgentStack = backend.createStack('regAgentStack')
const { regulatoryAgent, regulatoryAgentAlias, metric } = regulatoryAgentBuilder(regulatoryAgentStack, {
  vpc: vpc,
  s3Deployment: uploadToS3Deployment, // This causes the assets here to not deploy until the s3 upload is complete.
  s3Bucket: backend.storage.resources.bucket
})
backend.addOutput({
  custom: {
    regulatoryAgentId: regulatoryAgent.attrAgentId,
    regulatoryAgentAliasId: regulatoryAgentAlias.attrAgentAliasId,
  },
})

///////////////////////////////////////////////////////////
/////// Create the Petrophysics Agent Stack ///////////////
///////////////////////////////////////////////////////////
// Petrophysics agent focuses on geological analysis; this nested stack wires the same shared infrastructure into its Lambdas.
const petrophysicsAgentStack = backend.createStack('petroAgentStack')
const { petrophysicsAgent, petrophysicsAgentAlias } = petrophysicsAgentBuilder(petrophysicsAgentStack, {
  vpc: vpc,
  s3Deployment: uploadToS3Deployment, // This causes the assets here to not deploy until the s3 upload is complete.
  s3Bucket: backend.storage.resources.bucket
})
backend.addOutput({
  custom: {
    petrophysicsAgentId: petrophysicsAgent.attrAgentId,
    petrophysicsAgentAliasId: petrophysicsAgentAlias.attrAgentAliasId,
  },
})



///////////////////////////////////////////////////////////
/////// Create the Configurator Stack /////////////////////
///////////////////////////////////////////////////////////
// This stack configures the GraphQL API and adds a hook to the conginto user pool to check email address domain before allowing sign up.

// Create a stack with the resources to configure the app
const configuratorStack = backend.createStack('configuratorStack')

// The configurator custom resource seeds AppSync schema, Cognito pre-sign-up rules, and database metadata.
new AppConfigurator(configuratorStack, 'appConfigurator', {
  hydrocarbonProductionDb: hydrocarbonProductionDb,
  defaultProdDatabaseName: defaultProdDatabaseName,
  athenaWorkgroup: athenaWorkgroup,
  // athenaPostgresCatalog: athenaPostgresCatalog,
  s3Bucket: backend.storage.resources.bucket,
  appSyncApi: backend.data.resources.graphqlApi,
  preSignUpFunction: backend.preSignUp.resources.lambda,
  cognitoUserPool: backend.auth.resources.userPool,
})
