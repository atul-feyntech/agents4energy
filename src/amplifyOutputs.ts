import fs from 'fs';
import path from 'path';

interface AmplifyCustomOutputs {
  api_id?: string;
  maintenanceAgentId?: string;
  maintenanceAgentAliasId?: string;
  regulatoryAgentId?: string;
  regulatoryAgentAliasId?: string;
  petrophysicsAgentId?: string;
  petrophysicsAgentAliasId?: string;
}

interface AmplifyOutputs {
  custom?: AmplifyCustomOutputs;
}

const outputsPath = path.resolve(__dirname, '../amplify_outputs.json');

let outputs: AmplifyOutputs = {};

if (fs.existsSync(outputsPath)) {
  try {
    outputs = JSON.parse(fs.readFileSync(outputsPath, 'utf8')) as AmplifyOutputs;
  } catch (e) {
    console.warn('Failed to parse amplify_outputs.json:', e);
  }
}

export default outputs;
