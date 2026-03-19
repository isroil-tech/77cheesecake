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
RUN ls -la dist/src/ && echo "✅ dist/src/main.js exists" && test -f dist/src/main.js

# Expose port (Railway sets PORT env var)
EXPOSE 8080

# Run migrations, seed, then start
CMD sh -c "npx prisma migrate deploy && echo '🌱 Running seed...' && npx prisma db seed && echo '✅ Seed done' && node dist/src/main"
