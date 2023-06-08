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
    const key = new kms.Key(this, 'key', {
      policy: new iam.PolicyDocument({
        statements: [

          new iam.PolicyStatement({
            sid: 'AllowAttachmentOfPersistentResources',
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
              sid: 'Allow use of the key',
              effect: iam.Effect.ALLOW,
              principals: [
                new iam.ArnPrincipal('irma_ecs_role'), // TODO get role ARN
                new iam.ArnPrincipal('irma_key_admin'), // TODO get irma key admin ARN
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
      // admins: [] // TODO check who can be admins?
    });

    new kms.Alias(this, 'alias', {
      aliasName: 'yivi-issue-key',
      targetKey: key,
    });

    return key;

  }
}