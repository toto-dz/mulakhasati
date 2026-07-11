from PIL import Image
img = Image.open('D:\\resumé_api\\scripts\\img_hero.png')
pixels = img.load()

width, height = img.size
print(f'Image: {width}x{height}')

# Check horizontal slices for non-white pixels
for y in [100, 300, 500, 700, 900]:
    row_colors = []
    for x in range(0, width, 50):
        r, g, b = pixels[x, y][:3]
        is_white = r > 240 and g > 240 and b > 240
        row_colors.append('W' if is_white else 'C')
    print(f'y={y}: {"".join(row_colors)}')

# Check vertical slices
for x in [100, 300, 500, 700, 900, 1100, 1300]:
    col_colors = []
    for y in range(0, height, 50):
        r, g, b = pixels[x, y][:3]
        is_white = r > 240 and g > 240 and b > 240
        col_colors.append('W' if is_white else 'C')
    print(f'x={x}: {"".join(col_colors)}')

# Find approximate right boundary of non-white content
non_white_right = 0
for y in range(0, height, 10):
    for x in range(width - 1, 0, -1):
        r, g, b = pixels[x, y][:3]
        if not (r > 240 and g > 240 and b > 240):
            if x > non_white_right:
                non_white_right = x
            break

print(f'Rightmost non-white pixel: {non_white_right} (~{non_white_right/width*100:.0f}% of width)')
