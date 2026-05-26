# Module 2.1: Amazon S3 (Simple Storage Service - Object Storage)
Amazon S3 is a highly scalable, durable, and secure object storage service. It is used to store and retrieve any amount of data, at any time, from anywhere. In the context of an SDET, S3 is commonly used to store test artifacts, large datasets, and static website content.

## The Real-World Analogy: The Infinite Valet Luggage Service
When you store a file on your personal computer, you use a Hierarchical File System. Imagine a physical filing cabinet: you open a drawer, find a folder, open a sub-folder, and find a document. If that drawer fills up, you have to buy a new cabinet, and if your room fills up, you are out of space.

**Amazon S3 is Object Storage**. Think of it like an infinite valet luggage service at a massive hotel:
1. You hand the valet an item (a file, an image, a video).
2. The valet places it anywhere they want in a massive, warehouse-sized room.
3. In return, they give you a claim ticket with a unique string (the Key, like `floor2/closetB/bag_99.jpg`).
4. It doesn't matter if the hotel has 10 bags or 10 billion bags; the warehouse expands automatically. You never have to worry about running out of floor space.

## Key Concept: S3 Has No Real Folders!
This trips up many newcomers. When you see a file path in S3 like `logs/2026/test-report.json`, there is no physical folder named "logs" or "2026". The entire string `logs/2026/test-report.json` is just the unique name (the Key) of a single flat file. AWS tools simply look for forward slashes (/) and visually draw them as folders in your browser to keep your human brain happy.

## The SDET Lens: Testing Applications that Use S3
As an Automation Architect, you will constantly interact with S3. Applications use it to store user uploads, test reports, build artifacts, or system logs.

### 1. How do we write automated integration tests for S3?
You use the AWS SDK within your test framework (e.g., `boto3` for Python, `@aws-sdk/client-s3` for Node.js). Your automation pipeline should perform a full lifecycle test:

1. **Upload** - Upload a file to a bucket (e.g., `test-data/upload.csv`).
2. **Verify** - Poll S3 (using `list_objects` or `get_object`) until the file appears.
3. **Act** - Trigger the downstream process (e.g., a Lambda function that processes CSVs).
4. **Validate** - Check the result of the processing.
5. **Cleanup** - Delete the file.

### 2. Common Failure Points & Edge Cases to Mock/Test

- **The Overwrite Trap**: By default, if an application uploads a file with an identical key (e.g., `report.csv`), S3 silently overwrites the old one. If your test relies on historical data, you must test how the application behaves with S3 Versioning turned on versus off.
- **Multipart Upload Failures**: For large files (over 5GB, but often configured at 100MB+), AWS breaks the file into chunks and uploads them simultaneously. If connection drops mid-upload, those orphaned chunks sit hidden in the cloud, costing money. You must test if your app cleanly aborts failed uploads.
- **Permission Leaks**: Ensure that private files (like user invoices) reject unauthorized requests with a `403 Forbidden` error, while public assets (like logo images) load seamlessly.

### 3. Test Data Generation & Cleanup
- **The Collision Problem**: If two parallel CI pipelines try to write to a bucket called `my-test-bucket`, they will overwrite each other's test data. A robust pattern is to append a unique identifier (like a Git commit hash or a UUID) to every bucket name in your automation scripts.
- **The Strategy**: Always append a dynamic timestamp or UUID to your bucket names during test setup (e.g., `automation-reports-550e8400`).
- **The Cleanup Cost**: In production, deleting a bucket with millions of files can be slow. In testing, if you forget to delete the bucket, it just sits there accumulating costs (and potentially violating retention policies). Automated teardown scripts using `aws s3api delete-objects` (with a `--recursive` flag) are essential.
- **Versioning Complexity**: If Versioning is enabled on a bucket, a `delete` operation only moves the object to a "delete marker" (it still exists). To truly remove the data, you must delete all versions. Your automation must check `list_object_versions` if the delete count doesn't match the expected delete count.
- **The SDK Pattern**: When writing code, always wrap your S3 operations in `try...except` blocks to handle `NoSuchBucket`, `AccessDenied`, or `NoSuchKey` errors gracefully. Do not assume the bucket or object exists.
- **Empty Directories**: Just like the folder illusion, S3 doesn't store empty directories. If you delete the last file in a simulated folder path, the "folder" disappears. Your test logic should handle this: if you expect a folder to exist for cleanup but `list_objects` returns nothing, the folder is effectively gone.

## Practical Lab: Interacting with S3

### Step 1: Create a Bucket
Bucket names across the real AWS must be globally unique (no two companies can have the same bucket name). Locally, we can name it whatever we want.

``` bash
aws s3api create-bucket --bucket s3-automation-sandbox --region us-east-1 --endpoint-url http://localhost:4566
```
Output
``` bash
{
    "Location": "/s3-automation-sandbox"
}
```

### Step 2: Upload a Fake Test Report
Let's create a quick dummy text file and upload it to our local S3 bucket, placing it inside a simulated "folder path".

