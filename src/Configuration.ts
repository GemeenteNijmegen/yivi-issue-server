import { Environment } from 'aws-cdk-lib';
import { Criticality } from './Criticality';
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
   * You can create the checksum by executing `shasum -a 256 ~/Downloads/irma-linux-amd643` (on mac)
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

  /**
   * The base level of severity for this project.
   */
  criticality: Criticality;

}

export const configurations: { [key: string]: Configuration } = {
  acceptance: {
    branchName: 'acceptance',
    yiviVersionNumber: 'v0.15.2',
    yiviVersionChecksum: '4dc70a8067c15e4e82dd69da8a5cb464056ac9f3441d0d0bffe4374cd055d62a',
    alpineLinuxVersion: '3.19.1',
    codeStarConnectionArn: Statics.codeStarConnectionArn,
    deployFromEnvironment: Statics.deploymentEnvironment,
    deployToEnvironment: Statics.acceptanceEnvironment,
    sessionEndpointAllowList: [
      'arn:aws:iam::699363516011:role/yivi-issue-api-api-stack-yiviissueissuefunctionlam-1AAD4D76XTRK5', // webapp new lz
      'arn:aws:iam::315037222840:role/yivi-issue-api-api-stack-yiviissueissuefunctionlam-13P8QZIPPJXI1', // webapp old lz
    ],
    sessionEndpointIamUser: true,
    useSpotInstances: true,
    criticality: new Criticality('medium'),
  },
  main: {
    branchName: 'main',
    yiviVersionNumber: 'v0.15.2',
    yiviVersionChecksum: '4dc70a8067c15e4e82dd69da8a5cb464056ac9f3441d0d0bffe4374cd055d62a',
    alpineLinuxVersion: '3.19.1',
    codeStarConnectionArn: Statics.codeStarConnectionArn,
    deployFromEnvironment: Statics.deploymentEnvironment,
    deployToEnvironment: Statics.productionEnvironment,
    sessionEndpointAllowList: [
      // This cannot be used currently (webapp does not offer support yet)
    ],
    sessionEndpointIamUser: true,
    criticality: new Criticality('high'),
  },
};

export function getConfiguration(buildBranch: string) {
  const config = configurations[buildBranch];
  if (!config) {
    throw Error(`No configuration for branch ${buildBranch} found. Add a configuration in Configuration.ts`);
  }
  return config;
}