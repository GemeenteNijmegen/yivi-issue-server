import { PermissionsBoundaryAspect } from '@gemeentenijmegen/aws-constructs';
import { Aspects, Stack, Stage, StageProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Configurable } from './Configuration';
import { ContainerClusterStack } from './ContainerCluster';
import { DnsStack } from './DnsStack';
import { SecretsStack } from './SecretsStack';

export interface ApiStageProps extends StageProps, Configurable {}

export class ApiStage extends Stage {

  /**
   * For testing purposes
   */
  stacks: Stack[];

  constructor(scope: Construct, id: string, props: ApiStageProps) {
    super(scope, id, props);

    Aspects.of(this).add(new PermissionsBoundaryAspect('/', 'landingzone-workload-permissions-boundary'));

    const secretsStack = new SecretsStack(this, 'secrets-stack', {
      env: props.configuration.deployToEnvironment,
      description: 'Secret for yivi-issue-server',
    });

    const dnsStack = new DnsStack(this, 'dns-stack', {
      env: props.configuration.deployToEnvironment,
      configuration: props.configuration,
    });

    const cluster = new ContainerClusterStack(this, 'cluster-stack', {
      env: props.configuration.deployToEnvironment,
      description: 'ecs cluster and services for yivi-issue-server',
      configuration: props.configuration,
    });
    cluster.addDependency(secretsStack);
    cluster.addDependency(dnsStack);

    this.stacks = [
      secretsStack,
      dnsStack,
      cluster,
    ];
  }
}