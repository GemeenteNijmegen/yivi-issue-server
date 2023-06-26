import { App } from 'aws-cdk-lib';
// import { Template } from "aws-cdk-lib/assertions";
import { Template } from 'aws-cdk-lib/assertions';
import { ApiStage } from '../src/ApiStage';
import { Configuration } from '../src/Configuration';
import { Statics } from '../src/Statics';

const dummyEnv = {
  account: '123456789012',
  region: 'eu-west-1',
};

const testConfiguration: Configuration = {
  branchName: 'test',
  codeStarConnectionArn: '',
  deployFromEnvironment: dummyEnv,
  deployToEnvironment: dummyEnv,
  sessionEndpointAllowList: [],
  sessionEndpointIamUser: true,
  yiviVersionChecksum: 'weugiwegweh',
  yiviVersionNumber: 'v0.1.13.0',
};


describe('Private key protection', () => {

  const app = new App();
  const stage = new ApiStage(app, 'test', {
    configuration: testConfiguration,
  });

  test('Private key access is not used by other stacks', () => {

    const parameterStack = stage.stacks.find(stack => stack.node.id === 'secrets-stack');
    const clusterStack = stage.stacks.find(stack => stack.node.id === 'cluster-stack');
    if (!parameterStack || !clusterStack) {
      throw new Error('Parameter or cluster stack not found');
    }
    const priveteKeyResource = Template.fromStack(parameterStack).findResources('AWS::SecretsManager::Secret', {
      Properties: {
        Description: 'Private key for YIVI issue server',
      },
    });

    const id = Object.keys(priveteKeyResource)[0];
    const resource = priveteKeyResource[id];

    // Check for KMS key
    expect(resource.Properties.KmsKeyId).toBeDefined();

    // Check if the secret is not referenced in any other stack than the parameter and cluster stack
    stage.stacks.forEach(stack => {
      const template = Template.fromStack(stack);
      const templateStr = JSON.stringify(template.toJSON());
      if (stack.node.id !== 'cluster-stack' && stack.node.id !== 'secrets-stack') {
        expect(templateStr).not.toContain(Statics.secretsPrivateKey);
      }
    });

  });


  test('Private key policy', () => {

    const expectedPolicy = {
      Statement: [
        {
          Action: 'secretsmanager:*',
          Condition: {
            'ForAnyValue:ArnNotLike': {
              'aws:PrincipalArn': [
                // Alow the Yivi admin federated role from SSO to manage the secret
                'arn:aws:iam::123456789012:role/aws-reserved/sso.amazonaws.com/eu-west-1/AWSReservedSSO_yivi-admin*',
                // CDK role must be allowed to managed otherwise cloudformation will fail deployment.
                'arn:aws:iam::123456789012:role/cdk-hnb659fds-cfn-exec-role-123456789012-eu-west-1',
                // The ECS task execution role must be allowed to get the secret
                `arn:aws:iam::123456789012:role/${Statics.yiviContainerTaskExecutionRoleName}`,
              ],
            },
          },
          Effect: 'Deny',
          Principal: {
            AWS: '*',
          },
          Resource: '*',
        },
      ],
      Version: '2012-10-17',
    };

    const parameterStack = stage.stacks.find(stack => stack.node.id === 'secrets-stack');
    if (!parameterStack) {
      throw new Error('Parametes stack not found');
    }
    const priveteKeyResource = Template.fromStack(parameterStack).findResources('AWS::SecretsManager::Secret', {
      Properties: {
        Description: 'Private key for YIVI issue server',
      },
    });
    const id = Object.keys(priveteKeyResource)[0];
    const priveteKeyPolicyResource = Template.fromStack(parameterStack).findResources('AWS::SecretsManager::ResourcePolicy', {
      Properties: {
        SecretId: {
          Ref: id,
        },
      },
    });

    // Check if the policy is as expected
    const policyId = Object.keys(priveteKeyPolicyResource)[0];
    const policy = priveteKeyPolicyResource[policyId].Properties.ResourcePolicy;
    expect(policy).toMatchObject(expectedPolicy);

  });


});