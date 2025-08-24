import { SNSEvent } from 'aws-lambda'
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses'

const ses = new SESClient({})
const toEmail = process.env.TO_EMAIL as string
const fromEmail = process.env.FROM_EMAIL as string

export const handler = async (event: SNSEvent) => {
  for (const r of event.Records) {
    const msg = JSON.parse(r.Sns.Message)
    const id = msg.id as string
    const status = msg.update?.status as string
    const reason = msg.update?.reason as string
    const subject = `Status for ${id}: ${status}`
    const body = `Image: ${id}\nStatus: ${status}\nReason: ${reason || ''}`
    await ses.send(new SendEmailCommand({
      Destination: { ToAddresses: [toEmail] },
      Message: { Subject: { Data: subject }, Body: { Text: { Data: body } } },
      Source: fromEmail
    }))
  }
}
