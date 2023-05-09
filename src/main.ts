import { App } from 'aws-cdk-lib';
import { getConfiguration } from './Configuration';
import { PipelineStack } from './PipelineStack';

const buildBranch = process.env.BRANCH_NAME ?? 'acceptance';
console.log('Building branch', buildBranch);
const configuration = getConfiguration(buildBranch);

const app = new App();

new PipelineStack(app, `yivi-issue-server-${configuration.branchName}`, {
  env: configuration.deployFromEnvironment,
  configuration: configuration,
});

app.synth();