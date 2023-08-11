import { Environment } from 'aws-cdk-lib';
import { Statics } from './Statics';

export interface Configurable {
  configuration: Configuration;
}

export interface Configuration {

  /**
   * Git branch name associated with this configuration
   */
  branchName: string;

  /**
   * Which version of IRMA GO to download and
   * pack in the image
   */
  yiviVersionNumber: string;

  /**
   * Checksum of the IRMA GO executable
   * You can obtain the checksum by downloading the irma-linux-amd64 binary release and calculating it locally
   */
  yiviVersionChecksum: string;

  /**
   * Codestar connection to use
   */
  codeStarConnectionArn: string;

  /**
   * Deployment account (usually gn-build)
   */
  deployFromEnvironment: Environment;

  /**
   * The environment to deploy the project to
   */
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
   * Use FARGATE_SPOT instances
   * @default false
   */
  useSpotInstances?: boolean;

  /**
   * Alpine linux version
   * Note: add this so we can have predictable builds
   */
  alpineLinuxVersion: string;

}

export const configurations: { [key: string]: Configuration } = {
  acceptance: {
    branchName: 'acceptance',
    yiviVersionNumber: 'v0.13.0',
    yiviVersionChecksum: '44f9398e6a98b9a52ecac71f29fad0162810704f75a442fafba9e6a3a178edb4',
    alpineLinuxVersion: '3.18.3',
    codeStarConnectionArn: Statics.codeStarConnectionArn,
    deployFromEnvironment: Statics.deploymentEnvironment,
    deployToEnvironment: Statics.acceptanceEnvironment,
    sessionEndpointAllowList: [
      'arn:aws:iam::699363516011:role/yivi-issue-api-api-stack-yiviissueissuefunctionlam-1AAD4D76XTRK5', // webapp new lz
      'arn:aws:iam::315037222840:role/yivi-issue-api-api-stack-yiviissueissuefunctionlam-13P8QZIPPJXI1', // webapp old lz
    ],
    sessionEndpointIamUser: true,
    useSpotInstances: true,
  },
  main: {
    branchName: 'main',
    yiviVersionNumber: 'v0.13.0',
    yiviVersionChecksum: '44f9398e6a98b9a52ecac71f29fad0162810704f75a442fafba9e6a3a178edb4',
    alpineLinuxVersion: '3.18.3',
    codeStarConnectionArn: Statics.codeStarConnectionArn,
    deployFromEnvironment: Statics.deploymentEnvironment,
    deployToEnvironment: Statics.productionEnvironment,
    sessionEndpointAllowList: [
      // This cannot be used currently (webapp does not offer support yet)
    ],
    sessionEndpointIamUser: true,
  },
};

export function getConfiguration(buildBranch: string) {
  const config = configurations[buildBranch];
  if (!config) {
    throw Error(`No configuration for branch ${buildBranch} found. Add a configuration in Configuration.ts`);
  }
  return config;
}