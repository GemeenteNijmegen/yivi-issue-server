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
  aws_iam as iam,
} from 'aws-cdk-lib';
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
    this.setupLoadbalancer(vpc, hostedzone);
    this.constructEcsCluster(vpc);
    //this.setupApiGateway(hostedzone, listner);
    //this.addHelloWorldService(cluster, listner, props);
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

  importHostedZone() {
    const id = ssm.StringParameter.valueForStringParameter(this, Statics.ssmHostedZoneId);
    const name = ssm.StringParameter.valueForStringParameter(this, Statics.ssmHostedZoneName);
    return route53.HostedZone.fromHostedZoneAttributes(this, 'hostedzone', {
      hostedZoneId: id,
      zoneName: name,
    });
  }

  setupApiGateway(hostedzone: route53.IHostedZone, listner: loadbalancing.ApplicationListener) {

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

    api.addRoutes({
      path: '/',
      integration: new apigatewayv2Integrations.HttpAlbIntegration('api-integration', listner),
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
    });
    // Security hub finding, do not accept invalid http headers
    loadbalancer.setAttribute('routing.http.drop_invalid_header_fields.enabled', 'true');

    // Setup a https listner
    const listner = loadbalancer.addListener('https', {
      certificates: [albCertificate],
      protocol: loadbalancing.ApplicationProtocol.HTTPS,
      sslPolicy: loadbalancing.SslPolicy.FORWARD_SECRECY_TLS12_RES,
      defaultAction: loadbalancing.ListenerAction.fixedResponse(404, { messageBody: 'not found ALB' }),
    });

    new route53.ARecord(this, 'loadbalancer-a-record', {
      zone: hostedzone,
      recordName: 'alb',
      target: route53.RecordTarget.fromAlias(new route53Targets.LoadBalancerTarget(loadbalancer)),
      comment: 'ALB A record for yivi issue server',
    });

    vpc.node.addDependency(loadbalancer);
    return listner;
  }

  addHelloWorldService(cluster: ecs.Cluster, listner: loadbalancing.IApplicationListener, props: ContainerClusterStackProps) {
    new EcsFargateService(this, 'service-1', {
      serviceName: 'test',
      containerImage: 'nginxdemos/hello',
      containerPort: 80,
      ecsCluster: cluster,
      listner: listner,
      serviceListnerPath: '/*',
      desiredtaskcount: 1,
      useSpotInstances: true,
      apiGatewayAccessToken: props.configuration.apiGatewayAlbSecurityToken,
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