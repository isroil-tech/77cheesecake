FROM node:22-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm ci

# Generate Prisma client
RUN npx prisma generate

# Copy source code
COPY . .

# Build NestJS
RUN npm run build -- 

# Expose port
EXPOSE 8080

# Run migrations and start
CMD ["sh", "-c", "npx prisma migrate deploy && npx prisma db seed || true && node dist/main"]
