import { PermissionsBoundaryAspect } from '@gemeentenijmegen/aws-constructs';
import * as core from 'aws-cdk-lib';
import {
  Aspects,
  aws_secretsmanager as secretsmanager,
} from 'aws-cdk-lib';
import * as cdkpipelines from 'aws-cdk-lib/pipelines';
import { Construct } from 'constructs';
import { ApiStage } from './ApiStage';
import { Configurable } from './Configuration';
import { DeploymentStage } from './DeploymentStage';
import { Statics } from './Statics';

export interface PipelineStackProps extends core.StackProps, Configurable {}

export class PipelineStack extends core.Stack {


  constructor(scope: Construct, id: string, props: PipelineStackProps) {

    super(scope, id, props);

    Aspects.of(this).add(new PermissionsBoundaryAspect('/', 'landingzone-workload-permissions-boundary'));

    core.Tags.of(this).add('cdkManaged', 'yes');
    core.Tags.of(this).add('project', Statics.projectName);

    //Repo for the main cdk project
    const repository = cdkpipelines.CodePipelineSource.connection(Statics.gitRepository, props.configuration.branchName, {
      connectionArn: props.configuration.codeStarConnectionArn,
    });

    // Construct the pipeline
    const pipeline = this.pipeline(repository, props.configuration.branchName);

    // This stage must have a branch dependent name as it lives in the gn-build account!
    pipeline.addStage(new DeploymentStage(this, `yivi-issue-server-${props.configuration.branchName}-deployment`, {
      configuration: props.configuration,
    }));

    pipeline.addStage(new ApiStage(this, 'yivi-issue-server', {
      configuration: props.configuration,
    }));

    // TODO figure out an request to check if the container is actually live and reachable
    // if (props.runValidationChecks) {
    //   // Setup playright to validate if the deployment was successful
    //   runValidationChecks(fromConfigDeployment, repository, {
    //     ENVIRONMENT: props.branchName,
    //   });
    // }

  }

  pipeline(repository: cdkpipelines.CodePipelineSource, branchName: string) {
    const dockerHubSecret = this.setupDockerhubSecret(branchName);
    const pipeline = new cdkpipelines.CodePipeline(this, 'pipeline', {
      pipelineName: `yivi-issue-server-${branchName}`,
      crossAccountKeys: true,
      synth: new cdkpipelines.ShellStep('Synth', {
        input: repository,
        env: {
          BRANCH_NAME: branchName,
        },
        commands: [
          'yarn install --frozen-lockfile',
          'yarn build',
        ],
      }),
      dockerCredentials: [
        cdkpipelines.DockerCredential.dockerHub(dockerHubSecret),
      ],
    });
    return pipeline;
  }

  setupDockerhubSecret(branchName: string) {
    return new secretsmanager.Secret(this, 'dockerhub-secret', {
      description: 'Dockerhub secret for yivi-brp-issue server',
      secretName: `${Statics.secretDockerhub}/${branchName}`,
    });
  }

}