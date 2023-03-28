import { Stack, StackProps, Stage, StageProps } from 'aws-cdk-lib';
import { DockerImageAsset } from 'aws-cdk-lib/aws-ecr-assets';
import * as ecrdeploy from 'cdk-ecr-deployment';
import { Construct } from 'constructs';
import { Statics } from './Statics';


export class DeploymentStage extends Stage {
  constructor(scope: Construct, id: string, props: StageProps) {
    super(scope, id, props);
    new ContainerStack(this, 'container-build-stack');
  }
}

class ContainerStack extends Stack {

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // Details on how the images is published are hidden.
    // See https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_ecr_assets-readme.html#publishing-images-to-ecr-repositories
    const img = new DockerImageAsset(this, 'yivi-server-image', {
      directory: './src/container',
      buildArgs: {
        BUILD_FOR_ENVIRONMENT: '', // TODO make configurable and use correct configuration in the docker file
      },
    });

    // Construct the target ecr url
    const account = Stack.of(this).account;
    const region = Stack.of(this).region;
    const imageName = `${Statics.projectName}:latest`;
    const ecrTarget = `${account}.dkr.ecr.${region}.amazonaws.com/${imageName}`;

    // Publish by deploying the image to ECR in this account
    new ecrdeploy.ECRDeployment(this, 'deploy-yivi-server-image', {
      src: new ecrdeploy.DockerImageName(img.imageUri),
      dest: new ecrdeploy.DockerImageName(ecrTarget),
    });

  }
}