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

USER root

# Install envsubst (gettext package)
RUN apk add --no-cache gettext

# Copy built assets from builder stage
COPY --from=builder /usr/src/app/dist /usr/share/nginx/html

# Copy nginx template
COPY nginx.conf.template /etc/nginx/nginx.conf.template

# Create base directories
RUN mkdir -p /var/cache/nginx \
             /var/run/nginx \
             /tmp/nginx

# Switch to nginx user (UID 101)
USER 101:101

# Create remaining subdirectories 
RUN mkdir -p /var/cache/nginx/client_temp \
             /var/cache/nginx/proxy_temp \
             /var/cache/nginx/fastcgi_temp \
             /var/cache/nginx/uwsgi_temp \
             /var/cache/nginx/scgi_temp

# Create startup script that works with non-root user
RUN echo '#!/bin/sh' > /docker-entrypoint.sh && \
    echo 'envsubst "\${BACKEND_SERVICE}" < /etc/nginx/nginx.conf.template > /tmp/nginx/nginx.conf' >> /docker-entrypoint.sh && \
    echo 'exec nginx -c /tmp/nginx/nginx.conf -g "daemon off;"' >> /docker-entrypoint.sh && \
    chmod +x /docker-entrypoint.sh && \
    chown 101:101 /docker-entrypoint.sh

# Expose port
EXPOSE 8080

# Set environment variables
ENV PORT=8080

# Set default backend service
ENV BACKEND_SERVICE=backend-service:4000

# Start the production server
CMD ["/docker-entrypoint.sh"]