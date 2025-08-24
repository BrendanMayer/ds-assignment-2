import * as cdk from 'aws-cdk-lib'
import { Stack, StackProps, RemovalPolicy, Duration, CfnOutput } from 'aws-cdk-lib'
import { Construct } from 'constructs'
import * as s3 from 'aws-cdk-lib/aws-s3'
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb'
import * as sqs from 'aws-cdk-lib/aws-sqs'
import * as s3n from 'aws-cdk-lib/aws-s3-notifications'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as lambda from 'aws-cdk-lib/aws-lambda-nodejs'
import * as node from 'aws-cdk-lib/aws-lambda'
import * as eventsources from 'aws-cdk-lib/aws-lambda-event-sources'
import * as sns from 'aws-cdk-lib/aws-sns'
import * as subs from 'aws-cdk-lib/aws-sns-subscriptions'

export class DsAssignment2Stack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props)

    const bucket = new s3.Bucket(this, 'PhotosBucket', {
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED
    })

    const table = new dynamodb.Table(this, 'ImagesTable', {
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY
    })

    const dlq = new sqs.Queue(this, 'InvalidUploadsDLQ', {
      retentionPeriod: Duration.days(4)
    })

    const uploadsQueue = new sqs.Queue(this, 'UploadsQueue', {
      visibilityTimeout: Duration.seconds(60),
      deadLetterQueue: { maxReceiveCount: 1, queue: dlq }
    })

    bucket.addEventNotification(s3.EventType.OBJECT_CREATED, new s3n.SqsDestination(uploadsQueue))

    uploadsQueue.addToResourcePolicy(new iam.PolicyStatement({
      principals: [new iam.ServicePrincipal('s3.amazonaws.com')],
      actions: ['sqs:SendMessage'],
      resources: [uploadsQueue.queueArn],
      conditions: { ArnEquals: { 'aws:SourceArn': bucket.bucketArn } }
    }))

    const logImage = new lambda.NodejsFunction(this, 'LogImageFn', {
      runtime: node.Runtime.NODEJS_20_X,
      entry: 'lambdas/log-image.ts',
      handler: 'handler',
      environment: { TABLE_NAME: table.tableName }
    })
    table.grantWriteData(logImage)
    logImage.addEventSource(new eventsources.SqsEventSource(uploadsQueue, { batchSize: 1 }))

    const removeImage = new lambda.NodejsFunction(this, 'RemoveImageFn', {
      runtime: node.Runtime.NODEJS_20_X,
      entry: 'lambdas/remove-image.ts',
      handler: 'handler',
      environment: { BUCKET_NAME: bucket.bucketName }
    })
    bucket.grantDelete(removeImage)
    removeImage.addEventSource(new eventsources.SqsEventSource(dlq, { batchSize: 1 }))

    const appTopic = new sns.Topic(this, 'AppTopic', {
      displayName: 'PhotoAppTopic'
    })

    const addMetadata = new lambda.NodejsFunction(this, 'AddMetadataFn', {
      runtime: node.Runtime.NODEJS_20_X,
      entry: 'lambdas/add-metadata.ts',
      handler: 'handler',
      environment: { TABLE_NAME: table.tableName }
    })
    table.grantReadWriteData(addMetadata)

    appTopic.addSubscription(new subs.LambdaSubscription(addMetadata, {
      filterPolicy: {
        metadata_type: sns.SubscriptionFilter.stringFilter({ allowlist: ['Caption', 'Date', 'name'] })
      }
    }))

    new CfnOutput(this, 'BucketName', { value: bucket.bucketName })
    new CfnOutput(this, 'TableName', { value: table.tableName })
    new CfnOutput(this, 'UploadsQueueUrl', { value: uploadsQueue.queueUrl })
    new CfnOutput(this, 'InvalidUploadsDLQUrl', { value: dlq.queueUrl })
    new CfnOutput(this, 'AppTopicArn', { value: appTopic.topicArn })
  }
}
