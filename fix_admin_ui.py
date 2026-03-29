import re

path = '/Users/a1234/.gemini/antigravity/playground/infrared-ionosphere/77cheesecake/backend/public/admin/index.html'
with open(path, 'r', encoding='utf-8') as f:
    html = f.read()

# Replace CSS variables
new_css = """    :root {
      --bg: #0f0f0f;
      --surface: #1c1c1c;
      --card: #141414;
      --border: #2e2e2e;
      --primary: #c4a485;
      --primary-dark: #ad8f72;
      --text: #f2f2f2;
      --muted: #8f8f8f;
      --success: #3c6e4e;
      --warning: #cf8e51;
      --danger: #7f1d1d;
      --info: #4a6fa5;
      --purple: #c4a485;
      --radius: 12px;
    }"""
html = re.sub(r':root\s*\{[^}]+\}', new_css, html)

# Replace Emojis
replacements = {
    '🍰 Admin Panel': 'Admin Panel',
    '⟳ Yangilash': 'Yangilash',
    '📦 Buyurtmalar': 'Buyurtmalar',
    '📊 Statistika': 'Statistika',
    '👥 Foydalanuvchilar': 'Foydalanuvchilar',
    '🍰 Mahsulotlar': 'Mahsulotlar',
    '⚙️ Sozlamalar': 'Sozlamalar',
    '📈 7 Kunlik Daromad': '7 Kunlik Daromad',
    '👥 7 Kunlik Yangi Foydalanuvchilar': 'Yangi Foydalanuvchilar',
    '📊 Buyurtma Statuslari': 'Buyurtma holati',
    '🏆 Top Mahsulotlar': 'Top mahsulotlar',
    '📢 Umumiy Rassilka': 'Umumiy xabar',
    '📤 Hammaga Yuborish': 'Hammaga Yuborish',
    '💬 Xabar yuborish': 'Xabar yuborish',
    '💬 Xabar': 'Xabar',
    '⚙️ Telegram Guruh Chat ID': 'Guruh Chat ID',
    '+ Yangi mahsulot': '+ Yangi mahsulot',
    '✏️ Tahrir': 'Tahrir',
    '✏️': 'Tahrir',
    '🗑️': 'O\'chirish',
    '🔴 O\'chir': 'O\'chirish',
    '🟢 Yoq': 'Yoqish',
    '⏳ To\'lov': 'Kutilmoqda',
    '🆕 Yangi': 'Yangi',
    '✅ Tayyor': 'Tayyor',
    '📦 Yetkazildi': 'Yetkazildi',
    '❌ Bekor': 'Bekor qilingan',
    '🚗 Yetkazish': 'Yetkazish',
    '🏪 Olib ketish': 'Olib ketish',
    '🚫 Kirish taqiqlangan': 'Kirish taqiqlangan',
    '📷 Mahsulot rasmi': 'Mahsulot rasmi',
    '📁 Galereyadan tanlash': 'Galereyadan tanlash',
    '✅ Saqlandi!': 'Saqlandi!',
    '✅ Xabar yuborildi!': 'Yuborildi!',
    '💾 Saqlash': 'Saqlash'
}

for old, new in replacements.items():
    html = html.replace(old, new)

# Also remove standalone emojis that might have been matched with spaces beforehand.
emoji_pattern = re.compile(
    "["
    u"\U0001F4E6" # package
    u"\U0001F4C8" # stat
    u"\U0001F465" # users
    u"\U0001F370" # cake
    u"\U00002699" # gear
    u"\U0001F4CA" # bar chart
    u"\U0001F3C6" # trophy
    u"\U0001F4E2" # megaphone
    u"\U0001F4E4" # inbox
    u"\U0001F4AC" # speech baloon
    u"\U0000270F" # pencil
    u"\U0001F5D1" # trash
    u"\U0001F534" # red circle
    u"\U0001F7E2" # green circle
    u"\U000023F3" # hourglass
    u"\U0001F195" # new
    u"\U00002705" # check
    u"\U0000274C" # cross
    u"\U0001F697" # car
    u"\U0001F3EA" # store
    u"\U0001F6AB" # block
    u"\U0001F4F7" # camera
    u"\U0001F4C1" # folder
    u"\U0001F4BE" # disk
    "]\uFE0F?"
)
html = emoji_pattern.sub('', html)

# Add Lucide standard script and map them to titles if we want (or just keep it minimal text)
# The user wants "mavzuga mos iconkalar ishlatamiz" -> Lucide icons
lucide_script = '<script src="https://unpkg.com/lucide@latest"></script>'
if lucide_script not in html:
    html = html.replace('<script src="https://telegram.org/js/telegram-web-app.js"></script>',
                        '<script src="https://telegram.org/js/telegram-web-app.js"></script>\n  ' + lucide_script)
    html = html.replace('</body>', '  <script>lucide.createIcons();</script>\n</body>')

# Replace topbar Title and Nav icons
html = html.replace('<span class="topbar-title">Admin Panel</span>', '<span class="topbar-title" style="display:flex;align-items:center;gap:6px"><i data-lucide="cake-slice" style="width:18px;height:18px"></i> Admin</span>')

html = html.replace('<button class="nav-tab active" onclick="showPage(\'orders\',this)">Buyurtmalar</button>', '<button class="nav-tab active" style="display:flex;align-items:center;justify-content:center;gap:6px" onclick="showPage(\'orders\',this)"><i data-lucide="shopping-bag" style="width:16px;height:16px"></i> Buyurtmalar</button>')
html = html.replace('<button class="nav-tab" onclick="showPage(\'stats\',this)">Statistika</button>', '<button class="nav-tab" style="display:flex;align-items:center;justify-content:center;gap:6px" onclick="showPage(\'stats\',this)"><i data-lucide="line-chart" style="width:16px;height:16px"></i> Statistika</button>')
html = html.replace('<button class="nav-tab" onclick="showPage(\'users\',this)">Foydalanuvchilar</button>', '<button class="nav-tab" style="display:flex;align-items:center;justify-content:center;gap:6px" onclick="showPage(\'users\',this)"><i data-lucide="users" style="width:16px;height:16px"></i> Mijozlar</button>')
html = html.replace('<button class="nav-tab" onclick="showPage(\'products\',this);loadProducts()">Mahsulotlar</button>', '<button class="nav-tab" style="display:flex;align-items:center;justify-content:center;gap:6px" onclick="showPage(\'products\',this);loadProducts()"><i data-lucide="package" style="width:16px;height:16px"></i> Mahsulotlar</button>')

# Change some button borders
new_button_style = """
    .btn { padding: 8px 16px; border-radius: 8px; border: 1px solid var(--border); cursor: pointer; font-size: 13px; font-weight: 600; transition: all .2s; }
    .btn-primary { background: var(--primary); color: #1a0610; border-color: var(--primary); }
    .btn-primary:hover { background: var(--primary-dark); }
"""
html = re.sub(r'\.btn\s*\{[^}]+\}\s*\.btn-primary\s*\{[^}]+\}\s*\.btn-primary:hover\s*\{[^}]+\}', new_button_style, html)

with open(path, 'w', encoding='utf-8') as f:
    f.write(html)
