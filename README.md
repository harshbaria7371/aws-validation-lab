# AWS Validation Lab

Bridging the gap between Cloud Engineering and QA. This project provides a documented walkthrough of setting up AWS infrastructure with built-in automated verification tests using TypeScript and Playwright.

## Objective
The primary goal of this repository is to demonstrate how SDETs can write integration tests for Cloud Native applications and Infrastructure using the AWS SDK, testing behaviors against mock local environments before deploying to the real cloud.

## Project Structure

```text
aws-validation-lab/
├── docs/                     # Educational modules on core AWS concepts (e.g., S3, VPC, EC2)
├── tests/                    # Playwright test suites for validating AWS integration behaviors
│   └── s3-integration.spec.ts
├── utils/                    # Helper modules encapsulating AWS SDK operations (configured for local endpoints)
│   └── s3-helper.ts
├── docker-compose.yml        # Local infrastructure definitions for mocking AWS services
├── playwright.config.ts      # Test runner configuration
├── package.json              # Project dependencies
└── README.md
```

## Prerequisites

- **Node.js** (v18 or higher)
- **Docker & Docker Compose** (to run the local mock AWS environment)

## Getting Started

### 1. Install Dependencies
Clone the repository and install the Node.js packages:
```bash
npm install
```

### 2. Start the Local AWS Environment
Ensure your Docker daemon is running, then spin up the local AWS mock services (which typically run on `http://localhost:4566`):
```bash
docker-compose up -d
```

### 3. Run the Automated Tests
Execute the infrastructure verification tests using Playwright. The tests in this repository use dynamic setups and teardowns to simulate real-world CI/CD pipelines.
```bash
npx playwright test
```

### 4. View Test Reports
To view a detailed breakdown of the test execution, including the S3 lifecycle and overwrite behavior results:
```bash
npx playwright show-report
```