``` bash
echo '{"status": "passed", "tests": 42}' > execution_result.json

aws s3 cp execution_result.json s3://s3-automation-sandbox/test-runs/run-101/execution_result.json --endpoint-url http://localhost:4566
```
Output
``` bash
upload: .\execution_result.json to s3://s3-automation-sandbox/test-runs/run-101/execution_result.json
```

### Step 3: Verify the File Exists
List the contents of your local bucket to ensure the mock file was successfully stored.

``` bash
aws s3 ls s3://s3-automation-sandbox/test-runs/ --recursive --endpoint-url http://localhost:4566
```
Output
``` bash
2026-05-26 12:08:58         72 test-runs/run-101/execution_result.json
```

---


# Module 2.2: VPC (Virtual Private Cloud - Networking) & EC2 (Elastic Compute Cloud - Computing) 
You cannot run a server in AWS without first giving it a network to live inside. Amazon EC2 (Elastic Compute Cloud) is Amazon Web Services' flagship service for running virtual machines in the cloud.

### The Real-World Analogy: The Defensive Base
Think about how you structure defenses in a strategy game like Clash of Clans. You wouldn't just drop your most valuable assets out in the open.

- **VPC (Virtual Private Cloud)**: This is the outer boundary of your base. It is a logically isolated section of the AWS cloud that belongs entirely to you.
    - **Subnets**: Inside your base, you create different zones.
        - **Public Subnets**: Like the outer perimeter of your base where you might place low-value buildings to absorb attacks. In AWS, this is where you put your public-facing web servers or Load Balancers. They have a direct route to the internet.
        - **Private Subnets**: This is your highly protected core where you keep your Town Hall and storages behind heavy walls. In AWS, this is where your databases and backend application servers live. They cannot be directly reached from the internet.
    - **Security Groups**: These are the strict bouncers at the door of every single building. You write rules saying, "Only allow traffic on Port 443 (HTTPS), drop everything else."
    - **Route Tables & Internet Gateway**: This is how traffic enters and leaves your base. Your VPC has a "Route Table" that tells it where to send traffic. If a subnet has a route to an "Internet Gateway", it is connected to the outside world (Public Subnet). If it doesn't, it is isolated (Private Subnet).
**EC2 (Elastic Compute Cloud)** is simply the actual building you place inside these zones. It is a Virtual Machine (VM). You are renting a computer's CPU and RAM by the second.

## The SDET Lens: Infrastructure Testing & Compute Mocking
As an SDET, you aren't just testing the application code anymore; you are testing the infrastructure itself (often written in Terraform or AWS CDK).

### 1. How do we test this?
Instead of testing if a web page loads, your automation framework will query the AWS API to assert security posture.

- The Assertions: You write tests that describe your Security Groups and assert that Port 22 (SSH) or Port 3389 (RDP) are not open to the public internet (`0.0.0.0/0`).

### 2. The Mocking Edge Case
Local tools like `floci.io` cannot actually spin up a running Linux VM on your machine when you call the EC2 API.

- **What it does**: It mocks the Control Plane. If your CI/CD pipeline has a script that automatically scales up EC2 instances, you can use your local mock to test if your script properly loops through and sends the right `RunInstances` API calls. It will return a fake Instance ID, allowing your script to proceed without actually booting an OS.
- **The Reality**: In production, this is where you would write a "Smoke Test". Once the instance is provisioned (or simulated), your automation would wait for the health check to pass and then attempt to log in using SSH (Secure Shell).

### 3. Test Data Cleanup (The Money Saver)
If your end-to-end automation suite dynamically spins up EC2 instances to run heavy load tests, your teardown block is the most critical code you will write. If an assertion fails midway and the test crashes before hitting the teardown, that EC2 instance will run forever in the real AWS cloud, racking up a massive bill. **Always implement robust `try/finally` blocks in your test runners to guarantee EC2 termination.**

## Practical Lab: Building the Network Locally
Let's use `floci.io` to mock the creation of your private network and a security group.

### Step 1: Create a Virtual Private Cloud (VPC)
We need to carve out a slice of IP addresses for our network.
``` bash
aws ec2 create-vpc --cidr-block 10.0.0.0/16 --endpoint-url http://localhost:4566
```
Output
```bash
{
    "Vpc": {
        "OwnerId": "000000000000",
        "InstanceTenancy": "default",
        "CidrBlockAssociationSet": [
            {
                "AssociationId": "vpc-cidr-assoc-4cd9a1fa",
                "CidrBlock": "10.0.0.0/16",
                "CidrBlockState": {
                    "State": "associated"
                }
            }
        ],
        "IsDefault": false,
        "Tags": [],
        "VpcId": "vpc-5a9f2a36",
        "State": "available"
    }
}
```
(Copy the `VpcId` from the JSON response, it will look something like `vpc-1a2b3c4d`)

### Step 2: Create a Subnet

A VPC is just an empty box. You must create a subnet inside it to define where resources can live and whether they are public or private. Now, let's create a virtual firewall rule inside that specific VPC. Replace YOUR_VPC_ID with the ID from Step 1.

