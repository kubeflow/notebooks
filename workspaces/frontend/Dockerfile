# ---------- Builder stage ----------
FROM node:20-slim AS builder

# Set working directory
WORKDIR /usr/src/app

# Copy package files to the container
COPY package*.json ./

# Install the dependencies and build
RUN npm cache clean --force \
  && npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build:prod


# ---------- Production stage ----------
FROM nginx:alpine

# Copy built assets from builder stage
COPY --from=builder /usr/src/app/dist /usr/share/nginx/html

COPY nginx.conf /etc/nginx/nginx.conf

# Prepare directories with correct ownership for nginx user
RUN mkdir -p /var/cache/nginx/client_temp /var/run && \
    chown -R 65532:65532 /var/cache/nginx /var/run

# Switch to non-root user
USER 65532:65532

# Expose port
EXPOSE 8080

# Set environment variables
ENV PORT=8080

# Start the production server
CMD ["nginx", "-g", "daemon off;"]