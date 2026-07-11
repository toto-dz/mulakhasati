from pathlib import Path

p = Path('summaries.html')
text = p.read_text(encoding='utf-8')
start = text.find('</main>\n<div class="relative aspect-[4/3] overflow-hidden">')
end = text.rfind('<footer class="w-full mt-lg bg-surface-container-low border-t border-outline-variant">')
if start == -1 or end == -1 or end <= start:
    raise SystemExit('Markers not found')
p.write_text(text[:start] + '</main>\n' + text[end:], encoding='utf-8')
print('cleaned summaries.html')
