import {
  aws_logs as logs,
  aws_ecs as ecs,
  aws_secretsmanager as secrets,
  aws_cloudwatch as cloudwatch,
} from 'aws-cdk-lib';
import { SecurityGroup, SubnetType } from 'aws-cdk-lib/aws-ec2';
import { IService } from 'aws-cdk-lib/aws-servicediscovery';
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
  //listner: loadbalancing.IApplicationListener;

  /**
   * Desired numer of tasks that should run in this service.
   */
  desiredtaskcount?: number;

  /**
   * The container image to use (e.g. on dockerhub)
   */
  containerImage: string;

  /**
   * Container listing port
   */
  containerPort: number;

  /**
   * Service listner path
   * (i.e. the path that the loadbalancer will use for this service)
   * Example: '/api/*'
   */
  serviceListnerPath: string;

  /**
   * Indicator if sport instances should be used for
   * running the tasks on fargate
   */
  useSpotInstances?: boolean;

  /**
   * Path the call on the container during health check
   */
  healthCheckPath: string;

  /**
   * ARN of the image's ECR repository
   */
  repositoryArn: string;

  // listner: loadbalancing.ApplicationListener;

  cloudMapsService: IService;

  /**
   * Provide security groups for this service
   */
  securityGroups?: SecurityGroup[];
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
    this.setupContainerMonitoring(props);

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

    // const ecrRepository = ecr.Repository.fromRepositoryArn(this, 'repository', props.repositoryArn);

    taskDef.addContainer(`${props.serviceName}-container`, {
      //image: ecs.ContainerImage.fromEcrRepository(ecrRepository),
      image: ecs.ContainerImage.fromRegistry(props.containerImage, {
        credentials: props.dockerhubSecret,
      }),
      logging: new ecs.AwsLogDriver({
        streamPrefix: 'logs',
        logGroup: logGroup,
      }),
      portMappings: [{
        containerPort: props.containerPort,
      }],
      readonlyRootFilesystem: false,
      healthCheck: {
        command: ['CMD-SHELL', 'curl -f localhost/status || exit 1'],
      },
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

    service.associateCloudMapService({
      service: props.cloudMapsService,
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