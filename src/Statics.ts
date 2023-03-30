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
  static readonly codeStarConnectionArn = 'arn:aws:codestar-connections:eu-west-1:418648875085:connection/4f647929-c982-4f30-94f4-24ff7dbf9766';
  static readonly codeStarconnectionArnGnBuildNewLz = 'arn:aws:codestar-connections:eu-central-1:836443378780:connection/508a1593-8137-4b3b-b92d-4f8c1a6a6b1d';
  static readonly sandboxEnvironment = {
    account: '049753832279',
    region: 'eu-central-1',
  };

  static readonly deploymentEnvironment = {
    account: '836443378780',
    region: 'eu-central-1',
  };


}