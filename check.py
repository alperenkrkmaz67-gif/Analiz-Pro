f = open('auth.js', 'r', encoding='utf-8').read()
idx = f.find('Analizinizi')
snippet = f[idx:idx+300]
open('snippet.txt', 'w', encoding='utf-8').write(snippet)
print("Written to snippet.txt")
