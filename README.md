# ds-assignment-2

### Commit - 1
I set up a cdk project and added an S3 bucket for photos, a DynamoDB table for images

### Commit - 2
I created an SQS queue with a DLQ, and hooked up S3 events to the queue.

### Commit - 3
I created the Log Image Lambda that reads from the queue, checks file types, and stores valid images in DynamoDB. Invalid files go to the DLQ.

