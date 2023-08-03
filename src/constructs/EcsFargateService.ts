import {
  aws_logs as logs,
  aws_ecs as ecs,
  aws_cloudwatch as cloudwatch,
  aws_elasticloadbalancingv2 as loadbalancing,
  aws_iam as iam,
} from 'aws-cdk-lib';
import { SecurityGroup, SubnetType } from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';
import { Statics } from '../Statics';

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

  /**
   * The size the container may be
   */
  containerSize?: {
    cpu: '256' | '512' | '1024'| '2048';
    mem: '512' | '1024'| '2048' | '4096';
  };

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
        port: '8080',
        protocol: loadbalancing.Protocol.TCP,
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
      retention: logs.RetentionDays.ONE_MONTH,
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
      cpu: props.containerSize?.cpu ?? '512',
      memoryMiB: props.containerSize?.mem ?? '1024',
      executionRole: this.setupTaskExecutionRole(),
    });

    // Create a volume for the container to write to
    const VOLUME_NAME = 'issue-container-volume';
    taskDef.addVolume({ name: VOLUME_NAME });

    // The init container will change permissions on the volume
    // See https://github.com/aws/containers-roadmap/issues/938
    const initContainer = taskDef.addContainer('init-container', {
      image: ecs.ContainerImage.fromRegistry('alpine:latest'),
      entryPoint: ['sh', '-c'],
      command: ['chmod 0777 /storage'], // TODO check proper restriction
      essential: false, // exit after running
    });
    initContainer.addMountPoints({
      containerPath: '/storage',
      readOnly: false,
      sourceVolume: VOLUME_NAME,
    });

    // The main container will run the irmago server
    const container = taskDef.addContainer(`${props.serviceName}-container`, {
      image: props.containerImage,
      logging: new ecs.AwsLogDriver({
        streamPrefix: 'logs',
        logGroup: logGroup,
      }),
      portMappings: [{
        containerPort: props.containerPort,
      }],
      readonlyRootFilesystem: true,
      secrets: props.secrets,
      environment: props.environment,
    });
    container.addMountPoints({
      containerPath: '/storage',
      readOnly: false,
      sourceVolume: VOLUME_NAME,
    });

    // Make sure the init container runs first
    container.addContainerDependencies({
      container: initContainer,
      condition: ecs.ContainerDependencyCondition.SUCCESS,
    });

    return taskDef;
  }

  private setupTaskExecutionRole() {
    const role = new iam.Role(this, 'task-execution-role', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      roleName: Statics.yiviContainerTaskExecutionRoleName,
    });

    return role;
  }


  public allowToDecryptUsingKey(keyArn: string) {
    // Note solution from: https://github.com/aws/aws-cdk/issues/17156
    this.service.taskDefinition.addToExecutionRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['kms:Decrypt'],
        resources: [keyArn],
      }),
    );
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

  /**
   * Add alarms for CPU and Memory
   * @param props
   */
  private setupContainerMonitoring(props: EcsFargateServiceProps) {
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