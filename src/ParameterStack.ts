import {
  Stack,
  StackProps,
  aws_ssm as ssm,
  aws_secretsmanager as secretsmanager,
} from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Statics } from './Statics';


export class ParameterStack extends Stack {

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    new ssm.StringParameter(this, 'ssm-1', {
      parameterName: Statics.ssmLoadbalancerSecurityHeader,
      description: 'Loadbalancer API gateway authentication header',
      stringValue: '-',
    });

    new secretsmanager.Secret(this, 'secret-1', {
      secretName: Statics.secretDockerhub,
      description: 'Dockerhub secret for yivi-brp-issue-server',
    });

  }

}