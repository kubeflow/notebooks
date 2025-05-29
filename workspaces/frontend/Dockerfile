# Development base image
FROM node:20

# Set working directory inside the container
WORKDIR /usr/src/app

# Copy only package files first to install dependencies
COPY package*.json ./

# Install all dependencies (including devDependencies)
RUN npm install

# Copy the rest of the frontend source code to the container
COPY . .

# Use a non-root user for security
RUN addgroup --system appgroup && adduser --system appuser --ingroup appgroup
USER appuser

# Expose the development port (matching webpack dev server)
EXPOSE 9000

# Define environment variables
ENV PORT=9000
ENV ENV=development


# Run the development server with live-reload
CMD ["npm", "run", "start:dev"]
