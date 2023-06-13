import {
  Stack,
  StackProps,
  aws_iam as iam,
  aws_kms as kms,
  aws_ssm as ssm,
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
    //const adminPolicy = this.createAdminPolicy();
    const key = this.createYiviProtectionKey();
    new secrets.Secret(this, 'private-key', {
      secretName: Statics.secretsPrivateKey,
      description: 'Private key for YIVI issue server',
      encryptionKey: key,
    });

    //this.allowSecretManagement(privateKey, adminPolicy);
    //this.addToKeyPolicy(adminPolicy, key);

  }


  createAdminPolicy() {
    const policy = new iam.ManagedPolicy(this, 'private-key-admin-policy', {
      managedPolicyName: 'yivi-private-key-admin-policy',
      description: 'Policy for YIVI private key admin',
    });
    return policy;
  }

  allowSecretManagement(secret: secrets.Secret, policy: iam.ManagedPolicy) {
    policy.addStatements(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'secretsmanager:Put*',
        'secretsmanager:Update*',
        'secretsmanager:Get*',
        'secretsmanager:List*',
        'secretsmanager:Describe*',
      ],
      resources: [
        secret.secretArn,
      ],
    }));
  }

  createYiviProtectionKey() {
    const key = new kms.Key(this, 'protection-key', {
      description: 'Key for protecting access to secrets for Yivi',
      alias: 'yivi-private-key',
    });

    key.addToResourcePolicy(new iam.PolicyStatement({
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
    }));

    new ssm.StringParameter(this, 'protection-key-arn', {
      parameterName: Statics.ssmProtectionKeyArn,
      stringValue: key.keyArn,
    });

    return key;

  }

  // addToKeyPolicy(policy: iam.ManagedPolicy, key: kms.Key) {
  //   const statement = new iam.PolicyStatement({
  //     sid: 'Allow KMS key to be access by ECS and private key admin',
  //     effect: iam.Effect.ALLOW,
  //     principals: [
  //       //new iam.ArnPrincipal('irma_ecs_role'), // TODO get role ARN
  //       new iam.ArnPrincipal(policy.managedPolicyArn),
  //     ],
  //     actions: [
  //       'kms:Encrypt',
  //       'kms:Decrypt',
  //       'kms:ReEncrypt*',
  //       'kms:GenerateDataKey*',
  //       'kms:DescribeKey',
  //     ],
  //     resources: ['*'],
  //   });
  //   key.addToResourcePolicy(statement);
  // }
}