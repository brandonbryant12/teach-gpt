# apps/client/Dockerfile

# ---- Build Stage ----
FROM node:18-alpine AS builder
WORKDIR /usr/src/app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm i

# Copy the rest of the application code
COPY . .

# Build the React application
RUN npm run build

# ---- Production Stage ----
# Use a lightweight Nginx image
FROM nginx:stable-alpine AS production

# Copy the build output from the builder stage to Nginx's web root
COPY --from=builder /usr/src/app/dist /usr/share/nginx/html

# Copy a custom Nginx configuration file (we'll create this next)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 80
EXPOSE 80

# Start Nginx
CMD ["nginx", "-g", "daemon off;"] 