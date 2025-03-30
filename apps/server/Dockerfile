# apps/server/Dockerfile

# ---- Base Stage ----
# Use a specific Node version consistent with your project (check your root package.json engines field if specified)
FROM node:18-alpine AS base
WORKDIR /usr/src/app

# Install dependencies first to leverage Docker cache
COPY package*.json ./
# Use npm ci for cleaner installs in CI/CD or Docker builds
RUN npm i

# ---- Build Stage ----
FROM base AS builder
WORKDIR /usr/src/app
COPY --from=base /usr/src/app/node_modules ./node_modules
COPY . .
# Build the NestJS application
RUN npm run build

# ---- Production Stage ----
FROM node:18-alpine AS production
WORKDIR /usr/src/app

# Copy necessary files from the builder stage
COPY --from=builder /usr/src/app/package*.json ./
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/dist ./dist

# Expose the port the app runs on (default for NestJS is 3000)
EXPOSE 3000

# Command to run the application
CMD ["node", "dist/main"] 