<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Project setup

```bash
$ npm install
```

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ npm install -g mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).

# Teach-GPT Server Application

This is the backend server for the Teach-GPT application, built with NestJS, Drizzle ORM, Passport, and PostgreSQL.

## Development Setup

Follow these steps to set up the server for local development.

### Prerequisites

*   Node.js (Check `.nvmrc` or `package.json` engines for recommended version)
*   npm (or yarn/pnpm)
*   Docker Desktop (for running the database and application in containers)
*   Git

### 1. Clone the Repository

```bash
# If you haven't already, clone the main repository
# git clone <repository_url>
# cd <repository_name>/apps/server
```

### 2. Install Dependencies

Navigate to the `apps/server` directory if you aren't already there, and install the required npm packages:

```bash
npm install
```

### 3. Environment Variables

Create a `.env` file in the `apps/server` directory. This file is used for local development outside of Docker and for Drizzle Kit commands.

```dotenv
# .env

# For local development connection (if running db outside docker-compose)
# Ensure the user, password, port, and db name match your local setup or docker-compose override if needed.
DATABASE_URL=postgresql://user:password@localhost:5432/mydatabase

# Add other environment variables like JWT secrets later
# JWT_SECRET=your_super_secret_key
# JWT_EXPIRATION_TIME=3600s
```

**Important:** The `DATABASE_URL` in the `.env` file is primarily used by `drizzle-kit` commands run directly on your host machine and potentially if you run `npm run start:dev` without Docker Compose. When using `npm run dev:docker`, the `DATABASE_URL` defined within the `docker-compose.yml` file for the `api` service takes precedence inside the container, pointing to the `db` service.

### 4. Database Setup & Migrations

We use Drizzle ORM for database interaction and Drizzle Kit for migrations.

**Option A: Using Docker (Recommended)**

1.  Ensure Docker Desktop is running.
2.  Start the database container:
    ```bash
    docker compose up db -d
    ```
3.  Generate the initial migration (or subsequent migrations if you change `src/db/schema.ts`):
    ```bash
    # This uses the DATABASE_URL from your .env file to connect
    npm run db:generate
    ```
4.  Apply the migrations to the database running in Docker:
    ```bash
    # This also uses the DATABASE_URL from your .env file
    npm run db:migrate 
    ```
    *(Note: `db:migrate` uses `drizzle-kit push`, suitable for development. For production, a more robust migration strategy is needed.)*

**Option B: Local PostgreSQL Instance**

If you have PostgreSQL running locally (not in Docker) configured with the same credentials/database name as in your `.env` file, you can skip starting the Docker `db` service and run `db:generate` and `db:migrate` directly against your local instance.

### 5. Running the Application

**Option A: Using Docker Compose (Recommended)**

This command builds the API image (if necessary) and starts both the `api` and `db` services.

```bash
npm run dev:docker
```

The API will be available at `http://localhost:3000`.

To stop and remove the containers:

```bash
npm run dev:docker:down
```

**Option B: Running Locally (Requires Local DB)**

If you have a local PostgreSQL instance running and migrated (as per Step 4, Option B), you can run the NestJS development server directly:

```bash
npm run start:dev
```

The API will be available at `http://localhost:3000`.

### Useful Development Commands

*   `npm run lint`: Lint the codebase using ESLint.
*   `npm run format`: Format the codebase using Prettier.
*   `npm run test`: Run unit tests.
*   `npm run test:watch`: Run unit tests in watch mode.
*   `npm run db:studio`: Open Drizzle Studio (requires Docker DB or local DB to be running) to browse your database.

## Production Deployment

### 1. Build the Application

Create a production-ready build in the `dist` folder:

```bash
npm run build
```

### 2. Environment Variables

Ensure all required environment variables are set in your production environment. This **must** include:

*   `DATABASE_URL`: Pointing to your **production** PostgreSQL database.
*   `NODE_ENV=production` (Recommended for performance optimizations).
*   Any secrets required (e.g., `JWT_SECRET`).

**Do not** use `.env` files for production secrets. Use your deployment platform's secret management system.

### 3. Database Migrations (Production)

**Do not use `npm run db:migrate` (which uses `drizzle-kit push`) in production.** This command can potentially lead to data loss as it tries to make the database match the schema directly.

Instead, you should:

1.  Generate migration files during development (`npm run db:generate`).
2.  Commit these migration files (`drizzle/migrations/*.sql`) to your repository.
3.  Use a dedicated migration tool (like `node-pg-migrate`, Flyway, Liquibase, or integrate Drizzle Migrate into your deployment pipeline) to apply these SQL migration files sequentially to your production database during deployment.

Example using Drizzle Migrate (you would need to add a script/logic for this):

```typescript
// somewhere in your deployment script or a dedicated migration script
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

const connectionString = process.env.DATABASE_URL;
const sql = postgres(connectionString, { max: 1 });
const db = drizzle(sql);

async function runMigrations() {
  console.log("Running database migrations...");
  await migrate(db, { migrationsFolder: './drizzle/migrations' });
  console.log("Migrations applied successfully.");
  await sql.end(); // Close the connection
}

runMigrations().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
```

### 4. Running the Application

**Option A: Using Node.js Directly**

After building and ensuring the environment is configured, start the application:

```bash
npm run start:prod
```

You should use a process manager like PM2 or Nodemon (in production mode) to handle restarts and monitoring.

**Option B: Using Docker**

The provided `Dockerfile` uses a multi-stage build, resulting in a lean production image.

1.  Build the production image:
    ```bash
    # Example: Tagging the image
    docker build -t your-dockerhub-username/teach-gpt-server:latest .
    ```
2.  Push the image to a container registry (like Docker Hub, AWS ECR, Google GCR).
3.  Deploy the image using your preferred orchestration tool (Docker Compose, Kubernetes, AWS ECS, etc.), ensuring the production environment variables (like `DATABASE_URL`, `JWT_SECRET`, `NODE_ENV=production`) are correctly injected into the container.

Example snippet for a production `docker-compose.prod.yml` (simplified):

```yaml
version: '3.8'
services:
  api:
    image: your-dockerhub-username/teach-gpt-server:latest # Use the image you built and pushed
    container_name: teach-gpt-api-prod
    restart: always
    ports:
      - "8080:3000" # Map container port 3000 to host port 8080 (or configure a reverse proxy)
    environment:
      NODE_ENV: production
      DATABASE_URL: ${PROD_DATABASE_URL} # Inject from environment or secrets management
      JWT_SECRET: ${PROD_JWT_SECRET}
    # No volumes needed for src or node_modules in production image

# Note: This assumes the database is managed separately in production.
```
