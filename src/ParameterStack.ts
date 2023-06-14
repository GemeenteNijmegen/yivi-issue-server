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
    const key = this.createYiviProtectionKey();
    const privateKey = new secrets.Secret(this, 'private-key', {
      secretName: Statics.secretsPrivateKey,
      description: 'Private key for YIVI issue server',
      encryptionKey: key,
    });

    this.createAdminPolicy(key.keyArn, privateKey.secretArn);
  }

  createAdminPolicy(kmsKeyArn: string, ...secretArns: string[]) {
    const policy = new iam.ManagedPolicy(this, 'private-key-admin-policy', {
      managedPolicyName: Statics.yiviAdministratorPolicy,
      description: 'Policy for YIVI private key admin',
      statements: [
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            'secretsmanager:UpdateSecret',
            'secretsmanager:DescribeSecret',
            'secretsmanager:GetSecretValue',
            'secretsmanager:PutSecretValue',
          ],
          resources: secretArns,
        }),
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            'secretsmanager:ListSecrets',
          ],
          resources: ['*'],
        }),
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            'kms:Encrypt',
            'kms:Decrypt',
            'kms:ReEncrypt*',
            'kms:GenerateDataKey*',
            'kms:DescribeKey',
          ],
          resources: [kmsKeyArn],
        }),
      ],
    });
    return policy;
  }


  createYiviProtectionKey() {
    const key = new kms.Key(this, 'protection-key', {
      description: 'Key for protecting access to secrets for Yivi',
      alias: 'yivi-private-key',
    });

    new ssm.StringParameter(this, 'protection-key-arn', {
      parameterName: Statics.ssmProtectionKeyArn,
      stringValue: key.keyArn,
    });

    return key;

  }

}