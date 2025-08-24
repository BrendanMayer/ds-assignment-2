import { SNSEvent } from 'aws-lambda'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb'

const tableName = process.env.TABLE_NAME as string
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}))

export const handler = async (event: SNSEvent) => {
  for (const r of event.Records) {
    const msg = JSON.parse(r.Sns.Message)
    const attr = r.Sns.MessageAttributes || {}
    const mt = attr['metadata_type']?.Value as string
    const id = msg.id as string
    const value = msg.value as string
    if (!id || !value) continue
    if (!mt) continue
    if (!['Caption','Date','name'].includes(mt)) continue
    const name = mt
    const expr = `SET #n = :v`
    await ddb.send(new UpdateCommand({
      TableName: tableName,
      Key: { id },
      UpdateExpression: expr,
      ExpressionAttributeNames: { '#n': name },
      ExpressionAttributeValues: { ':v': value }
    }))
  }
}
