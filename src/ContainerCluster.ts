import {
  Stack, Fn, Aws, StackProps,
  aws_ecs as ecs,
  aws_ssm as ssm,
  aws_ec2 as ec2,
  aws_elasticloadbalancingv2 as loadbalancing,
  aws_route53 as route53,
  aws_route53_targets as route53Targets,
  aws_certificatemanager as acm,
  aws_apigateway as apigateway,
  aws_iam as iam,
  aws_logs as logs,
  aws_ecr as ecr,
  Duration,
} from 'aws-cdk-lib';
import { Secret } from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';
import { Configurable } from './Configuration';
import { EcsFargateService } from './constructs/EcsFargateService';
import { Statics } from './Statics';

export interface ContainerClusterStackProps extends StackProps, Configurable { }

export class ContainerClusterStack extends Stack {

  private hostedzone: route53.IHostedZone;
  private vpc: ec2.IVpc;
  private api: apigateway.RestApi;

  constructor(scope: Construct, id: string, props: ContainerClusterStackProps) {
    super(scope, id, props);

    this.hostedzone = this.importHostedZone();
    this.vpc = this.setupVpc();
    const cluster = this.constructEcsCluster();
    const loadbalancer = this.setupLoadbalancer();
    const listner = this.setupListner(loadbalancer);

    // API Gateway and access to VPC
    this.api = this.setupApiGateway(props);
    const vpclink = this.setupVpcLink(loadbalancer);

    // Setup services and api gateway routes
    this.addIssueServiceAndIntegration(cluster, props, listner);
    this.setupApiRoutes(vpclink);

  }

