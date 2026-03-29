-- Add floor, latitude, longitude columns to orders table
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "floor" TEXT;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "latitude" DOUBLE PRECISION;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "longitude" DOUBLE PRECISION;
