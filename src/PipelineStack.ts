import * as core from 'aws-cdk-lib';
import * as cdkpipelines from 'aws-cdk-lib/pipelines';
import { Construct } from 'constructs';
import { ApiStage } from './ApiStage';
import { Configuration } from './Configuration';
import { Statics } from './Statics';

export interface PipelineStackProps extends core.StackProps {
  configuration: Configuration;
  emptyPipeline: boolean;
}

export class PipelineStack extends core.Stack {

  constructor(scope: Construct, id: string, props: PipelineStackProps) {
    super(scope, id, props);
    core.Tags.of(this).add('cdkManaged', 'yes');
    core.Tags.of(this).add('project', Statics.projectName);

    //Repo for the main cdk project
    const repository = cdkpipelines.CodePipelineSource.connection(Statics.gitRepository, props.configuration.branchName, {
      connectionArn: props.configuration.codeStarConnectionArn,
    });

    // Construct the pipeline
    const pipeline = new cdkpipelines.CodePipeline(this, 'pipeline', {
      pipelineName: `yivi-issue-server-${props.configuration.branchName}`,
      crossAccountKeys: true,
      synth: new cdkpipelines.ShellStep('Synth', {
        input: repository,
        env: {
          BRANCH_NAME: props.configuration.branchName,
        },
        commands: [
          'yarn install --frozen-lockfile',
          'yarn build',
        ],
      }),
    });

    if (!props.emptyPipeline) {
      pipeline.addStage(new ApiStage(this, 'yivi-issue-server', {
        ...props.configuration,
      }));
    }

    // TODO figure out an request to check if the container is actually live and reachable
    // if (props.runValidationChecks) {
    //   // Setup playright to validate if the deployment was successful
    //   runValidationChecks(fromConfigDeployment, repository, {
    //     ENVIRONMENT: props.branchName,
    //   });
    // }

  }
}