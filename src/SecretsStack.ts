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

    // Secret private key for YIVI issue server
    const key = this.createYiviProtectionKey();

    const apiKey = new secrets.Secret(this, 'api-key', {
      secretName: Statics.secretsApiKey,
      description: 'API KEY for YIVI issue server',
      encryptionKey: key,
    });

    const privateKey = new secrets.Secret(this, 'private-key', {
      secretName: Statics.secretsPrivateKey,
      description: 'Private key for YIVI issue server',
      encryptionKey: key,
    });

    // Deny access to secret for all requests except yivi-adminsitrator
    this.allowManagementOfSecret(apiKey);
    this.allowManagementOfSecret(privateKey);

    this.createAdminPolicy(key.keyArn, privateKey.secretArn, apiKey.secretArn);
  }

  allowManagementOfSecret(secret: secrets.Secret) {
    const account = Stack.of(this).account;
    const region = Stack.of(this).region;
    secret.addToResourcePolicy(new iam.PolicyStatement({
      effect: iam.Effect.DENY,
      principals: [new iam.AnyPrincipal()],
      actions: ['secretsmanager:*'],
      resources: ['*'],
      conditions: {
        ArnNotLike: {
          'aws:PrincipalArn': [
            `arn:aws:iam::${account}:role/aws-reserved/sso.amazonaws.com/${region}/AWSReservedSSO_yivi-admin*`,
            `arn:aws:iam::${account}:role/cdk-hnb659fds-cfn-exec-role-${account}-${region}`,
            `arn:aws:iam::${account}:role/${Statics.yiviContainerTaskExecutionRoleName}`, // Allow the ECS task to access this secret aswell
          ],
        },
      },
    }));
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