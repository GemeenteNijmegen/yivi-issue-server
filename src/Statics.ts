export class Statics {

  static readonly projectName = 'yivi-issue-server';
  static readonly gitRepository = 'GemeenteNijmegen/yivi-issue-server';

  // Account root DNS zone
  static readonly accountRootHostedZonePath = '/gemeente-nijmegen/account/hostedzone/';
  static readonly accountRootHostedZoneId = '/gemeente-nijmegen/account/hostedzone/id';
  static readonly accountRootHostedZoneName = '/gemeente-nijmegen/account/hostedzone/name';

  // Parameter and secret references
  static readonly ssmParamsPath: string = '/cdk/um-demo/ssm/';
  static readonly ssmCertificateArn: string = '/cdk/um-demo/ssm/certificate-arn';
  static readonly ssmCloudfrontDistributionId: string = '/cdk/um-demo/ssm/cloudfront/dist-id';

  // Environments related statics
  static readonly codeStarConnectionArn = '';
  static readonly sandboxEnvironment = {
    account: '698929623502',
    region: 'eu-west-1',
  };


}