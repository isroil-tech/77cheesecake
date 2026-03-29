const baseURL = 'https://77cheesecake.up.railway.app/api/v1';
const headers = {
  'Content-Type': 'application/json',
  'x-telegram-id': '1392501306',
};

async function api(method, url, body) {
  const res = await fetch(baseURL + url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.text();
    console.error(`API Error ${res.status} on ${method} ${url}: ${err}`);
    return null;
  }
  return res.json();
}

async function main() {
  console.log('Fetching existings products and deactivating test data...');
  const products = await api('GET', '/admin/catalog/products');
  for (const p of products) {
    if (p.isActive) {
      console.log(`Deactivating product: ${p.nameUz}`);
      await api('DELETE', `/admin/catalog/products/${p.id}`);
    }
  }

  console.log('Fetching categories...');
  let categories = await api('GET', '/admin/catalog/categories');
  
  let classicCat = categories.find(c => c.nameUz === 'Classic');
  if (!classicCat) {
    classicCat = await api('POST', '/admin/catalog/categories', { nameUz: 'Classic', nameRu: 'Классические', sortOrder: 1 });
  }

  let tamliCat = categories.find(c => c.nameUz === 'Ta\'mli');
  if (!tamliCat) {
    tamliCat = await api('POST', '/admin/catalog/categories', { nameUz: 'Ta\'mli', nameRu: 'С вкусами', sortOrder: 2 });
  }

  const classicProducts = [
    { name: 'Classic cheesecake 23sm', price: 320000, type: 'whole' },
    { name: 'Classic cheesecake 23sm (bezatilgan)', price: 360000, type: 'whole' },
    { name: 'Classic cheesecake 12sm (bezatilgan)', price: 120000, type: 'whole' },
    { name: 'Classic cheesecake bo’lak (standard)', price: 55000, type: 'slice' },
    { name: 'Classic cheesecake bo’lak (mini)', price: 20000, type: 'slice' },
  ];

  console.log('Creating Classic Products...');
  for (let i = 0; i < classicProducts.length; i++) {
    const p = classicProducts[i];
    console.log(` -> ${p.name}`);
    const product = await api('POST', '/admin/catalog/products', {
      categoryId: classicCat.id,
      nameUz: p.name,
      nameRu: p.name,
      sortOrder: i + 1,
    });
    
    if (product) {
      await api('POST', `/admin/catalog/products/${product.id}/variants`, {
        nameUz: p.type === 'whole' ? 'Butun' : 'Bo\'lak',
        nameRu: p.type === 'whole' ? 'Целиком' : 'Кусочек',
        unitType: p.type,
        price: p.price,
        piecesPerUnit: p.type === 'whole' ? 8 : 1,
        sortOrder: 1,
      });
    }
  }

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

  console.log('Creating Ta\'mli Products...');
  for (let i = 0; i < tamliProducts.length; i++) {
    const p = tamliProducts[i];
    console.log(` -> ${p.name}`);
    const product = await api('POST', '/admin/catalog/products', {
      categoryId: tamliCat.id,
      nameUz: p.name,
      nameRu: p.name,
      sortOrder: i + 1,
    });

    if (product) {
      await api('POST', `/admin/catalog/products/${product.id}/variants`, {
        nameUz: 'Butun',
        nameRu: 'Целиком',
        unitType: 'whole',
        price: 120000,
        piecesPerUnit: 8,
        sortOrder: 1,
      });

      await api('POST', `/admin/catalog/products/${product.id}/variants`, {
        nameUz: 'Bo\'lak',
        nameRu: 'Кусочек',
        unitType: 'slice',
        price: 20000,
        piecesPerUnit: 1,
        sortOrder: 2,
      });
    }
  }

  console.log('Seeding completed successfully!');
}

main().catch(console.error);
