import { Stage, StageProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { CertStack } from './CertStack';
import { CloudfrontStack } from './CloudfrontStack';
import { Configuration } from './Configuration';
import { ContainerClusterStack } from './ContainerCluster';
import { ParameterStack } from './ParameterStack';

export interface ApiStageProps extends StageProps, Configuration {}

export class ApiStage extends Stage {

  constructor(scope: Construct, id: string, props: ApiStageProps) {
    super(scope, id, props);

    const parameterStack = new ParameterStack(this, 'parameter-stack', {
      env: props.deployToEnvironment,
      description: 'Parameters and secrets for yivi-issue-server',
    });

    const certificateStack = new CertStack(this, 'certificate-stack', {
      env: {
        account: props.deployToEnvironment.account,
        region: 'us-east-1',
      },
    });

    // TODO check if we need a cloudfront stack or just an API gateway
    const cloudfrontStack = new CloudfrontStack(this, 'cloudfront-stack', {
      env: props.deployToEnvironment,
    });
    cloudfrontStack.addDependency(certificateStack);

    const cluster = new ContainerClusterStack(this, 'cluster-stack', {
      env: props.deployToEnvironment,
      description: 'ecs cluster and services for yivi-issue-server',
    });
    cluster.addDependency(cloudfrontStack);
    cluster.addDependency(parameterStack);
  }
}