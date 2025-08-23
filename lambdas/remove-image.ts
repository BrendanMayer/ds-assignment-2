import { SQSEvent } from 'aws-lambda'
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3'

const s3 = new S3Client({})
const bucket = process.env.BUCKET_NAME as string

export const handler = async (event: SQSEvent) => {
  for (const rec of event.Records) {
    const body = JSON.parse(rec.body)
    const s3rec = body.Records[0]
    const key = decodeURIComponent(s3rec.s3.object.key.replace(/\+/g, ' '))
    await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))
  }
}
