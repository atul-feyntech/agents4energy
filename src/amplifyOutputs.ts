import fs from 'fs';
import path from 'path';

const outputsPath = path.resolve(__dirname, '../amplify_outputs.json');

let outputs: Record<string, unknown> = {};

if (fs.existsSync(outputsPath)) {
  try {
    outputs = JSON.parse(fs.readFileSync(outputsPath, 'utf8'));
  } catch (e) {
    console.warn('Failed to parse amplify_outputs.json:', e);
  }
}

export default outputs;
