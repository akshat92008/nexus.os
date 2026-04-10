FROM node:20-alpine

# Create a non-root system user
RUN addgroup -S nexus && adduser -S nexus -G nexus

WORKDIR /app

# Copy dependency files first for caching
COPY package.json package-lock.json* ./
RUN npm install --production

# Copy application source
COPY . .

# Set ownership to the non-root user
RUN chown -R nexus:nexus /app

# Switch to restricted user
USER nexus

EXPOSE 3001
CMD ["npm", "run", "start"]
