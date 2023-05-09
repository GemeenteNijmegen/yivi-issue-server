import { Aspects, Stack, StackProps, Stage, StageProps, Tags, aws_ecr as ecr, aws_iam as iam } from 'aws-cdk-lib';
import { DockerImageAsset } from 'aws-cdk-lib/aws-ecr-assets';
import * as ecrdeploy from 'cdk-ecr-deployment';
import { Construct } from 'constructs';
import { PermissionsBoundaryAspect } from './Aspect';
import { Configuration } from './Configuration';
import { Statics } from './Statics';

export interface DeploymentStageProps extends StageProps {
  configuration: Configuration;
}

export class DeploymentStage extends Stage {
  constructor(scope: Construct, id: string, props: DeploymentStageProps) {
    super(scope, id, props);
    new ContainerStack(this, 'container-build-stack', {
      ...props.configuration,
    });
  }
}

interface DeploymentStackProps extends StackProps, Configuration { }

class ContainerStack extends Stack {

  constructor(scope: Construct, id: string, props: DeploymentStackProps) {
    super(scope, id, props);

    Aspects.of(this).add(new PermissionsBoundaryAspect('/', 'landingzone-workload-permissions-boundary'));

    const repositoryName = `yivi-issue-server-${props.branchName}`;
    this.createRepository(repositoryName, props);
    const img = this.buildContainer(props);
    this.moveImageToRepository(repositoryName, img);

  }

  createRepository(repositoryName: string, props: DeploymentStackProps) {
    // Create the image repository in deployment account
    const repository = new ecr.Repository(this, 'repository', {
      imageScanOnPush: true,
      repositoryName: repositoryName,
    });

    // Allow the account to which we deploy to pull the images from this repository
    repository.addToResourcePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      principals: [new iam.AccountPrincipal(props.deployToEnvironment.account)],
      actions: [
        'ecr:BatchGetImage',
        'ecr:GetDownloadUrlForLayer',
      ],
    }));
  }

  buildContainer(props: DeploymentStackProps) {
    // Details on how the images is published are hidden.
    // See https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_ecr_assets-readme.html#publishing-images-to-ecr-repositories
    const img = new DockerImageAsset(this, 'image', {
      directory: './src/container',
      buildArgs: {
        BUILD_FOR_ENVIRONMENT: props.branchName,
      },
    });
    Tags.of(img).add('image', Statics.projectName);
    return img;
  }

  moveImageToRepository(repositoryName: string, image: DockerImageAsset) {
    // Construct the target ecr url
    const account = Stack.of(this).account;
    const region = Stack.of(this).region;
    const ecrTarget = `${account}.dkr.ecr.${region}.amazonaws.com/${repositoryName}:latest`;

    // Publish by deploying the image to ECR in this account
    new ecrdeploy.ECRDeployment(this, 'deploy-image', {
      src: new ecrdeploy.DockerImageName(image.imageUri),
      dest: new ecrdeploy.DockerImageName(ecrTarget),
    });
  }


}