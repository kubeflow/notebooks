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

# Copy nginx config
COPY nginx.conf /etc/nginx/nginx.conf

# Create directories and set permissions for non-root user
RUN mkdir -p /var/cache/nginx/client_temp \
             /var/cache/nginx/proxy_temp \
             /var/cache/nginx/fastcgi_temp \
             /var/cache/nginx/uwsgi_temp \
             /var/cache/nginx/scgi_temp \
             /var/run/nginx \
             /tmp/nginx && \
    # Change ownership of nginx directories to nginx user (UID 101)
    chown -R 101:101 /var/cache/nginx \
                     /var/run/nginx \
                     /usr/share/nginx/html \
                     /tmp/nginx \
                     /etc/nginx

# Switch to nginx user (UID 101)
USER 101:101

# Expose port
EXPOSE 8080

# Set environment variables
ENV PORT=8080

# Start the production server
CMD ["nginx", "-g", "daemon off;"]