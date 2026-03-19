-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "payment_screenshot" TEXT,
ADD COLUMN     "payment_type" TEXT,
ALTER COLUMN "status" SET DEFAULT 'pending_payment';

-- CreateTable
CREATE TABLE "settings" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("key")
);