  setupApiRoutes(
    vpclink: apigateway.VpcLink,
  ) {

    // Public
    const irmaIntegration = new apigateway.Integration({
      type: apigateway.IntegrationType.HTTP_PROXY,
      integrationHttpMethod: 'ANY',
      uri: `https://alb.${this.hostedzone.zoneName}/irma/{proxy}`,
      options: {
        vpcLink: vpclink,
        timeout: Duration.seconds(6),
        requestParameters: {
          'integration.request.path.proxy': 'method.request.path.proxy',
        },
      },
    });
    const irma = this.api.root.addResource('irma');
    irma.addProxy({
      defaultIntegration: irmaIntegration,
      defaultMethodOptions: {
        authorizationType: apigateway.AuthorizationType.NONE,
        requestParameters: {
          'method.request.path.proxy': true,
        },
      },
    });

    // Private paths below
    const session = this.api.root.addResource('session');

    // POST /session
    const sessionIntegration = new apigateway.Integration({
      type: apigateway.IntegrationType.HTTP_PROXY,
      integrationHttpMethod: 'ANY',
      uri: `https://alb.${this.hostedzone.zoneName}/session`,
      options: {
        vpcLink: vpclink,
        timeout: Duration.seconds(6),
        requestParameters: {
          'integration.request.header.authorization': 'method.request.header.irma-authorization',
        },
      },
    });
    session.addMethod('POST', sessionIntegration, {
      authorizationType: apigateway.AuthorizationType.IAM,
      requestParameters: {
        'method.request.header.irma-authorization': true,
      },
    });

    // const sessionToken = session.addResource('{token}');

    // DELETE /session/{token} (NOT USED)
    // const tokenIntegration = new apigateway.Integration({
    //   type: apigateway.IntegrationType.HTTP_PROXY,
    //   integrationHttpMethod: 'ANY',
    //   uri: `https://alb.${this.hostedzone.zoneName}/session/{token}`,
    //   options: {
    //     vpcLink: vpclink,
    //     timeout: Duration.seconds(6),
    //     requestParameters: {
    //       'integration.request.header.authorization': 'method.request.header.irma-authorization',
    //       'integration.request.path.token': 'method.request.path.token',
    //     },
    //   },
    // });
    // sessionToken.addMethod('DELETE', tokenIntegration, {
    //   authorizationType: apigateway.AuthorizationType.IAM,
    //   requestParameters: {
    //     'method.request.header.irma-authorization': true,
    //     'method.request.path.token': true,
    //   },
    // });

    // GET /session/{token}/result (NOT USED)
    // const resultIntegration = new apigateway.Integration({
    //   type: apigateway.IntegrationType.HTTP_PROXY,
    //   integrationHttpMethod: 'ANY',
    //   uri: `https://alb.${this.hostedzone.zoneName}/session/{token}/result`,
    //   options: {
    //     vpcLink: vpclink,
    //     timeout: Duration.seconds(6),
    //     requestParameters: {
    //       'integration.request.header.authorization': 'method.request.header.irma-authorization',
    //       'integration.request.path.token': 'method.request.path.token',
    //     },
    //   },
    // });
    // sessionToken.addResource('result').addMethod('GET', resultIntegration, {
    //   authorizationType: apigateway.AuthorizationType.IAM,
    //   requestParameters: {
    //     'method.request.header.irma-authorization': true,
    //     'method.request.path.token': true,
    //   }
    // });

    // GET /session/{token}/status (NOT USED)
    // const statusIntegration = new apigateway.Integration({
    //   type: apigateway.IntegrationType.HTTP_PROXY,
    //   integrationHttpMethod: 'ANY',
    //   uri: `https://alb.${this.hostedzone.zoneName}/session/{token}/status`,
    //   options: {
    //     vpcLink: vpclink,
    //     timeout: Duration.seconds(6),
    //     requestParameters: {
    //       'integration.request.header.authorization': 'method.request.header.irma-authorization',
    //       'integration.request.path.token': 'method.request.path.token',
    //     },
    //   },
    // });
    // sessionToken.addResource('status').addMethod('GET', statusIntegration, {
    //   authorizationType: apigateway.AuthorizationType.IAM,
    //   requestParameters: {
    //     'method.request.header.irma-authorization': true,
    //     'method.request.path.token': true,
    //   }
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

  setupVpcLink(loadbalancer: loadbalancing.INetworkLoadBalancer) {
    return new apigateway.VpcLink(this, 'vpc-link', {
      description: 'Link between RestApi and private subnets in VPC (yivi issue server)',
      targets: [loadbalancer],
    });
  }

  importHostedZone() {
    const id = ssm.StringParameter.valueForStringParameter(this, Statics.ssmHostedZoneId);
    const name = ssm.StringParameter.valueForStringParameter(this, Statics.ssmHostedZoneName);
    return route53.HostedZone.fromHostedZoneAttributes(this, 'hostedzone', {
      hostedZoneId: id,
      zoneName: name,
    });
  }

  /**
   * Using RestApi as this is more suiteable for us: WAF, Resource-based policies, Request mapping without reserved headers
   * Unfortunately RestApi does not have direct integration with CloudMap for loadbalacing.
   * Differences between HttpApi and RestApi can be found here https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-vs-rest.html
   * @returns RestApi
   */
  setupApiGateway(props: ContainerClusterStackProps) {

    const cert = new acm.Certificate(this, 'api-cert', {
      domainName: this.hostedzone.zoneName,
      validation: acm.CertificateValidation.fromDns(this.hostedzone),
    });

    const accessLogging = new logs.LogGroup(this, 'api-logging', {
      retention: logs.RetentionDays.ONE_WEEK, // Very short lived as we'll be using a WAF
    });

    const api = new apigateway.RestApi(this, 'api', {
      description: 'API gateway for yivi-brp issue server',
      domainName: {
        certificate: cert,
        domainName: this.hostedzone.zoneName,
        securityPolicy: apigateway.SecurityPolicy.TLS_1_2,
      },
      policy: this.setupApiGatewayPolicy(props),
      deployOptions: {
        accessLogDestination: new apigateway.LogGroupLogDestination(accessLogging),
        accessLogFormat: apigateway.AccessLogFormat.custom(
          JSON.stringify({
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
          }),
        ),
      },
    });

    // Setup DNS records
    if (!api.domainName) {
      throw Error('No domain name configured, cannot create alas and A record');
    }
    const alias = new route53Targets.ApiGatewayDomain(api.domainName);
    new route53.ARecord(this, 'api-a-record', {
      zone: this.hostedzone,
      target: route53.RecordTarget.fromAlias(alias),
    });

    return api;
  }

  setupApiGatewayPolicy(props: ContainerClusterStackProps) {
    const region = Stack.of(this).region;
    const accountId = Stack.of(this).account;

    const allowInvokePrincipals = props.configuration.sessionEndpointAllowList.map(arn => new iam.ArnPrincipal(arn));
    if (props.configuration.sessionEndpointIamUser) {
      const user = new iam.User(this, 'yivi-api-user', {});
      allowInvokePrincipals.push(new iam.ArnPrincipal(user.userArn));
    }

    return new iam.PolicyDocument({
      statements: [
        new iam.PolicyStatement({
          actions: ['execute-api:Invoke'],
          principals: allowInvokePrincipals,
          effect: iam.Effect.ALLOW,
          resources: [
            // Only allow invokation of this single endpoint
            `arn:aws:execute-api:${region}:${accountId}:*/prod/POST/session`,
          ],
        }),
        new iam.PolicyStatement({
          actions: ['execute-api:Invoke'],
          principals: [new iam.AnyPrincipal()],
          effect: iam.Effect.ALLOW,
          resources: [
            `arn:aws:execute-api:${region}:${accountId}:*/prod/*/irma`,
            `arn:aws:execute-api:${region}:${accountId}:*/prod/*/irma/*`,
          ],
        }),
      ],
    });
  }

  /**
   * Import the account vpc from the landingzone
   * @returns vpc
   */
  constructEcsCluster() {
    // Note: if a VPC is not provided we are creating a new one for this cluster
    const cluster = new ecs.Cluster(this, 'cluster', {
      vpc: this.vpc,
      clusterName: 'yivi-issue-cluster',
      enableFargateCapacityProviders: true, // Allows usage of spot instances
    });

    this.vpc.node.addDependency(cluster);

    return cluster;
  }

  setupLoadbalancer() {

    // Construct the loadbalancer
    const loadbalancer = new loadbalancing.NetworkLoadBalancer(this, 'loadbalancer', {
      vpc: this.vpc,
      internetFacing: false,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
    });

    this.vpc.node.addDependency(loadbalancer);
    return loadbalancer;
  }

  setupListner(loadbalancer: loadbalancing.NetworkLoadBalancer) {

    // Get a certificate
    const albWebFormsDomainName = `alb.${this.hostedzone.zoneName}`;
    const albCertificate = new acm.Certificate(this, 'loadbalancer-certificate', {
      domainName: albWebFormsDomainName,
      validation: acm.CertificateValidation.fromDns(this.hostedzone),
    });

    // Setup a https listner
    const listner = loadbalancer.addListener('https', {
      certificates: [albCertificate],
      protocol: loadbalancing.Protocol.TLS,
      sslPolicy: loadbalancing.SslPolicy.FORWARD_SECRECY_TLS12_RES,
      port: 443,
    });

    return listner;
  }

  addIssueServiceAndIntegration(
    cluster: ecs.Cluster,
    props: ContainerClusterStackProps,
    listner: loadbalancing.NetworkListener,
  ) {

    // Define the image to use for the service
    const region = props.configuration.deployFromEnvironment.region;
    const account = props.configuration.deployFromEnvironment.account;
    const branch = props.configuration.branchName;
    const ecrRepositoryArn = `arn:aws:ecr:${region}:${account}:repository/yivi-issue-server-${branch}`;
    const ecrRepository = ecr.Repository.fromRepositoryArn(this, 'repository', ecrRepositoryArn);
    const image = ecs.ContainerImage.fromEcrRepository(ecrRepository, props.configuration.yiviVersionNumber);

    // Get secrets
    const apiKey = Secret.fromSecretNameV2(this, 'api-key', Statics.secretsApiKey);
    const privateKey = Secret.fromSecretNameV2(this, 'private-key', Statics.secretsPrivateKey);

    // Define a security group to allow ingress on the container port
    const containerPort = 8080;
    const serviceSecurityGroup = new ec2.SecurityGroup(this, 'issue-service-sg', {
      vpc: this.vpc,
      description: 'Security group for the yivi-issue-server',
      allowAllOutbound: true,
    });
    const privateSubnetCidrs = [1, 2, 3].map(i => ssm.StringParameter.valueForStringParameter(this, `/landingzone/vpc/private-subnet-${i}-cidr`));
    privateSubnetCidrs.forEach(cidr => {
      const peer = ec2.Peer.ipv4(cidr);
      serviceSecurityGroup.addIngressRule(peer, ec2.Port.tcp(containerPort));
    });

    // Create the service
    const service = new EcsFargateService(this, 'issue-service', {
      serviceName: 'yivi-issue',
      containerImage: image,
      containerPort: containerPort,
      ecsCluster: cluster,
      desiredtaskcount: 1,
      useSpotInstances: props.configuration.useSpotInstances ?? false,
      listner: listner,
      securityGroups: [serviceSecurityGroup],
      secrets: {
        IRMA_TOKEN: ecs.Secret.fromSecretsManager(apiKey),
        IRMA_GEMEENTE_PRIVKEY: ecs.Secret.fromSecretsManager(privateKey),
      },
      environment: {
        IRMA_GW_URL: this.hostedzone.zoneName, // protocol prefix is added in the container
      },
    });

    // Allow role to use the protection key for accessing the secrets on startup
    const role = service.service.taskDefinition.executionRole;
    if (!role) {
      throw Error('No task execution role defined!');
    }
    const protectionKeyArn = ssm.StringParameter.valueForStringParameter(this, Statics.ssmProtectionKeyArn);
    service.allowToDecryptUsingKey(protectionKeyArn);
    privateKey.grantRead(role);
    apiKey.grantRead(role);

  }


}