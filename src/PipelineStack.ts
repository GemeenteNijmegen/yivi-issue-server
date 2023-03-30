import * as core from 'aws-cdk-lib';
import {
  Aspects,
  aws_codecommit as codecommit,
} from 'aws-cdk-lib';
import * as cdkpipelines from 'aws-cdk-lib/pipelines';
import { Construct } from 'constructs';
import { ApiStage } from './ApiStage';
import { PermissionsBoundaryAspect } from './Aspect';
import { Configuration } from './Configuration';
import { Statics } from './Statics';

export interface PipelineStackProps extends core.StackProps {
  configuration: Configuration;
  emptyPipeline: boolean;
}

export class PipelineStack extends core.Stack {


  constructor(scope: Construct, id: string, props: PipelineStackProps) {

    super(scope, id, props);

    Aspects.of(this).add(new PermissionsBoundaryAspect('/', 'landingzone-workload-permissions-boundary'));

    core.Tags.of(this).add('cdkManaged', 'yes');
    core.Tags.of(this).add('project', Statics.projectName);

    //Repo for the main cdk project
    // const repository = cdkpipelines.CodePipelineSource.connection(Statics.gitRepository, props.configuration.branchName, {
    //   connectionArn: Statics.codeStarconnectionArnGnBuildNewLz,
    // });
    const repository = new codecommit.Repository(this, `${Statics.projectName}-repository`, {
      repositoryName: `${Statics.projectName}`,
      description: 'CDK test with yivi-issue-server codebase',
    });

    // Construct the pipeline
    const pipeline = new cdkpipelines.CodePipeline(this, 'pipeline', {
      pipelineName: `yivi-issue-server-${props.configuration.branchName}`,
      crossAccountKeys: true,
      synth: new cdkpipelines.ShellStep('Synth', {
        input: cdkpipelines.CodePipelineSource.codeCommit(repository, 'development'),
        env: {
          BRANCH_NAME: props.configuration.branchName,
        },
        commands: [
          'yarn install --frozen-lockfile',
          'yarn build',
        ],
      }),
    });

    // pipeline.addStage(new DeploymentStage(this, 'yivi-issue-server-deployment', {
    //   configuration: props.configuration,
    // }));

    // if (!props.emptyPipeline) {
    pipeline.addStage(new ApiStage(this, 'yivi-issue-server', {
      ...props.configuration,
    }));
    // }

    // TODO figure out an request to check if the container is actually live and reachable
    // if (props.runValidationChecks) {
    //   // Setup playright to validate if the deployment was successful
    //   runValidationChecks(fromConfigDeployment, repository, {
    //     ENVIRONMENT: props.branchName,
    //   });
    // }

  }
}