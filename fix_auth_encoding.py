
with open('auth.js', 'rb') as f:
    raw = f.read()

text = raw.decode('utf-8')

# Common broken Turkish char mappings (double-encoded UTF-8 as latin-1)
replacements = [
    ('Ã¼', 'ü'),
    ('Ã¶', 'ö'),
    ('Ã§', 'ç'),
    ('Ãž', 'Þ'),
    ('Ã‡', 'Ç'),
    ('Ã–', 'Ö'),
    ('Ãœ', 'Ü'),
    ('Ä±', 'ı'),
    ('Ä°', 'İ'),
    ('Åž', 'Ş'),
    ('Åı', 'şı'),
    ('Äž', 'Ğ'),
    ('Ä\x9f', 'ğ'),
    ('Å\x9f', 'ş'),
    ('Ã¢', 'â'),
    ('Ã©', 'é'),
    ('Ã\xbc', 'ü'),
    ('Ã\xb6', 'ö'),
    ('Ã\xa7', 'ç'),
    ('Ã\x87', 'Ç'),
    ('Ã\x96', 'Ö'),
    ('Ã\x9c', 'Ü'),
]

fixed_text = text
for broken, correct in replacements:
    fixed_text = fixed_text.replace(broken, correct)

remaining = fixed_text.count('\u00c3')
print('Remaining broken occurrences:', remaining)
if remaining > 0:
    idx = fixed_text.find('\u00c3')
    print('Context:', repr(fixed_text[max(0,idx-10):idx+20]))

with open('auth.js', 'w', encoding='utf-8') as f:
    f.write(fixed_text)
print('auth.js saved successfully')
