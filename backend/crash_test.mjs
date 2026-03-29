const URL = 'http://localhost:3000/api/v1/categories/with-products';
let success = 0;
let errors = 0;
let blocked = 0;

console.log('--- 🚀 CRASH TEST STARTING (DDOS SIMULATION) ---');
console.log('Target:', URL);

let requests = [];
// Send 300 requests instantly
for (let i = 0; i < 300; i++) {
  requests.push(
    fetch(URL, { headers: { 'x-forwarded-for': '1.2.3.4' } })
      .then(res => {
        if (res.status === 200) success++;
        else if (res.status === 429) blocked++;
        else errors++;
      })
      .catch((e) => errors++)
  );
}

Promise.all(requests).then(() => {
  console.log('\n--- 🛑 CRASH TEST RESULTS ---');
  console.log('✅ Muvaffaqiyatli so`rovlar:', success);
  console.log('🛡️ Bloklangan (DDos Qalqon - 429):', blocked);
  console.log('❌ Server xatolari:', errors);
  
  if (blocked > 0) {
    console.log('\nNatija: 🛡️ QALQON ISHLAMOQDA! Server hujumni qaytardi va qotib qolmadi.');
  } else if (errors > 0) {
    console.log('\nNatija: ⚠️ SERVER QULADI yoki XATOLIK!');
  } else {
    console.log('\nNatija: ⚠️ HIMOYASIZ! Barcha so`rovlar o`tib ketdi. DDos g`alaba qozondi.');
  }
});
