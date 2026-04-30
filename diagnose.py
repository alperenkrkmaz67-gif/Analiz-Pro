with open('auth.js', 'rb') as f:
    raw = f.read()

# The problematic section - replace the whole messageBox block
# Find the start of the problematic innerHTML assignment
marker_start = b"messageBox.innerHTML = (user.role === 'vip' || user.role === 'admin') ?"
marker_end = b"messageBox.innerHTML = 'L"

idx_start = raw.find(marker_start)
idx_end = raw.find(marker_end, idx_start)

# Find end of second line (after the closing quote and semicolon)
idx_end2 = raw.find(b"';", idx_end)

print(f"Start: {idx_start}, End: {idx_end}, End2: {idx_end2}")
print("Before fix:")
print(repr(raw[idx_start:idx_end2+5]))
