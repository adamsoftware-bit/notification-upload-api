# Use Node.js 20 Alpine as base image for smaller size
FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Install timezone data and other necessary packages
RUN apk add --no-cache libc6-compat tzdata

# Copy package files
COPY package.json pnpm-lock.yaml* ./

# Install dependencies
RUN corepack enable pnpm && pnpm install --frozen-lockfile

# Production image
FROM base AS runner
WORKDIR /app

# Install timezone data
RUN apk add --no-cache tzdata

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 appuser

# Copy node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy source code
COPY --chown=appuser:nodejs . .

# Create uploads directory with proper permissions
RUN mkdir -p uploads src/uploads && \
    chown -R appuser:nodejs uploads src/uploads

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 3001

# Add healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3001/health', (res) => process.exit(res.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

# Start the application
CMD ["node", "src/index.js"]
