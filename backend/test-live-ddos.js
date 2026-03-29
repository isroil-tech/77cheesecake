async function run() {
  const URL = 'https://77cheesecake.uz/api/v1/categories/with-products';
  let success = 0, errors = 0, blocked = 0;

  console.log('--- 🚀 LIVE CRASH TEST STARTING (DDOS SIMULATION) ---');
  console.log('Nishon IP:', URL);

  let requests = [];
  // 1 soniya ichida serverga 300 ta zapros bilan zarba beramiz
  for (let i = 0; i < 300; i++) {
    requests.push(
      fetch(URL, { headers: { 'x-telegram-id': 'hacker-crash-test-' + i } })
        .then(res => {
          if (res.status === 200) success++;
          else if (res.status === 429) blocked++;
          else errors++;
        })
        .catch((err) => errors++)
    );
  }

  await Promise.all(requests);
  
  console.log('\n--- 🛑 CRASH TEST NATIJALARI ---');
  console.log('✅ O`tgan so`rovlar (Qalqongacha tegmadi):', success);
  console.log('🛡️ BLOKLANGAN (DDos Qalqon tepib yubordi HTTP 429):', blocked);
  console.log('❌ Tizim qulashi (Server Error):', errors);
  
  if (blocked > 0) {
    console.log('\nNatija: 🛡️ QALQON ISHLAMOQDA! Server hujumni blokka oldi va "qotib qolmadi".');
  } else if (errors > 0) {
    console.log('\nNatija: ⚠️ SERVER QULADI yoki YIQILDI!');
  } else {
    console.log('\nNatija: ⚠️ HIMOYASIZ! Barcha so`rovlar o`tib ketdi. DDos g`alaba qozondi.');
  }
}
run();
