import {
  Stack,
  StackProps,
  aws_ssm as ssm,
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

  }

}