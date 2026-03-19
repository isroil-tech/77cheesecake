-- AlterTable
ALTER TABLE "order_items" ALTER COLUMN "product_variant_id" DROP NOT NULL;
-- DropForeignKey (old)
ALTER TABLE "order_items" DROP CONSTRAINT IF EXISTS "order_items_product_variant_id_fkey";
-- AddForeignKey (optional)
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_variant_id_fkey" FOREIGN KEY ("product_variant_id") REFERENCES "product_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
