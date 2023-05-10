import {
  Aspects,
  Stack,
  StackProps,
  Stage,
  StageProps,
  Tags,
  aws_ecr as ecr,
  aws_iam as iam,
  aws_events_targets as targets,
  aws_sns as sns,
} from 'aws-cdk-lib';
import { DockerImageAsset } from 'aws-cdk-lib/aws-ecr-assets';
import * as ecrdeploy from 'cdk-ecr-deployment';
import { Construct } from 'constructs';
import { PermissionsBoundaryAspect } from './Aspect';
import { Configurable, Configuration } from './Configuration';
import { Statics } from './Statics';

export interface DeploymentStageProps extends StageProps, Configurable {
  configuration: Configuration;
}

export class DeploymentStage extends Stage {
  constructor(scope: Construct, id: string, props: DeploymentStageProps) {
    super(scope, id, props);
    new ContainerStack(this, 'stack', {
      configuration: props.configuration,
    });
  }
}

interface DeploymentStackProps extends StackProps, Configurable { }

class ContainerStack extends Stack {

  constructor(scope: Construct, id: string, props: DeploymentStackProps) {
    super(scope, id, props);

    Aspects.of(this).add(new PermissionsBoundaryAspect('/', 'landingzone-workload-permissions-boundary'));

    const repositoryName = `yivi-issue-server-${props.configuration.branchName}`;
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
    repository.addLifecycleRule({ description: 'Max 15 images', maxImageCount: 15 });

    // Setup notifications for findings
    // TODO find out if this is needed as we'll catch inspector findings from eventbridge aswell
    const topic = sns.Topic.fromTopicArn(this, 'topic', Statics.notificationTopicArn(this.account, 'medium'));
    repository.onImageScanCompleted('scan-complete', {
      description: 'Image scan complete notification',
      target: new targets.SnsTopic(topic),
    });

    // Allow the account to which we deploy to pull the images from this repository
    repository.addToResourcePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      principals: [new iam.AccountPrincipal(props.configuration.deployToEnvironment.account)],
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
        BUILD_FOR_ENVIRONMENT: props.configuration.branchName,
        IRMA_VERSION: props.configuration.yiviVersionNumber,
        IRMA_CHECKSUM: props.configuration.yiviVersionChecksum,
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