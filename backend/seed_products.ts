import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Cleaning existing catalog data...');
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.cartItem.deleteMany();
  await prisma.cart.deleteMany();
  await prisma.productVariant.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();

  console.log('Inserting Categories...');
  const catClassic = await prisma.category.create({
    data: { nameUz: 'Classic', nameRu: 'Классические', sortOrder: 1 }
  });
  const catTami = await prisma.category.create({
    data: { nameUz: 'Ta\'mli', nameRu: 'С вкусами', sortOrder: 2 }
  });

  console.log('Inserting Classic Products...');
  const classicProducts = [
    { name: 'Classic cheesecake 23sm', price: 320000, type: 'whole' },
    { name: 'Classic cheesecake 23sm (bezatilgan)', price: 360000, type: 'whole' },
    { name: 'Classic cheesecake 12sm (bezatilgan)', price: 120000, type: 'whole' },
    { name: 'Classic cheesecake bo’lak (standard)', price: 55000, type: 'slice' },
    { name: 'Classic cheesecake bo’lak (mini)', price: 20000, type: 'slice' },
  ];

  for (let i = 0; i < classicProducts.length; i++) {
    const p = classicProducts[i];
    await prisma.product.create({
      data: {
        categoryId: catClassic.id,
        nameUz: p.name,
        nameRu: p.name, // using same name since no RU provided
        sortOrder: i + 1,
        variants: {
          create: [{
            nameUz: p.type === 'whole' ? 'Butun' : 'Bo\'lak',
            nameRu: p.type === 'whole' ? 'Целиком' : 'Кусочек',
            unitType: p.type,
            price: p.price,
            piecesPerUnit: p.type === 'whole' ? 8 : 1,
          }]
        }
      }
    });
  }

  console.log('Inserting Ta\'mli Products...');
  const tamliProducts = [
    { name: 'Lotus' },
    { name: 'Dubai' },
    { name: 'Golubika' },
    { name: 'Mevali mix' },
    { name: 'Choco' },
    { name: 'Rafaello' },
    { name: 'Oreo' },
    { name: 'Mango' },
    { name: 'Malina' },
  ];

  for (let i = 0; i < tamliProducts.length; i++) {
    const p = tamliProducts[i];
    await prisma.product.create({
      data: {
        categoryId: catTami.id,
        nameUz: p.name,
        nameRu: p.name,
        sortOrder: i + 1,
        variants: {
          create: [
            {
              nameUz: 'Butun',
              nameRu: 'Целиком',
              unitType: 'whole',
              price: 120000,
              piecesPerUnit: 8,
              sortOrder: 1,
            },
            {
              nameUz: 'Bo\'lak',
              nameRu: 'Кусочек',
              unitType: 'slice',
              price: 20000,
              piecesPerUnit: 1,
              sortOrder: 2,
            }
          ]
        }
      }
    });
  }

  console.log('Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
