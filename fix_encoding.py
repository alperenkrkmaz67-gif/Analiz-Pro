with open('auth.js', 'rb') as f:
    content = f.read()

# The file has double-encoded UTF-8 (Latin-1 bytes that are actually UTF-8 encoded again)
# Fix by decoding with latin-1 then re-encoding to utf-8
try:
    text = content.decode('utf-8')
except:
    text = content.decode('latin-1')

# Fix double-encoded Turkish characters
fixes = [
    ('yukarÄ±daki', 'yukarıdaki'),
    ('kÄ±smÄ±ndan', 'kısmından'),
    ('baÅlayabilirsiniz', 'başlayabilirsiniz'),
    ('Ã§in', 'için'),
    ('Vip almak iÃ§in', 'Analiz özelliklerine erişmek için VIP üyelik gereklidir. Bilgi için iletişime geçin.'),
    ('yukarÄ±daki VIP bÃ¶lÃ¼mÃ¼ne gidiniz.', ''),
    ('GiriÅ yapmalÄ±sÄ±nÄ±z', 'Giriş yapmalısınız'),
    ('giriÅ yapmalÄ±sÄ±nÄ±z', 'giriş yapmalısınız'),
    ('VIP sÃ¼reniz dolmuÅtur', 'VIP süreniz dolmuştur'),
    ('LÃ¼tfen yenileyiniz', 'Lütfen yenileyiniz'),
    ('Bu Ã¶zellik sadece VIP Ã¼yelere Ã¶zeldir', 'Bu özellik sadece VIP üyelere özeldir'),
    ('LÃ¼tfen Ã¶nce hesap oluÅturup giriÅ yapÄ±n', 'Lütfen önce hesap oluşturup giriş yapın'),
    ('Analiz iÃ§in giriÅ yapmalÄ±sÄ±nÄ±z', 'Analiz için giriş yapmalısınız'),
    ('ZiyaretÃ§i sayÄ±lamadÄ±', 'Ziyaretçi sayılamadı'),
    ('GÃ¼nlÃ¼k sayaÃ§ hatasÄ±', 'Günlük sayaç hatası'),
]

for old, new in fixes:
    if old in text:
        text = text.replace(old, new)
        print(f"Fixed: {old[:30]}")

with open('auth.js', 'w', encoding='utf-8') as f:
    f.write(text)

print("Done!")
