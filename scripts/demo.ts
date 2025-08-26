import { readFileSync } from 'fs'
import path from 'path'
import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb'

function loadOutputs() {
  const p1 = path.resolve(__dirname, '..', 'stack-outputs.json')
  const p2 = path.resolve(process.cwd(), 'stack-outputs.json')
  let raw = ''
  try { raw = readFileSync(p1, 'utf-8') } catch {}
  if (!raw) { try { raw = readFileSync(p2, 'utf-8') } catch {} }
  if (!raw || raw.trim() === '') throw new Error('stack-outputs.json not found or empty')
  const j = JSON.parse(raw)
  if (!j.DsAssignment2Stack) throw new Error('missing DsAssignment2Stack in outputs')
  return j.DsAssignment2Stack
}

const outs = loadOutputs()
const bucket = outs.BucketName as string
const tableName = outs.TableName as string
const topicArn = outs.AppTopicArn as string

const s3 = new S3Client({})
const sns = new SNSClient({})
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}))

function wait(ms: number) { return new Promise(r => setTimeout(r, ms)) }

async function exists(key: string) {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }))
    return true
  } catch {
    return false
  }
}

async function waitForDelete(key: string, timeoutMs = 60000, intervalMs = 3000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (!(await exists(key))) return true
    await wait(intervalMs)
  }
  return false
}

async function upload(key: string) {
  await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: Buffer.from('x') }))
}

async function addMeta(id: string, t: 'Caption'|'Date'|'name', v: string) {
  await sns.send(new PublishCommand({
    TopicArn: topicArn,
    Message: JSON.stringify({ id, value: v }),
    MessageAttributes: { metadata_type: { DataType: 'String', StringValue: t } }
  }))
}

async function modUpdate(id: string, status: 'Pass'|'Reject', reason: string, date: string) {
  await sns.send(new PublishCommand({
    TopicArn: topicArn,
    Message: JSON.stringify({ id, date, update: { status, reason } })
  }))
}

async function getItem(id: string) {
  const r = await ddb.send(new GetCommand({ TableName: tableName, Key: { id } }))
  return r.Item || null
}

async function runSetup(id: string) {
  console.log('uploading valid and invalid files...')
  await upload(id)
  await upload('bad.txt')
  await wait(8000)
  const item = await getItem(id)
  const deleted = await waitForDelete('bad.txt', 60000, 3000)
  console.log({ setupItem: item, invalidDeletedFromBucket: deleted })
}

async function runMeta(id: string) {
  await addMeta(id, 'Caption', 'test caption')
  await addMeta(id, 'Date', '01/05/2025')
  await addMeta(id, 'name', 'Brendan')
  await wait(6000)
  console.log({ afterMeta: await getItem(id) })
}

async function runStatus(id: string, s: 'Pass'|'Reject') {
  await modUpdate(id, s, s === 'Pass' ? 'ok' : 'blurry', s === 'Pass' ? '01/05/2025' : '02/05/2025')
  await wait(6000)
  console.log({ afterStatus: await getItem(id) })
}

async function main() {
  const step = process.argv[2] || 'all'
  const id = process.argv[3] || 'image1.jpeg'
  if (step === 'setup') { await runSetup(id); return }
  if (step === 'meta') { await runMeta(id); return }
  if (step === 'status-pass') { await runStatus(id, 'Pass'); return }
  if (step === 'status-reject') { await runStatus(id, 'Reject'); return }
  await runSetup(id)
  await runMeta(id)
  await runStatus(id, 'Reject')
}

main()
