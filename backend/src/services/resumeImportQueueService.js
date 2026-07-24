import { DeleteMessageCommand, ReceiveMessageCommand, SendMessageCommand, SQSClient } from '@aws-sdk/client-sqs';
import { env } from '../config/env.js';

const sqsClient = env.queueProvider === 'sqs' && env.awsSqsResumeImportQueueUrl
  ? new SQSClient({
      region: env.awsRegion,
    })
  : null;

export async function enqueueResumeImportTaskMessage(taskId) {
  if (!sqsClient || !env.awsSqsResumeImportQueueUrl) return null;

  return sqsClient.send(new SendMessageCommand({
    QueueUrl: env.awsSqsResumeImportQueueUrl,
    MessageBody: JSON.stringify({ taskId }),
  }));
}

export async function receiveResumeImportTaskMessages(maxNumberOfMessages = 1) {
  if (!sqsClient || !env.awsSqsResumeImportQueueUrl) return [];

  const response = await sqsClient.send(new ReceiveMessageCommand({
    QueueUrl: env.awsSqsResumeImportQueueUrl,
    MaxNumberOfMessages: Math.min(10, Math.max(1, maxNumberOfMessages)),
    WaitTimeSeconds: 5,
    VisibilityTimeout: Math.max(30, env.workerPollIntervalMs / 1000),
  }));

  return response.Messages || [];
}

export async function deleteResumeImportTaskMessage(receiptHandle) {
  if (!sqsClient || !env.awsSqsResumeImportQueueUrl || !receiptHandle) return null;
  return sqsClient.send(new DeleteMessageCommand({
    QueueUrl: env.awsSqsResumeImportQueueUrl,
    ReceiptHandle: receiptHandle,
  }));
}
