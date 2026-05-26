import { test, expect } from '@playwright/test';
import { randomUUID } from 'crypto';
import {
  createBucket,
  uploadFile,
  checkFileExists,
  deleteBucketAndContents,
  s3Client
} from '../support/utils/s3-helper';
import { GetObjectCommand } from '@aws-sdk/client-s3';

test.describe('Amazon S3 Integration Tests', () => {
  // Use a dynamic bucket name to avoid collisions across test runs
  let bucketName: string;

  test.beforeAll(async () => {
    bucketName = `automation-sandbox-${randomUUID()}`;
    await createBucket(bucketName);
  });

  test.afterAll(async () => {
    // Cleanup the bucket to avoid accumulating costs/data
    await deleteBucketAndContents(bucketName);
  });

  test('should successfully complete the S3 Object Lifecycle (Upload, Verify, Delete)', async () => {
    const objectKey = 'test-runs/run-101/execution_result.json';
    const mockFileContent = JSON.stringify({ status: 'passed', tests: 42 });

    // 1. Verify file does not exist initially
    let exists = await checkFileExists(bucketName, objectKey);
    expect(exists).toBeFalsy();

    // 2. Upload the file
    await uploadFile(bucketName, objectKey, mockFileContent);

    // 3. Verify the file exists
    exists = await checkFileExists(bucketName, objectKey);
    expect(exists).toBeTruthy();

    // The cleanup of this specific object will be handled by the teardown (deleteBucketAndContents),
    // but in a more granular test, we could explicitly delete it here.
  });

  test('should overwrite an existing object without versioning enabled', async () => {
    const objectKey = 'config/settings.json';
    const initialContent = JSON.stringify({ theme: 'dark' });
    const newContent = JSON.stringify({ theme: 'light' });

    // 1. Upload initial file
    await uploadFile(bucketName, objectKey, initialContent);

    // Verify it exists
    const exists = await checkFileExists(bucketName, objectKey);
    expect(exists).toBeTruthy();

    // 2. Upload the new file to the same key
    await uploadFile(bucketName, objectKey, newContent);

    // 3. Verify the content was updated (overwritten)
    const getCommand = new GetObjectCommand({
      Bucket: bucketName,
      Key: objectKey,
    });

    const response = await s3Client.send(getCommand);
    const bodyStr = await response.Body?.transformToString();

    expect(bodyStr).toBe(newContent);
  });

  test('EDGE CASE 1: should handle object keys with special characters and spaces', async () => {
    // S3 keys can be any UTF-8 string, but spaces and special characters often break poorly written automation
    const specialKey = 'docs/user resumes/John+Doe_Resume(!@#).txt';
    const content = 'Test Resume';

    await uploadFile(bucketName, specialKey, content);

    const exists = await checkFileExists(bucketName, specialKey);
    expect(exists).toBeTruthy();

    const getCommand = new GetObjectCommand({ Bucket: bucketName, Key: specialKey });
    const response = await s3Client.send(getCommand);
    const bodyStr = await response.Body?.transformToString();

    expect(bodyStr).toBe(content);
  });

  test('EDGE CASE 2: should throw NoSuchKey error when retrieving a non-existent object', async () => {
    const missingKey = 'i-do-not-exist.json';

    const getCommand = new GetObjectCommand({ Bucket: bucketName, Key: missingKey });

    // Attempting to get a non-existent object throws a NoSuchKey exception
    // The AWS SDK / LocalStack returns the message "The specified key does not exist."
    await expect(s3Client.send(getCommand)).rejects.toThrow(/The specified key does not exist/);
  });

  test('EDGE CASE 3: should silently succeed when deleting a non-existent object', async () => {
    const missingKey = 'another-missing-file.csv';

    // In S3, a DeleteObject call for a non-existent object returns 204 No Content (success)
    // It does NOT throw an error. This is a very common point of confusion.
    const { DeleteObjectCommand } = await import('@aws-sdk/client-s3');
    const deleteCommand = new DeleteObjectCommand({ Bucket: bucketName, Key: missingKey });

    await expect(s3Client.send(deleteCommand)).resolves.not.toThrow();
  });
});
