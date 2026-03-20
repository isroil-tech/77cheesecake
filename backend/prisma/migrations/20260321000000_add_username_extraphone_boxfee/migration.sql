-- Add username to users table
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "username" TEXT;

-- Add extra_phone and box_fee to orders table
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "extra_phone" TEXT;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "box_fee" DECIMAL(10,2) NOT NULL DEFAULT 5000;
