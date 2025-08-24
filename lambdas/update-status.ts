import { SNSEvent } from 'aws-lambda'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb'

const tableName = process.env.TABLE_NAME as string
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}))

function okStatus(s: string) {
  return s === 'Pass' || s === 'Reject'
}

export const handler = async (event: SNSEvent) => {
  for (const r of event.Records) {
    const msg = JSON.parse(r.Sns.Message)
    const id = msg.id as string
    const date = msg.date as string
    const status = msg.update?.status as string
    const reason = msg.update?.reason as string
    if (!id || !okStatus(status)) continue
    await ddb.send(new UpdateCommand({
      TableName: tableName,
      Key: { id },
      UpdateExpression: 'SET #s = :s, #r = :r, #d = :d',
      ExpressionAttributeNames: { '#s': 'status', '#r': 'reason', '#d': 'statusDate' },
      ExpressionAttributeValues: { ':s': status, ':r': reason || '', ':d': date || '' }
    }))
  }
}
