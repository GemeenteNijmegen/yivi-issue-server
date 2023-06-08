import {
  aws_logs as logs,
  aws_ecs as ecs,
  aws_secretsmanager as secrets,
  aws_cloudwatch as cloudwatch,
  aws_elasticloadbalancingv2 as loadbalancing,
} from 'aws-cdk-lib';
import { SecurityGroup, SubnetType } from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';

const ALARM_THRESHOLD = 70;
const ALARM_DATA_POINTS = 3;
const ALARM_EVAL_PERIODS = 5;

export interface EcsFargateServiceProps {
  /**
   * The name of this ECS fargate service.
   * A service suffix is automatically added.
   */
  serviceName: string;

  /**
   * Provide a servet that contains the credentials
   * key value pairs with username and password to a dockerhub account.
   */
  dockerhubSecret?: secrets.ISecret;

  /**
   * The ECS cluster to which to add this fargate service
   */
  ecsCluster: ecs.Cluster;

  /**
   * The loadbalancer listner to which to connect this service
   */
  listner: loadbalancing.NetworkListener;

  /**
   * Desired numer of tasks that should run in this service.
   */
  desiredtaskcount?: number;

  /**
   * The container image to use (e.g. on dockerhub)
   */
  containerImage: ecs.ContainerImage;

  /**
   * Container port to open
   */
  containerPort: number;

  /**
   * Indicator if sport instances should be used for
   * running the tasks on fargate
   */
  useSpotInstances?: boolean;

  /**
   * The command that is executed using the default shell in the container
   * exit code 0 is considered healthy.
   * Example 'wget localhost:80/irma -O /dev/null -q || exit 1'
   */
  healthCheckCommand: string;

  /**
   * Provide security groups for this service
   */
  securityGroups?: SecurityGroup[];

  /**
   * Secrets to pass to the container on startup
   */
  secrets?: { [key: string]: ecs.Secret };

  /**
   * Environment variables to pass to the container on startup
   */
  environment?: { [key: string]: string };

}

/**
 * The ecs fargate service construct:
 * - defines a service with a single task
 * - the task consists of a single container
 * - creates a log group for the service
 * - exposes a single container port to the loadbalancer over http
 */
export class EcsFargateService extends Construct {

  readonly logGroupArn: string;
  readonly service: ecs.FargateService;

  constructor(scope: Construct, id: string, props: EcsFargateServiceProps) {
    super(scope, id);

    // Logging
    const logGroup = this.logGroup(props);
    this.logGroupArn = logGroup.logGroupArn;

    // Task, service and expose to loadbalancer
    const task = this.setupTaskDefinition(logGroup, props);
    this.service = this.setupFargateService(task, props);
    this.setupLoadbalancingTarget(props);
    this.setupContainerMonitoring(props);

  }

  /**
   * Take the ECS service and add is to the loadbalancer target group
   * @param props
   */
  setupLoadbalancingTarget(props: EcsFargateServiceProps) {
    const targetGroup = new loadbalancing.NetworkTargetGroup(this, 'targets', {
      vpc: props.ecsCluster.vpc,
      port: 8080,
      healthCheck: {
        enabled: true,
      },
    });
    props.listner.addTargetGroups(props.serviceName, targetGroup);
    targetGroup.addTarget(this.service);
  }

  /**
   * Setup a basic log group for this service's logs
   * @param props
   */
  private logGroup(props: EcsFargateServiceProps) {
    const logGroup = new logs.LogGroup(this, `${props.serviceName}-logs`, {
      retention: logs.RetentionDays.ONE_DAY, // TODO Very short lived (no need to keep demo stuff)
    });
    return logGroup;
  }

  /**
   * Create a task definition with a single container for
   * within the fargate service
   * @param props
   */
  private setupTaskDefinition(logGroup: logs.ILogGroup, props: EcsFargateServiceProps) {

    const taskDef = new ecs.TaskDefinition(this, `${props.serviceName}-task`, {
      compatibility: ecs.Compatibility.FARGATE,
      cpu: '256', // TODO Uses minimal cpu and memory
      memoryMiB: '512',
    });

    taskDef.addContainer(`${props.serviceName}-container`, {
      image: props.containerImage,
      logging: new ecs.AwsLogDriver({
        streamPrefix: 'logs',
        logGroup: logGroup,
      }),
      portMappings: [{
        containerPort: props.containerPort,
      }],
      readonlyRootFilesystem: false,
      healthCheck: {
        command: ['CMD-SHELL', props.healthCheckCommand],
      },
      secrets: props.secrets,
      environment: props.environment,
    });
    return taskDef;
  }

  /**
   * Define the service in the cluster
   * @param task the ecs task definition
   * @param props
   */
  private setupFargateService(task: ecs.TaskDefinition, props: EcsFargateServiceProps) {

    const service = new ecs.FargateService(this, `${props.serviceName}-service`, {
      cluster: props.ecsCluster,
      serviceName: `${props.serviceName}-service`,
      taskDefinition: task,
      desiredCount: props.desiredtaskcount,
      capacityProviderStrategies: [
        {
          capacityProvider: props.useSpotInstances ? 'FARGATE_SPOT' : 'FARGATE',
          weight: 1,
        },
      ],
      vpcSubnets: {
        subnetType: SubnetType.PRIVATE_WITH_EGRESS,
      },
      securityGroups: props.securityGroups,
    });


    service.node.addDependency(props.ecsCluster);
    return service;
  }

  setupContainerMonitoring(props: EcsFargateServiceProps) {
    new cloudwatch.Alarm(this, `${props.serviceName}-cpu-util-alarm`, {
      metric: this.service.metricCpuUtilization(),
      alarmDescription: `Alarm on CPU utilization for ${props.serviceName}`,
      threshold: ALARM_THRESHOLD,
      evaluationPeriods: ALARM_EVAL_PERIODS,
      datapointsToAlarm: ALARM_DATA_POINTS,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
    });

    new cloudwatch.Alarm(this, `${props.serviceName}-memory-util-alarm`, {
      metric: this.service.metricMemoryUtilization(),
      alarmDescription: `Alarm on memory utilization for ${props.serviceName}`,
      threshold: ALARM_THRESHOLD,
      evaluationPeriods: ALARM_EVAL_PERIODS,
      datapointsToAlarm: ALARM_DATA_POINTS,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
    });
  }

}