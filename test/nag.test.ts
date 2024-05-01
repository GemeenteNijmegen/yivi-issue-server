import { App, Aspects, Stack } from 'aws-cdk-lib';
import { Annotations, Match } from 'aws-cdk-lib/assertions';
import { SynthesisMessage } from 'aws-cdk-lib/cx-api';
import { AwsSolutionsChecks } from 'cdk-nag';
import { ApiStage } from '../src/ApiStage';
import { Criticality } from '../src/Criticality';
import { Statics } from '../src/Statics';

const dummyEnv = {
  account: '123456789012',
  region: 'eu-west-1',
};


test('ApiStage cdk-nag', () => {

  const app = new App();

  const stage = new ApiStage(app, 'test-stage', {
    configuration: {
      branchName: 'test',
      deployToEnvironment: dummyEnv,
      deployFromEnvironment: dummyEnv,
      codeStarConnectionArn: Statics.codeStarConnectionArn,
      sessionEndpointAllowList: [],
      sessionEndpointIamUser: true,
      yiviVersionChecksum: 'weiweojgwoei23',
      yiviVersionNumber: 'v0.1.2',
      alpineLinuxVersion: 'v0.1.2',
      criticality: new Criticality('high'),
    },
  });

  stage.stacks.forEach(stack => {
    Aspects.of(stack).add(new AwsSolutionsChecks());
    checkNagStack(stack);
  });

});

function checkNagStack(stack: Stack) {
  const warnings = Annotations.fromStack(stack).findWarning('*', Match.stringLikeRegexp('AwsSolutions-.*'));
  const errors = Annotations.fromStack(stack).findError('*', Match.stringLikeRegexp('AwsSolutions-.*'));
  parseAnnotations(warnings, stack.stackName, console.warn);
  parseAnnotations(errors, stack.stackName, console.error);
  //expect(`warning count ${warnings.length}`).toBe(`warning count 0`);
  //expect(`error count ${errors.length}`).toBe(`error count 0`);
}

function parseAnnotations(annotations: SynthesisMessage[], stackName: string, logFn: any) {
  const notifications = annotations.map(w => {
    return {
      msg: w.entry.data,
      id: w.id,
    };
  });
  if (notifications && notifications.length > 0) {
    logFn('Warnings in stack ', stackName);
    logFn(JSON.stringify(notifications, null, 4));
  }
}