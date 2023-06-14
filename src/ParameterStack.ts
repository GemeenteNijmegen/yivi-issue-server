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

    new iam.ManagedPolicy(this, 'protection-key-access-policy', {
      managedPolicyName: Statics.kmsKeyAccessManagedPolicyName,
      description: 'Policy for the protaction key that protects access to secrets for Yivi',
      statements: [
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            'kms:Encrypt',
            'kms:Decrypt',
            'kms:ReEncrypt*',
            'kms:GenerateDataKey*',
            'kms:DescribeKey',
          ],
          resources: [
            key.keyArn,
          ],
        }),
      ]
    });

    new ssm.StringParameter(this, 'protection-key-arn', {
      parameterName: Statics.ssmProtectionKeyArn,
      stringValue: key.keyArn,
    });

    return key;

  }

}