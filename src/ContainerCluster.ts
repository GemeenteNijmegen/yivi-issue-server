import * as apigatewayv2 from '@aws-cdk/aws-apigatewayv2-alpha';
import * as apigatewayv2Integrations from '@aws-cdk/aws-apigatewayv2-integrations-alpha';
import {
  Stack, Fn, Aws, StackProps,
  aws_ecs as ecs,
  aws_ssm as ssm,
  aws_ec2 as ec2,
  aws_elasticloadbalancingv2 as loadbalancing,
  aws_route53 as route53,
  aws_route53_targets as route53Targets,
  aws_certificatemanager as acm,
  aws_kms as kms,
  aws_servicediscovery as servicediscovery,
  aws_iam as iam,
  aws_apigatewayv2 as cdkApigatewayV2,
  aws_logs as logs,
  Duration,
} from 'aws-cdk-lib';
import { SecurityGroup } from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';
import { Configurable } from './Configuration';
import { EcsFargateService } from './constructs/EcsFargateService';
import { Statics } from './Statics';

export interface ContainerClusterStackProps extends StackProps, Configurable {}

export class ContainerClusterStack extends Stack {

  constructor(scope: Construct, id: string, props: ContainerClusterStackProps) {
    super(scope, id, props);

    const hostedzone = this.importHostedZone();
    const vpc = this.setupVpc();
    const namespace = this.setupCloudMap(vpc);
    const cluster =this.constructEcsCluster(vpc);

    // API Gateway and access to VPC
    const api = this.setupApiGateway(hostedzone);
    const vpcLinkSecurityGroup = this.setupVpcLinkSecurityGroup(vpc);
    const vpcLink = this.setupVpcLink(vpc, vpcLinkSecurityGroup);

    // Setup services and api gateway routes
    const yiviIssueIntegration = this.addIssueServiceAndIntegration(cluster, namespace, vpcLink, vpc, vpcLinkSecurityGroup);
    this.setupApiRoutes(api, yiviIssueIntegration);

  }

  setupApiRoutes(
    api: apigatewayv2.HttpApi, 
    integration: apigatewayv2Integrations.HttpServiceDiscoveryIntegration
  ){

    // Public
    api.addRoutes({
      authorizer: new apigatewayv2.HttpNoneAuthorizer(),
      path: '/irma/{proxy+}',
      methods: [apigatewayv2.HttpMethod.ANY],
      integration: integration,
    });

    // Private paths below
    api.addRoutes({
      path: '/session',
      methods: [apigatewayv2.HttpMethod.POST],
      integration: integration,
    });
    
    

    api.addRoutes({
      path: '/session/{token}',
      methods: [apigatewayv2.HttpMethod.DELETE],
      integration: integration,
    });

    api.addRoutes({
      path: '/session/{token}/result',
      methods: [apigatewayv2.HttpMethod.GET],
      integration: integration,
    });

    api.addRoutes({
      path: '/session/{token}/status',
      methods: [apigatewayv2.HttpMethod.GET],
      integration: integration,
    });

    // Dont thinks this is required as we have no events support in apigateway
    // api.addRoutes({
    //   path: '/session/{token}/statusevents',
    //   methods: [apigatewayv2.HttpMethod.GET],
    //   integration: integration,
    // });

  }

  setupVpc() {

    // Import vpc config (only public and private subnets)
    const vpcId = ssm.StringParameter.valueForStringParameter(this, '/landingzone/vpc/vpc-id');
    const availabilityZones = [0, 1, 2].map(i => Fn.select(i, Fn.getAzs(Aws.REGION)));
    const publicSubnetRouteTableIds = Array(3).fill(ssm.StringParameter.valueForStringParameter(this, '/landingzone/vpc/route-table-public-subnets-id'));
    const privateSubnetRouteTableIds = [1, 2, 3].map(i => ssm.StringParameter.valueForStringParameter(this, `/landingzone/vpc/route-table-private-subnet-${i}-id`));
    const publicSubnetIds = [1, 2, 3].map(i => ssm.StringParameter.valueForStringParameter(this, `/landingzone/vpc/public-subnet-${i}-id`));
    const privateSubnetIds = [1, 2, 3].map(i => ssm.StringParameter.valueForStringParameter(this, `/landingzone/vpc/private-subnet-${i}-id`));

    const vpc = ec2.Vpc.fromVpcAttributes(this, 'vpc', {
      vpcId,
      availabilityZones,
      privateSubnetRouteTableIds,
      publicSubnetRouteTableIds,
      publicSubnetIds,
      privateSubnetIds,
    });

    return vpc;
  }

