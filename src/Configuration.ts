import { Environment } from 'aws-cdk-lib';
import { Statics } from './Statics';

export interface Configurable {
  configuration: Configuration;
}

export interface Configuration {
  branchName: string;
  yiviVersionNumber: string;
  yiviVersionChecksum: string;
  codeStarConnectionArn: string;
  deployFromEnvironment: Environment;
  deployToEnvironment: Environment;

  /**
   * Provide a list of ARNs that may invoke
   * the sessions endpoint in the API gateway.
   */
  sessionEndpointAllowList: string[];

  /**
   * Indicates if an IAM user should be created an have rights
   * to access the API (only deploy to accp)
   */
  sessionEndpointIamUser: boolean;

  /**
   * Incidator for which configuration file to use
   */
  buildTargetEnvironment: 'accp' | 'prod';
}

export const configurations: { [key: string]: Configuration } = {
  acceptance: {
    branchName: 'acceptance',
    yiviVersionNumber: 'v0.12.1',
    yiviVersionChecksum: 'd772b84c42379fed2a50ce3375ff14522e32dce38298a6797f496db0f5e1d373',
    codeStarConnectionArn: Statics.codeStarConnectionArn,
    deployFromEnvironment: Statics.deploymentEnvironment,
    deployToEnvironment: Statics.acceptanceEnvironment,
    sessionEndpointAllowList: [
      'arn:aws:iam::315037222840:role/yivi-issue-api-api-stack-yiviissueissuefunctionlam-13P8QZIPPJXI1',
    ],
    sessionEndpointIamUser: true,
    buildTargetEnvironment: 'accp',
  },
};

export function getConfiguration(buildBranch: string) {
  const config = configurations[buildBranch];
  if (!config) {
    throw Error(`No configuration for branch ${buildBranch} found. Add a configuration in Configuration.ts`);
  }
  return config;
}