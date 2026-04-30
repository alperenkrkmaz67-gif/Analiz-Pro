with open('auth.js', 'rb') as f:
    raw = f.read()

# Replace the entire problematic message block at byte level
old_block = raw[raw.find(b"messageBox.innerHTML = (user.role === 'vip' || user.role === 'admin') ?"):
               raw.find(b"messageBox.innerHTML = 'L") + raw[raw.find(b"messageBox.innerHTML = 'L"):].find(b"';") + 2]

new_block = (
    b"messageBox.innerHTML = (user.role === 'vip' || user.role === 'admin') ?\r\n"
    b"                    'Analizinizi yukar\xc4\xb1daki Analiz k\xc4\xb1sm\xc4\xb1ndan yapmaya ba\xc5\x9flayabilirsiniz.' :\r\n"
    b"                    'Analiz \xc3\xb6zelliklerine eri\xc5\x9fmek i\xc3\xa7in VIP \xc3\xbcyelik gereklidir. Bilgi i\xc3\xa7in ileti\xc5\x9fime ge\xc3\xa7in.';\r\n"
    b"            } else {\r\n"
    b"                messageBox.innerHTML = 'L\xc3\xbctfen \xc3\xb6nce hesap olu\xc5\x9fturup giri\xc5\x9f yap\xc4\xb1n.';"
)

start = raw.find(b"messageBox.innerHTML = (user.role === 'vip' || user.role === 'admin') ?")
temp = raw[start:]
end_marker = b"messageBox.innerHTML = 'L"
end_idx = start + temp.find(end_marker)
end_of_line = end_idx + raw[end_idx:].find(b"';") + 2

print(f"Replacing bytes {start} to {end_of_line}")
print("Old:", repr(raw[start:end_of_line]))
print()
print("New:", repr(new_block))

result = raw[:start] + new_block + raw[end_of_line:]

with open('auth.js', 'wb') as f:
    f.write(result)

print("\nDone! auth.js updated.")
