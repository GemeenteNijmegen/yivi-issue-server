import { Environment } from 'aws-cdk-lib';
import { Statics } from './Statics';

export interface Configuration {
  branchName: string;
  yiviVersionNumber: string;
  codeStarConnectionArn: string;
  deployFromEnvironment: Environment;
  deployToEnvironment: Environment;
  sessionEndpointAllowList: string[];
}

export const configurations: { [key: string]: Configuration } = {
  development: {
    branchName: 'development',
    yiviVersionNumber: '0.0.0',
    codeStarConnectionArn: Statics.codeStarConnectionArn,
    deployFromEnvironment: Statics.sandboxEnvironment,
    deployToEnvironment: Statics.sandboxEnvironment,
    sessionEndpointAllowList: [
      '', // TODO arn of issue lambda in Yivi issue app
    ],
  },
};

export function getConfiguration(buildBranch: string) {
  const config = configurations[buildBranch];
  if (!config) {
    throw Error(`No configuration for branch ${buildBranch} found. Add a configuration in Configuration.ts`);
  }
  return config;
}