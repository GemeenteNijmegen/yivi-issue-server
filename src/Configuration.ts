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
   * You can create the checksum by executing `shasum -a 256 ~/Downloads/irma-linux-amd64` (on mac)
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

  /**
   * The SD-JWT VC issuer identifier as defined in the scheme.
   * Used as the filename for the certificate and private key PEM files.
   * E.g. 'irma-demo.gemeente' for acceptance, 'pbdf.gemeente' for production.
   * When not set, SD-JWT VC issuance is disabled.
   */
  sdjwtvcIssuerId?: string;

}

export const configurations: { [key: string]: Configuration } = {
  acceptance: {
    branchName: 'acceptance',
    yiviVersionNumber: 'v0.18.1',
    yiviVersionChecksum: '0006dd9c7ece2d193a3fc73fc31e2747a63d739a291a76c389f494b32da5c865',
    alpineLinuxVersion: '3.21.7',
    codeStarConnectionArn: Statics.codeStarConnectionArn,
    deployFromEnvironment: Statics.deploymentEnvironment,
    deployToEnvironment: Statics.acceptanceEnvironment,
    sessionEndpointAllowList: [
      'arn:aws:iam::699363516011:role/yivi-issue-api-api-stack-yiviissueissuefunctionlam-1AAD4D76XTRK5',
    ],
    sessionEndpointIamUser: false,
    useSpotInstances: true,
    criticality: new Criticality('medium'),
    sdjwtvcIssuerId: 'irma-demo.gemeente',
  },
  main: {
    branchName: 'main',
    yiviVersionNumber: 'v0.19.2',
    yiviVersionChecksum: '2613009da798e249b4d07d9435cde330aa63d4ba9e05cbe3fe54cc346783c6f6',
    alpineLinuxVersion: '3.21.7',
    codeStarConnectionArn: Statics.codeStarConnectionArn,
    deployFromEnvironment: Statics.deploymentEnvironment,
    deployToEnvironment: Statics.productionEnvironment,
    sessionEndpointAllowList: [
      'arn:aws:iam::185512167111:role/yivi-issue-api-api-stack-yiviissueissuefunctionlam-TFTCG5EPAX36',
    ],
    sessionEndpointIamUser: false,
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
