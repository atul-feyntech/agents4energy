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

const parseOutputsFromEnv = (): AmplifyOutputs => {
  const serialized = process.env.NEXT_PUBLIC_AMPLIFY_OUTPUTS_JSON;

  if (!serialized) {
    return {};
  }

  try {
    return JSON.parse(serialized) as AmplifyOutputs;
  } catch (error) {
    console.warn('Failed to parse NEXT_PUBLIC_AMPLIFY_OUTPUTS_JSON:', error);
    return {};
  }
};

export default parseOutputsFromEnv();
