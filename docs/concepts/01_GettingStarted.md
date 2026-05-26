# Module 1.1: AWS Accounts and Local Authentication
In GCP, you organize resources using Projects, which sit under Folders and an Organization. If you want to isolate a testing environment from production, you create a new GCP Project.

In AWS, the fundamental boundary of isolation is an AWS Account. An AWS Account is essentially a container for your resources, complete with its own root user, billing, and strict security boundary. For robust isolation (like separating your SDET test environments from production), you don't just create a namespace; you spin up entirely separate AWS Accounts within an AWS Organization.

Inside an AWS Account, infrastructure is deployed into Regions (e.g., us-east-1, ap-south-1). Some services are global (like IAM), but most are strictly tied to a region.

## The SDET Lens: Authentication & Mocking Edge Cases
Every action in AWS is an API call, and every API call requires authentication via an Access Key and Secret Key.

## Practical Lab: Wiring Up Your Local Environment
To interact with your local floci.io container, the AWS CLI needs to be tricked into thinking it has valid credentials, and every command must be explicitly routed to your local port (usually 4566 or whichever port floci exposes).

**Step 0**: Start floci.io Local Mock
Create a docker-compose.yml file in the root of the project with the following content:

``` yaml
services:
  floci:
    image: floci/floci:latest
    container_name: aws_local_mock
    ports:
      # Floci routes all AWS services through a single port
      - "4566:4566"
    volumes:
      # Binds a local directory to persist your mocked AWS state between restarts
      - ./floci-data:/app/data
```

Then run the following command to start the floci.io local mock:
``` bash
docker compose up -d
```

The `-d` flag runs the container in detached mode, allowing it to run in the background while freeing up your terminal for AWS CLI commands.

**Step 1**: Set up dummy credentials. The AWS SDKs and CLI require these variables to be set, even if the local mock provider doesn't strictly validate them. Run this in your terminal:
``` bash
aws configure set aws_access_key_id "mock_access_key"
aws configure set aws_secret_access_key "mock_secret_key"
aws configure set region "us-east-1"
aws configure set output "json"
```

**Step 2**: The "Who Am I?" API Call
In AWS, the Security Token Service (STS) is used to validate credentials. We will use `get-caller-identity` to ping the local container.
Replace 4566 with the specific port floci.io is running on.

``` bash
aws sts get-caller-identity --endpoint-url http://localhost:4566
```
Output
```bash
{
    "UserId": "000000000000",
    "Account": "000000000000",
    "Arn": "arn:aws:iam::000000000000:root"
}
```

Note that If successful, floci.io will return a JSON response with a dummy Account ID `000000000000` and an ARN (Amazon Resource Name). This confirms that the AWS CLI is communicating with your local mock server.

---
# Module 1.2: Identity & Access Management (IAM) Concepts and practical task
IAM is the absolute core of AWS. If a service in AWS wants to talk to another service, IAM must explicitly allow it. It operates on a strickt "deny-by-defauly" model.

In AWS, the equivalent concept is an IAM Role. However, the mechanism is slightly different. Instead of a resource "acting as" a permanent identity, an AWS resource (like a serverless Lambda function or an EC2 instance) temporarily Assumes a Role. When it assumes a role, the AWS Security Token Service (STS) grants it temporary, short-lived credentials (Access Key, Secret Key, and Session Token) that expire automatically.

## Practical Lab: Creating a Role Locally
Even though `floci.io` doesn't enforce the permissions, creating the role via the CLI builds muscle memory for how infrastructure-as-code (like Terraform or CloudFormation) provisions these identities.

### Step 1: Create a Trust Policy
A role needs a "Trust Policy" defining who or what is allowed to assume it. Create a local file named `trust-policy.json` in your working directory:

``` json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "lambda.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
```
(This policy says: "I trust AWS Lambda to assume this role.")

### Step 2: Execute the Role Creation
Run the following command to push this configuration to your local container:

``` bash
aws iam create-role \
  --role-name "lambda-s3-executor" \
  --assume-role-policy-document "file://trust-policy.json" \
  --endpoint-url http://localhost:4566
```
Output
```bash
{
    "Role": {
        "Path": "/",
        "RoleName": "SDET-Execution-Role",
        "RoleId": "AROA50K0XL1ORLXGQW1O",
        "Arn": "arn:aws:iam::000000000000:role/SDET-Execution-Role",
        "CreateDate": "2026-05-26T06:22:27.589941+00:00",
        "AssumeRolePolicyDocument": {
            "Version": "2012-10-17",
            "Statement": [
                {
                    "Effect": "Allow",
                    "Principal": {
                        "Service": "lambda.amazonaws.com"
                    },
                    "Action": "sts:AssumeRole"
                }
            ]
        }
    }
}
```
If successful, `floci.io` will return a JSON block confirming the creation of the role, including its new mock Amazon Resource Name (ARN).

