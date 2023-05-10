import { Aspects, Stage, StageProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { PermissionsBoundaryAspect } from './Aspect';
import { Configuration } from './Configuration';
import { ParameterStack } from './ParameterStack';
import { ContainerClusterStack } from './ContainerCluster';

export interface ApiStageProps extends StageProps, Configuration {}

export class ApiStage extends Stage {

  constructor(scope: Construct, id: string, props: ApiStageProps) {
    super(scope, id, props);

    Aspects.of(this).add(new PermissionsBoundaryAspect('/', 'landingzone-workload-permissions-boundary'));

    const parameterStack = new ParameterStack(this, 'parameter-stack', {
      env: props.deployToEnvironment,
      description: 'Parameters and secrets for yivi-issue-server',
    });


    // TODO build database stack RDS en configure container to use redis
    // const databaseStack = new DatabaseStack(this, 'database-stack', {
    // });

    const cluster = new ContainerClusterStack(this, 'cluster-stack', {
      env: props.deployToEnvironment,
      description: 'ecs cluster and services for yivi-issue-server',
    });
    cluster.addDependency(parameterStack);
  }
}