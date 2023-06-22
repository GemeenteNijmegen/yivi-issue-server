import {
  Stack,
  StackProps,
  aws_route53 as route53,
  aws_ssm as ssm,
} from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Configurable } from './Configuration';
import { Statics } from './Statics';

export interface DnsStackProps extends StackProps, Configurable {}

export class DnsStack extends Stack {

  constructor(scope: Construct, id: string, props: DnsStackProps) {
    super(scope, id, props);

    const accountHzId = ssm.StringParameter.valueForStringParameter(this, Statics.ssmAccountHostedZoneId);
    const accountHzName = ssm.StringParameter.valueForStringParameter(this, Statics.ssmAccountHostedZoneName);
    const accountHz = route53.HostedZone.fromHostedZoneAttributes(this, 'account-hostedzone', {
      hostedZoneId: accountHzId,
      zoneName: accountHzName,
    });

    const hostedzone = new route53.HostedZone(this, 'hostedzone', {
      zoneName: `issue.${accountHz.zoneName}`,
    });

    if (!hostedzone.hostedZoneNameServers) {
      throw Error('No name servers!');
    }
    new route53.ZoneDelegationRecord(this, 'delegate', {
      zone: accountHz,
      nameServers: hostedzone.hostedZoneNameServers,
      recordName: 'issue',
    });

    new ssm.StringParameter(this, 'ssm-hz-id', {
      parameterName: Statics.ssmHostedZoneId,
      stringValue: hostedzone.hostedZoneId,
    });

    new ssm.StringParameter(this, 'ssm-hz-name', {
      parameterName: Statics.ssmHostedZoneName,
      stringValue: hostedzone.zoneName,
    });

    // TODO add DNSEC (us-east-1)


  }

}