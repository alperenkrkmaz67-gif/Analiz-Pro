with open('auth.js', 'rb') as f:
    raw = f.read()

# Fix the broken condition
old = b"messageBox && path === '/' || path.endsWith('/index'))"
new = b"messageBox && (path === '/' || path.endsWith('/index')))"

if old in raw:
    raw = raw.replace(old, new)
    with open('auth.js', 'wb') as f:
        f.write(raw)
    print("Fixed!")
else:
    # Try alternate
    old2 = b"messageBox && path === '/' || path.endsWith('/index')"
    new2 = b"messageBox && (path === '/' || path.endsWith('/index'))"
    if old2 in raw:
        raw = raw.replace(old2, new2)
        with open('auth.js', 'wb') as f:
            f.write(raw)
        print("Fixed (alt)!")
    else:
        # Show what's there
        idx = raw.find(b'messageBox &&')
        print("Not found. Current:", repr(raw[idx:idx+100]))
