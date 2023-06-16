# Yivi issue container
This repository contains the IaC and documentation around the Yivi issue container used for issing BRP attributes for the Yivi-app.
Note, this is only the Yivi backend (using irmago wrapped in a container), the interactive webapp can be found in the yivi-issue-app repo.


## Pipeline setup
The CDK CodePipeline deploys two stages

### Deployment stage
This stage is deployed to the gn-build account and is responsible for the ECR and CodeBuild project.

The container is build in the deployment account using the ECR fromAssets CKD function. This will put it in the CDK managed ECR repository. Therefore, it is copied using a custom resource to the desired ECR repository managed by this project.

### Api stage
The other stages deploys the required resources for hosting the container.
Contains:
- Secrets and parameters 
- DNS setup
- ECS cluster, NLB, Fargate service
- Api gateway (REST API), we use the Rest API as we need integration with the WAF, Resource policies (scoped authenticaiton without IAM user between webapp and gateway)

## Private key protection
The private key (secretmanager secret) is protected its resource policy and encrypted using an additional KMS key. The secrets explicitly denies access for normal platform users and only allows the CDK role and the yivi-admin federated user role to view and set the secret.
- [The secret is defined here](./src/ParameterStack.ts)
- In the ContainerClusterStack the execution role that is associated with the fargate service (the container) is granted access to the secret and kms key.