  setupVpcLinkSecurityGroup(vpc: ec2.IVpc) {
    const sg = new ec2.SecurityGroup(this, 'vpc-link-sg', {
      vpc,
      allowAllOutbound: true,
    });
    sg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80));
    return sg;
  }

  setupVpcLink(vpc: ec2.IVpc, securityGroup: ec2.ISecurityGroup) {
    return new apigatewayv2.VpcLink(this, 'vpc-link', { vpc, securityGroups: [securityGroup] });
  }

  importHostedZone() {
    const id = ssm.StringParameter.valueForStringParameter(this, Statics.ssmHostedZoneId);
    const name = ssm.StringParameter.valueForStringParameter(this, Statics.ssmHostedZoneName);
    return route53.HostedZone.fromHostedZoneAttributes(this, 'hostedzone', {
      hostedZoneId: id,
      zoneName: name,
    });
  }

  setupCloudMap(vpc: ec2.IVpc) {
    return new servicediscovery.PrivateDnsNamespace(this, 'cloud-map', {
      name: 'yivi-issue.local',
      vpc,
    });
  }

  setupApiGateway(hostedzone: route53.IHostedZone) {

    const cert = new acm.Certificate(this, 'api-cert', {
      domainName: hostedzone.zoneName,
      validation: acm.CertificateValidation.fromDns(hostedzone),
    });

    const domainname = new apigatewayv2.DomainName(this, 'api-domain', {
      certificate: cert,
      domainName: hostedzone.zoneName,
    });

    const api = new apigatewayv2.HttpApi(this, 'api', {
      description: 'API gateway for yivi-brp issue server',
      defaultDomainMapping: {
        domainName: domainname,
      },
    });

    const accessLogging = new logs.LogGroup(this, 'api-logging', {
      retention: logs.RetentionDays.ONE_WEEK, // Very short lived as we'll be using a WAF
    });
    const defaultStage = api.defaultStage?.node.defaultChild as cdkApigatewayV2.CfnStage;
    defaultStage.accessLogSettings = {
      destinationArn: accessLogging.logGroupArn,
      format: JSON.stringify({
        requestId: '$context.requestId',
        userAgent: '$context.identity.userAgent',
        sourceIp: '$context.identity.sourceIp',
        requestTime: '$context.requestTime',
        requestTimeEpoch: '$context.requestTimeEpoch',
        httpMethod: '$context.httpMethod',
        path: '$context.path',
        status: '$context.status',
        protocol: '$context.protocol',
        responseLength: '$context.responseLength',
        domainName: '$context.domainName',
        errorMessage: '$context.error.message',
        errorType: '$context.error.responseType',
        stage: '$context.stage',
        integrationError: '$context.integration.error',
        integrationStatus: '$context.integration.integrationStatus',
        integrationLatency: '$context.integration.latency',
        integrationRequestId: '$context.integration.requestId',
        integrationErrorMessage: '$context.integrationErrorMessage',
        integrationLatency2: '$context.integrationLatency',
        integrationStatus2: '$context.integration.status',
        integrationStatus3: '$context.integrationStatus',
      }),
    };
    /*

*/
    const alias = new route53Targets.ApiGatewayv2DomainProperties(domainname.regionalDomainName, domainname.regionalHostedZoneId);
    new route53.ARecord(this, 'api-a-record', {
      zone: hostedzone,
      target: route53.RecordTarget.fromAlias(alias),
    });

    return api;
  }

  constructEcsCluster(vpc: ec2.IVpc) {
    // Note: if a VPC is not provided we are creating a new one for this cluster
    const cluster = new ecs.Cluster(this, 'cluster', {
      vpc,
      clusterName: 'yivi-issue-cluster',
      enableFargateCapacityProviders: true, // Allows usage of spot instances
    });


    vpc.node.addDependency(cluster);

    return cluster;
  }

  setupLoadbalancer(vpc: ec2.IVpc, hostedzone: route53.IHostedZone) {

    // Get a certificate
    const albWebFormsDomainName = `alb.${hostedzone.zoneName}`;
    const albCertificate = new acm.Certificate(this, 'loadbalancer-certificate', {
      domainName: albWebFormsDomainName,
      validation: acm.CertificateValidation.fromDns(hostedzone),
    });

    // Construct the loadbalancer
    const loadbalancer = new loadbalancing.ApplicationLoadBalancer(this, 'loadbalancer', {
      vpc,
      internetFacing: false,
      dropInvalidHeaderFields: true,
    });

    // Setup a https listner
    const listner = loadbalancer.addListener('https', {
      certificates: [albCertificate],
      protocol: loadbalancing.ApplicationProtocol.HTTPS,
      sslPolicy: loadbalancing.SslPolicy.FORWARD_SECRECY_TLS12_RES,
      defaultAction: loadbalancing.ListenerAction.fixedResponse(404, { messageBody: 'not found ALB' }),
    });

    vpc.node.addDependency(loadbalancer);
    return listner;
  }

  addIssueServiceAndIntegration(
    cluster: ecs.Cluster,
    namespace: servicediscovery.PrivateDnsNamespace,
    vpcLink: apigatewayv2.VpcLink,
    vpc: ec2.IVpc,
    vpcLinkSecurityGroup: ec2.SecurityGroup,
  ) {

    // const region = props.configuration.deployFromEnvironment.region;
    // const account = props.configuration.deployFromEnvironment.account;
    // const branch = props.configuration.branchName;
    // const ecrRepositoryArn = `arn:aws:ecr:${region}:${account}:repository/yivi-issue-server-${branch}`;

    const cloudMapsService = namespace.createService('yivi-issue-service', {
      description: 'CloudMap for yivi-issue-service',
      dnsRecordType: servicediscovery.DnsRecordType.SRV, // Only supported
      dnsTtl: Duration.seconds(10), // Max 10 seconds downtime?
      customHealthCheck: { // By setting custom health checks object we use ECS health check status!
        failureThreshold: 1,
      },
    });

    const sg = new SecurityGroup(this, 'issue-service-sg', { vpc });
    sg.addIngressRule(ec2.Peer.securityGroupId(vpcLinkSecurityGroup.securityGroupId), ec2.Port.tcp(80));

    new EcsFargateService(this, 'issue-service', {
      serviceName: 'yivi-issue',
      containerImage: 'nginxdemos/hello',
      repositoryArn: '',
      containerPort: 80,
      ecsCluster: cluster,
      serviceListnerPath: '/irma',
      desiredtaskcount: 1,
      useSpotInstances: true,
      healthCheckPath: '/status',
      cloudMapsService,
      securityGroups: [sg],
    });

    return new apigatewayv2Integrations.HttpServiceDiscoveryIntegration('api-integration', cloudMapsService, {
      vpcLink,
    });

  }

  createYiviKey() {
    const key = new kms.Key(this, 'key', {
      policy: new iam.PolicyDocument({
        statements: [

          new iam.PolicyStatement({
            sid: 'AllowAttachmentOfPersistentResources',
            effect: iam.Effect.ALLOW,
            principals: [new iam.AnyPrincipal()],
            resources: ['*'],
            actions: [
              'kms:CreateGrant',
              'kms:ListGrants',
              'kms:RevokeGrant',
            ],
            conditions: [
              {
                Bool: {
                  'kms:GrantIsForAWSResource': 'true',
                },
              },
            ],
          }),
          new iam.PolicyStatement(
            {
              sid: 'Allow use of the key',
              effect: iam.Effect.ALLOW,
              principals: [
                new iam.ArnPrincipal('irma_ecs_role'), // TODO get role ARN
                new iam.ArnPrincipal('irma_key_admin'), // TODO get irma key admin ARN
              ],
              actions: [
                'kms:Encrypt',
                'kms:Decrypt',
                'kms:ReEncrypt*',
                'kms:GenerateDataKey*',
                'kms:DescribeKey',
              ],
              resources: ['*'],
            },
          ),
        ],
      }),
      // admins: [] // TODO check who can be admins?
    });

    new kms.Alias(this, 'alias', {
      aliasName: 'yivi-issue-key',
      targetKey: key,
    });

  }

}