import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Seeding database...');

  // Categories
  const classicCategory = await prisma.category.upsert({
    where: { id: 'cat-classic' },
    update: {},
    create: {
      id: 'cat-classic',
      nameUz: 'Klassik cheesecake',
      nameRu: 'Классические чизкейки',
      sortOrder: 1,
    },
  });

  const specialCategory = await prisma.category.upsert({
    where: { id: 'cat-special' },
    update: {},
    create: {
      id: 'cat-special',
      nameUz: 'Maxsus cheesecake',
      nameRu: 'Специальные чизкейки',
      sortOrder: 2,
    },
  });

  const miniCategory = await prisma.category.upsert({
    where: { id: 'cat-mini' },
    update: {},
    create: {
      id: 'cat-mini',
      nameUz: 'Mini desertlar',
      nameRu: 'Мини десерты',
      sortOrder: 3,
    },
  });

  // Products + Variants

  // 1. San Sebastian — whole + slice
  const sanSebastian = await prisma.product.upsert({
    where: { id: 'prod-san-sebastian' },
    update: {},
    create: {
      id: 'prod-san-sebastian',
      categoryId: classicCategory.id,
      nameUz: 'San Sebastyan cheesecake',
      nameRu: 'Сан-Себастьян чизкейк',
      descriptionUz: 'Ispaniyaning mashhur retsepti bo\'yicha tayyorlangan',
      descriptionRu: 'Приготовлен по знаменитому испанскому рецепту',
      imageUrl: '/uploads/san-sebastian.jpg',
      sortOrder: 1,
    },
  });

  await prisma.productVariant.upsert({
    where: { id: 'var-san-whole' },
    update: {},
    create: {
      id: 'var-san-whole',
      productId: sanSebastian.id,
      nameUz: 'Butun',
      nameRu: 'Целый',
      unitType: 'whole',
      price: 180000,
      piecesPerUnit: 8,
      sortOrder: 1,
    },
  });

  await prisma.productVariant.upsert({
    where: { id: 'var-san-slice' },
    update: {},
    create: {
      id: 'var-san-slice',
      productId: sanSebastian.id,
      nameUz: "Bo'lak",
      nameRu: 'Кусок',
      unitType: 'slice',
      price: 25000,
      piecesPerUnit: 1,
      sortOrder: 2,
    },
  });

  // 2. New York — whole + slice (10 slices)
  const newYork = await prisma.product.upsert({
    where: { id: 'prod-new-york' },
    update: {},
    create: {
      id: 'prod-new-york',
      categoryId: classicCategory.id,
      nameUz: 'New York cheesecake',
      nameRu: 'Нью-Йорк чизкейк',
      descriptionUz: 'Klassik New York uslubidagi cheesecake',
      descriptionRu: 'Классический чизкейк в нью-йоркском стиле',
      imageUrl: '/uploads/new-york.jpg',
      sortOrder: 2,
    },
  });

  await prisma.productVariant.upsert({
    where: { id: 'var-ny-whole' },
    update: {},
    create: {
      id: 'var-ny-whole',
      productId: newYork.id,
      nameUz: 'Butun',
      nameRu: 'Целый',
      unitType: 'whole',
      price: 200000,
      piecesPerUnit: 10,
      sortOrder: 1,
    },
  });

  await prisma.productVariant.upsert({
    where: { id: 'var-ny-slice' },
    update: {},
    create: {
      id: 'var-ny-slice',
      productId: newYork.id,
      nameUz: "Bo'lak",
      nameRu: 'Кусок',
      unitType: 'slice',
      price: 22000,
      piecesPerUnit: 1,
      sortOrder: 2,
    },
  });

  // 3. Mango Passion — special, whole only
  const mangoCheesecake = await prisma.product.upsert({
    where: { id: 'prod-mango' },
    update: {},
    create: {
      id: 'prod-mango',
      categoryId: specialCategory.id,
      nameUz: 'Mango-Marakuyya cheesecake',
      nameRu: 'Манго-Маракуйя чизкейк',
      descriptionUz: 'Tropik mevali nozik cheesecake',
      descriptionRu: 'Нежный чизкейк с тропическими фруктами',
      imageUrl: '/uploads/mango.jpg',
      sortOrder: 1,
    },
  });

  await prisma.productVariant.upsert({
    where: { id: 'var-mango-whole' },
    update: {},
    create: {
      id: 'var-mango-whole',
      productId: mangoCheesecake.id,
      nameUz: 'Butun',
      nameRu: 'Целый',
      unitType: 'whole',
      price: 220000,
      piecesPerUnit: 8,
      sortOrder: 1,
    },
  });

  // 4. Tiramisu Cheesecake — special, whole + slice
  const tiramisu = await prisma.product.upsert({
    where: { id: 'prod-tiramisu' },
    update: {},
    create: {
      id: 'prod-tiramisu',
      categoryId: specialCategory.id,
      nameUz: 'Tiramisu cheesecake',
      nameRu: 'Тирамису чизкейк',
      descriptionUz: 'Kofe va maskarpone aralashmasi',
      descriptionRu: 'Сочетание кофе и маскарпоне',
      imageUrl: '/uploads/tiramisu.jpg',
      sortOrder: 2,
    },
  });

  await prisma.productVariant.upsert({
    where: { id: 'var-tiramisu-whole' },
    update: {},
    create: {
      id: 'var-tiramisu-whole',
      productId: tiramisu.id,
      nameUz: 'Butun',
      nameRu: 'Целый',
      unitType: 'whole',
      price: 195000,
      piecesPerUnit: 8,
      sortOrder: 1,
    },
  });

  await prisma.productVariant.upsert({
    where: { id: 'var-tiramisu-slice' },
    update: {},
    create: {
      id: 'var-tiramisu-slice',
      productId: tiramisu.id,
      nameUz: "Bo'lak",
      nameRu: 'Кусок',
      unitType: 'slice',
      price: 27000,
      piecesPerUnit: 1,
      sortOrder: 2,
    },
  });

  // 5. Mini cheesecakes — piece-based
  const miniCheesecake = await prisma.product.upsert({
    where: { id: 'prod-mini-classic' },
    update: {},
    create: {
      id: 'prod-mini-classic',
      categoryId: miniCategory.id,
      nameUz: 'Mini classic cheesecake',
      nameRu: 'Мини классик чизкейк',
      descriptionUz: 'Yakka porsiya cheesecake',
      descriptionRu: 'Порционный чизкейк',
      imageUrl: '/uploads/mini-classic.jpg',
      sortOrder: 1,
    },
  });

  await prisma.productVariant.upsert({
    where: { id: 'var-mini-piece' },
    update: {},
    create: {
      id: 'var-mini-piece',
      productId: miniCheesecake.id,
      nameUz: 'Dona',
      nameRu: 'Штука',
      unitType: 'piece',
      price: 15000,
      piecesPerUnit: 1,
      sortOrder: 1,
    },
  });

  console.log('✅ Seed data created successfully!');
  console.log('Categories:', 3);
  console.log('Products:', 5);
  console.log('Variants:', 8);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
