
import {
  Stack,
  StackProps,
  aws_apigateway as apigateway,
  aws_iam as iam,
} from 'aws-cdk-lib';
import { Effect } from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import { Configuration } from './Configuration';

export interface ApiStackProps extends StackProps, Configuration { }

export class ApiStack extends Stack {

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    /**
     * A API resource policy to only allow pre configured resource ARNS (roles)
     * to access the /session endpoint
     * - API Gateway authorization flow https://docs.aws.amazon.com/apigateway/latest/developerguide/apigateway-authorization-flow.html
     * - Resource policy examples: https://docs.aws.amazon.com/apigateway/latest/developerguide/apigateway-resource-policies-examples.html
     */
    const apiResourcePolicy = new iam.PolicyDocument({
      statements: [
        new iam.PolicyStatement({
          effect: Effect.ALLOW,
          principals: props.sessionEndpointAllowList.map(arn => new iam.ArnPrincipal(arn)),
          actions: ['execute-api:Invoke'],
          resources: ['execute-api:/session'],
          conditions: {
            // TODO check which conditions we can apply
          },
        }),
      ],
    });

    // Use apigateway (v1/RestApi) for WAF integration, and resource policies
    const api = new apigateway.RestApi(this, 'yivi-issue-server', {
      description: 'Yivi issue server',
      policy: apiResourcePolicy,
    });


    this.setupIrmaEndpoint(api);
    this.setupSessionEndpoint(api);

  }

  /**
   * Add the /irma path to the API gateway
   * Allow all ANY http request
   * @param api
   */
  setupIrmaEndpoint(api: apigateway.RestApi) {

    const integration = new apigateway.Integration({
      type: apigateway.IntegrationType.HTTP_PROXY,
      integrationHttpMethod: 'ANY',
      options: {
        connectionType: apigateway.ConnectionType.VPC_LINK,
        requestParameters: {
          'integration.request.path.proxy': 'method.request.path.proxy',
        },
      },
    });

    const methodConfiguration = {
      authorizationType: apigateway.AuthorizationType.NONE,
    };

    const irma = api.root.addResource('/irma/{proxy+}');
    irma.addMethod('ANY', integration, methodConfiguration);
  }

  /**
   * Allowed requests:
   * - /session POST
   * - /session/{token} DELETE
   * - /session/{token}/result GET
   * - /session/{token}/status GET
   * - /session/{token}/statusevents GET
   * @param api
   */
  setupSessionEndpoint(api: apigateway.RestApi) {
    const session = api.root.addResource('/session');
    const sessionToken = session.addResource('{token}');
    session.addMethod('POST');
    sessionToken.addMethod('DELETE');
    sessionToken.addResource('/result').addMethod('GET');
    sessionToken.addResource('/status').addMethod('GET');
    sessionToken.addResource('/statusevents').addMethod('GET');
  }

}