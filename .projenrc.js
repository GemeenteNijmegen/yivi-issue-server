const { GemeenteNijmegenCdkApp } = require('@gemeentenijmegen/projen-project-type');
const { GithubCredentials } = require('projen/lib/github');
const project = new GemeenteNijmegenCdkApp({
  cdkVersion: '2.1.0',
  defaultReleaseBranch: 'main',
  name: 'yivi-issue-server',
  deps: [
    '@gemeentenijmegen/projen-project-type',
    '@gemeentenijmegen/aws-constructs',
    'cdk-nag',
    'cdk-remote-stack',
  ],
  githubOptions: {
    mergify: false,
    projenCredentials: GithubCredentials.fromApp(),
  },
  // deps: [],                /* Runtime dependencies of this module. */
  // description: undefined,  /* The description is just a string that helps people understand the purpose of the package. */
  // packageName: undefined,  /* The "name" in package.json. */
});
project.synth();