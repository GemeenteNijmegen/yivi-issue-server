import { Aspects, Stage, StageProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { PermissionsBoundaryAspect } from './Aspect';
import { ContainerClusterStack } from './ContainerCluster';
import { ParameterStack } from './ParameterStack';
import { DnsStack } from './DnsStack';
import { Configurable } from './Configuration';

export interface ApiStageProps extends StageProps, Configurable {}

export class ApiStage extends Stage {

  constructor(scope: Construct, id: string, props: ApiStageProps) {
    super(scope, id, props);

    Aspects.of(this).add(new PermissionsBoundaryAspect('/', 'landingzone-workload-permissions-boundary'));

    const parameterStack = new ParameterStack(this, 'parameter-stack', {
      env: props.configuration.deployToEnvironment,
      description: 'Parameters and secrets for yivi-issue-server',
    });

    const dnsStack = new DnsStack(this, 'dns-stack', {
      configuration: props.configuration
    });

    const cluster = new ContainerClusterStack(this, 'cluster-stack', {
      env: props.configuration.deployToEnvironment,
      description: 'ecs cluster and services for yivi-issue-server',
    });
    cluster.addDependency(parameterStack);
    cluster.addDependency(dnsStack);
  }
}