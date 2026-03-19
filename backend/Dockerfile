FROM node:22-alpine

WORKDIR /app

# Copy package files first for better layer caching
COPY package*.json ./
COPY prisma ./prisma/

# Install ALL dependencies (including devDependencies for nest build)
RUN npm ci

# Generate Prisma client
RUN npx prisma generate

# Copy all source code
COPY . .

# Build NestJS app explicitly
RUN npx nest build

# Verify dist exists
RUN ls -la dist/ && echo "✅ dist/main.js exists" && test -f dist/main.js

# Expose port (Railway sets PORT env var)
EXPOSE 8080

# Run migrations then start
CMD sh -c "npx prisma migrate deploy && (npx prisma db seed || true) && node dist/main"