``` bash
aws ec2 create-security-group --group-name SDET-Web-SG --description "Allow web traffic" --vpc-id YOUR_VPC_ID --endpoint-url http://localhost:4566
```
Output
```bash
{
    "GroupId": "sg-4afdde671924cf6d5"
}
```
Once you execute these commands, you have officially established a mocked, secure perimeter!

**Question to SDET**: how would you normally approach writing a test that asserts a configuration value (like checking if that Security Group actually blocks Port 22) within your preferred language/framework?

**Answer**: You are used to writing tests that verify application behavior (e.g., "Does clicking this button submit the form?"). In AWS, you are writing tests to verify infrastructure state (e.g., "Did my deployment script configure the firewall correctly?").

Here is the secret: **Testing AWS infrastructure is exactly the same as testing a standard REST API**. AWS is just a massive collection of APIs. Instead of using `RestAssured` or `requests` to hit an endpoint, you use the `AWS SDK`.

## The Code: Testing Infrastructure State
```python
import boto3

def test_security_group_blocks_public_ssh():
    # ---------------------------------------------------------
    # 1. ARRANGE: Set up the AWS Client
    # Point it directly to your local floci.io container
    # ---------------------------------------------------------
    ec2_client = boto3.client(
        'ec2',
        region_name='us-east-1',
        endpoint_url='http://localhost:4566', # The critical local override
        aws_access_key_id='test',
        aws_secret_access_key='test'
    )
    
    # In a real framework, you would dynamically fetch this ID from your setup block
    target_security_group_id = "sg-12345mock" 

    # ---------------------------------------------------------
    # 2. ACT: Query the AWS Control Plane
    # Ask AWS to describe the exact configuration of the group
    # ---------------------------------------------------------
    response = ec2_client.describe_security_groups(GroupIds=[target_security_group_id])
    
    # Extract the specific security group object from the JSON response
    sg_config = response['SecurityGroups'][0]

    # ---------------------------------------------------------
    # 3. ASSERT: Validate the Firewall Rules (Ingress)
    # ---------------------------------------------------------
    public_ssh_found = False
    
    # Loop through the inbound rules (IpPermissions)
    for rule in sg_config.get('IpPermissions', []):
        # Check if the rule applies to Port 22 (SSH)
        if rule.get('FromPort') == 22:
            # Check if the IP range is open to the entire internet
            for ip_range in rule.get('IpRanges', []):
                if ip_range.get('CidrIp') == '0.0.0.0/0':
                    public_ssh_found = True
                    break

    # The test passes ONLY if public SSH was not found
    assert public_ssh_found is False, f"SECURITY ALERT: SG {target_security_group_id} has Port 22 open to 0.0.0.0/0"
``` 

Here is the JavaScript code:

Step 1, you need to install the specific EC2 client:

```bash
npm install @aws-sdk/client-ec2
``` 

Then, you can use the following code to test the security group:

```javascript
const { EC2Client, DescribeSecurityGroupsCommand } = require("@aws-sdk/client-ec2");

describe("Infrastructure Security Tests", () => {
    
    test("Security Group should block public SSH", async () => {
        // ---------------------------------------------------------
        // 1. ARRANGE: Set up the AWS Client
        // Point it directly to your local floci.io container
        // ---------------------------------------------------------
        const ec2Client = new EC2Client({
            region: "us-east-1",
            endpoint: "http://localhost:4566", // The critical local override
            credentials: {
                accessKeyId: "test",
                secretAccessKey: "test"
            }
        });

        // In a real framework, dynamically fetch this ID from setup state
        const targetSecurityGroupId = "sg-12345mock"; 
        
        const command = new DescribeSecurityGroupsCommand({
            GroupIds: [targetSecurityGroupId]
        });

        // ---------------------------------------------------------
        // 2. ACT: Query the AWS Control Plane
        // Node.js SDK v3 requires asynchronous execution
        // ---------------------------------------------------------
        const response = await ec2Client.send(command);
        const sgConfig = response.SecurityGroups[0];

        // ---------------------------------------------------------
        // 3. ASSERT: Validate the Firewall Rules (Ingress)
        // ---------------------------------------------------------
        let publicSshFound = false;

        // Loop through the inbound rules (IpPermissions)
        if (sgConfig.IpPermissions) {
            for (const rule of sgConfig.IpPermissions) {
                // Check if the rule applies to Port 22 (SSH)
                if (rule.FromPort === 22) {
                    // Check if the IP range is open to the entire internet
                    if (rule.IpRanges) {
                        for (const ipRange of rule.IpRanges) {
                            if (ipRange.CidrIp === '0.0.0.0/0') {
                                publicSshFound = true;
                                break;
                            }
                        }
                    }
                }
            }
        }

        // The test passes ONLY if public SSH was not found
        // This utilizes standard Jest assertion syntax
        expect(publicSshFound).toBe(false); 
    });
});
```

## Why this is powerful for an SDET
Imagine your DevOps team writes a script to deploy a new environment. Before anyone is allowed to deploy application code to that environment, your automated test suite runs this code.

If a junior developer accidentally opened Port 22 to the public while trying to debug something, your test catches it in seconds, fails the CI/CD pipeline, and prevents a massive security breach. You aren't just testing software; you are testing the "building" the software lives in.

