import {
  Stack,
  StackProps,
  aws_iam as iam,
  aws_kms as kms,
  aws_secretsmanager as secrets,
} from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Statics } from './Statics';


export class SecretsStack extends Stack {

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    new secrets.Secret(this, 'api-key', {
      secretName: Statics.secretsApiKey,
      description: 'API KEY for YIVI issue server',
    });

    // Secret private key for YIVI issue server
    // new secrets.Secret(this, 'private-key', {
    //   secretName: Statics.secretsPrivateKey,
    //   description: 'Private key for YIVI issue server',
    //   encryptionKey: this.createYiviKey(),
    // });


  }


  createYiviKey() {

    const policy = new iam.ManagedPolicy(this, 'private-key-admin-policy', {
      managedPolicyName: 'yivi-private-key-admin-policy',
      description: 'Policy for YIVI private key admin',
    });

    const key = new kms.Key(this, 'key', {
      policy: new iam.PolicyDocument({
        statements: [

          new iam.PolicyStatement({
            sid: 'Allow KMS key to be used by secretsmanager',
            effect: iam.Effect.ALLOW,
            principals: [new iam.AnyPrincipal()],
            resources: ['*'],
            actions: [
              'kms:CreateGrant',
              'kms:ListGrants',
              'kms:RevokeGrant',
            ],
            conditions: [
              {
                Bool: {
                  'kms:GrantIsForAWSResource': 'true',
                },
              },
            ],
          }),
          new iam.PolicyStatement(
            {
              sid: 'Allow KMS key to be access by ECS and private key admin',
              effect: iam.Effect.ALLOW,
              principals: [
                new iam.ArnPrincipal('irma_ecs_role'), // TODO get role ARN
                new iam.ArnPrincipal(policy.managedPolicyArn),
              ],
              actions: [
                'kms:Encrypt',
                'kms:Decrypt',
                'kms:ReEncrypt*',
                'kms:GenerateDataKey*',
                'kms:DescribeKey',
              ],
              resources: ['*'],
            },
          ),
        ],
      }),
    });

    new kms.Alias(this, 'alias', {
      aliasName: 'yivi-private-key',
      targetKey: key,
    });

    return key;

  }
}