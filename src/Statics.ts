export class Statics {

  static readonly projectName = 'yivi-issue-server';
  static readonly gitRepository = 'GemeenteNijmegen/yivi-issue-server';

  // Account root DNS zone
  static readonly ssmAccountHostedZonePath = '/gemeente-nijmegen/account/hostedzone/';
  static readonly ssmAccountHostedZoneId = '/gemeente-nijmegen/account/hostedzone/id';
  static readonly ssmAccountHostedZoneName = '/gemeente-nijmegen/account/hostedzone/name';
  static readonly ssmHostedZoneId = '/yivi-brp-issue/hostedzone/id';
  static readonly ssmHostedZoneName = '/yivi-brp-issue/hostedzone/name';

  // Parameter and secret references
  static readonly ssmParamsPath: string = '/cdk/um-demo/ssm/';
  static readonly ssmCertificateArn: string = '/cdk/um-demo/ssm/certificate-arn';
  static readonly ssmCloudfrontDistributionId: string = '/cdk/um-demo/ssm/cloudfront/dist-id';

  static readonly ssmLoadbalancerSecurityHeader: string = '/yivi-brp-issue/loadbalancer/header';

  // Environments related statics
  static readonly codeStarConnectionArn = 'arn:aws:codestar-connections:eu-central-1:836443378780:connection/9d20671d-91bc-49e2-8680-59ff96e2ab11';

  static readonly acceptanceEnvironment = {
    account: '528030426040',
    region: 'eu-central-1',
  };

  static readonly deploymentEnvironment = {
    account: '836443378780',
    region: 'eu-central-1',
  };


  static notificationTopicArn = (account: string, priority: 'critical' | 'high' | 'medium' | 'low') => `arn:aws:sns:eu-central-1:${account}:landingzone-platform-events-${priority}`;


}