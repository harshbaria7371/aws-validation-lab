import {
  S3Client,
  CreateBucketCommand,
  PutObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
  DeleteBucketCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";

// Configure the S3 Client for the localstack endpoint
export const s3Client = new S3Client({
  region: process.env.AWS_REGION || "us-east-1",
  endpoint: process.env.AWS_ENDPOINT_URL || "http://localhost:4566",
  forcePathStyle: true, // Required for LocalStack and mock endpoints
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "test",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "test",
  },
});

/**
 * Creates a new S3 bucket.
 * @param bucketName Name of the bucket to create
 */
export async function createBucket(bucketName: string): Promise<void> {
  const command = new CreateBucketCommand({
    Bucket: bucketName,
  });
  await s3Client.send(command);
}

/**
 * Uploads a file to an S3 bucket.
 * @param bucketName Name of the bucket
 * @param key Object key (file path)
 * @param body Content of the file
 */
export async function uploadFile(bucketName: string, key: string, body: string): Promise<void> {
  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    Body: body,
  });
  await s3Client.send(command);
}

/**
 * Checks if a file exists in the S3 bucket.
 * @param bucketName Name of the bucket
 * @param key Object key (file path)
 * @returns boolean indicating if the file exists
 */
export async function checkFileExists(bucketName: string, key: string): Promise<boolean> {
  const command = new HeadObjectCommand({
    Bucket: bucketName,
    Key: key,
  });
  try {
    await s3Client.send(command);
    return true;
  } catch (error: any) {
    if (error.name === "NotFound") {
      return false;
    }
    throw error;
  }
}

/**
 * Deletes a bucket and all of its contents.
 * Recursively deletes objects before deleting the bucket itself.
 * @param bucketName Name of the bucket to delete
 */
export async function deleteBucketAndContents(bucketName: string): Promise<void> {
  try {
    let continuationToken: string | undefined = undefined;

    do {
      const listCommand = new ListObjectsV2Command({
        Bucket: bucketName,
        ContinuationToken: continuationToken,
      });
      const listResult = await s3Client.send(listCommand) as any;

      if (listResult.Contents && listResult.Contents.length > 0) {
        for (const object of listResult.Contents) {
          if (object.Key) {
            const deleteObjCommand = new DeleteObjectCommand({
              Bucket: bucketName,
              Key: object.Key,
            });
            await s3Client.send(deleteObjCommand);
          }
        }
      }

      continuationToken = listResult.NextContinuationToken;
    } while (continuationToken);

    const deleteBucketCmd = new DeleteBucketCommand({
      Bucket: bucketName,
    });
    await s3Client.send(deleteBucketCmd);
  } catch (error: any) {
    if (error.name !== "NoSuchBucket") {
      throw error;
    }
  }
}
