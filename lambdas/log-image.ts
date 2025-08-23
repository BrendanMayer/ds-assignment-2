import { SQSEvent } from 'aws-lambda'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb'

const tableName = process.env.TABLE_NAME as string
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}))

function isValid(key: string) {
  const lower = key.toLowerCase()
  return lower.endsWith('.jpeg') || lower.endsWith('.jpg') || lower.endsWith('.png')
}

export const handler = async (event: SQSEvent) => {
  for (const rec of event.Records) {
    const body = JSON.parse(rec.body)
    const s3rec = body.Records[0]
    const key = decodeURIComponent(s3rec.s3.object.key.replace(/\+/g, ' '))
    if (!isValid(key)) {
      throw new Error('invalid file type')
    }
    const id = key
    await ddb.send(new PutCommand({ TableName: tableName, Item: { id } }))
  }
}
