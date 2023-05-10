import { randomUUID } from 'crypto';
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
} from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { EcsFargateService } from './constructs/EcsFargateService';
import { Statics } from './Statics';

export interface ContainerClusterStackProps extends StackProps {

}

export class ContainerClusterStack extends Stack {

  constructor(scope: Construct, id: string, props: ContainerClusterStackProps) {
    super(scope, id, props);

    const hostedzone = this.importHostedZone();
    this.setupApiGateway(hostedzone);
    this.setupVpc();
    //const listner = this.setupLoadbalancer(vpc);
    //const cluster = this.constructEcsCluster(vpc);
    //this.addHelloWorldService(cluster, listner);
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

  setupApiGateway(hostedzone: route53.IHostedZone) {

    const cert = new acm.Certificate(this, 'api-cert', {
      domainName: hostedzone.zoneName,
      validation: acm.CertificateValidation.fromDns(hostedzone),
    });

    const api = new apigateway.RestApi(this, 'api', {
      domainName: {
        certificate: cert,
        domainName: hostedzone.zoneName,
      },
    });

    // Temp method to test integration
    api.root.addMethod('GET', new apigateway.HttpIntegration('https://nijmegen.nl'));

    return api;
  }

  /**
   * Create an ECS cluster
   * If a VPC is not provided we are creating a new one for this cluster
   */
  constructEcsCluster(vpc: ec2.IVpc) {
    const cluster = new ecs.Cluster(this, 'cluster', {
      vpc,
      clusterName: 'yivi-issue-cluster',
      enableFargateCapacityProviders: true, // Allows usage of spot instances
    });

    vpc.node.addDependency(cluster);

    return cluster;
  }

  setupLoadbalancer(vpc: ec2.IVpc, hostedzone: route53.HostedZone) {

    // Get a certificate
    const albWebFormsDomainName = `alb.${hostedzone.zoneName}`;
    const albCertificate = new acm.Certificate(this, 'loadbalancer-certificate', {
      domainName: albWebFormsDomainName,
      validation: acm.CertificateValidation.fromDns(hostedzone),
    });


    // Construct the loadbalancer
    const loadbalancer = new loadbalancing.ApplicationLoadBalancer(this, 'loadbalancer', {
      vpc,
      internetFacing: true, // Expose to internet (not internal to vpc)
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
      comment: 'webformulieren load balancer a record',
    });

    vpc.node.addDependency(loadbalancer);
    return listner;
  }


  addHelloWorldService(cluster: ecs.Cluster, listner: loadbalancing.IApplicationListener) {
    new EcsFargateService(this, 'service-1', {
      serviceName: 'test',
      containerImage: 'nginxdemos/hello',
      containerPort: 80,
      ecsCluster: cluster,
      listner: listner,
      serviceListnerPath: '/*',
      desiredtaskcount: 1,
      useSpotInstances: true,
      cloudfrontOnlyAccessToken: randomUUID(),
    });
  }

}