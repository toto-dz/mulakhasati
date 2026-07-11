from PIL import Image
img = Image.open('D:\\resumé_api\\scripts\\img_hero.png')
pixels = img.load()

width, height = img.size

# For each column, find the range of y that has non-white pixels
col_ranges = {}
for x in range(width):
    min_y = height
    max_y = 0
    for y in range(height):
        r, g, b = pixels[x, y][:3]
        if not (r > 240 and g > 240 and b > 240):
            if y < min_y:
                min_y = y
            if y > max_y:
                max_y = y
    if max_y >= min_y:
        col_ranges[x] = (min_y, max_y)

# Find columns with significant vertical span
print('Columns with vertical span > 200px:')
for x in range(width):
    if x in col_ranges:
        span = col_ranges[x][1] - col_ranges[x][0]
        if span > 200:
            print(f'  x={x}: y={col_ranges[x][0]} to {col_ranges[x][1]} (span={span})')

# Find where content becomes sparse on the right
print('\nRightmost columns with span > 100px:')
for x in range(width - 1, 0, -1):
    if x in col_ranges:
        span = col_ranges[x][1] - col_ranges[x][0]
        if span > 100:
            print(f'  x={x}: span={span}')
            break

# Check white space areas more carefully
# At x=800, what's the vertical span?
if 800 in col_ranges:
    print(f'\nx=800: y={col_ranges[800][0]} to {col_ranges[800][1]}')
else:
    print('\nx=800: all white')

# Check x=1000
if 1000 in col_ranges:
    print(f'x=1000: y={col_ranges[1000][0]} to {col_ranges[1000][1]}')
else:
    print('x=1000: all white')

# Check x=1200
if 1200 in col_ranges:
    print(f'x=1200: y={col_ranges[1200][0]} to {col_ranges[1200][1]}')
else:
    print('x=1200: all white')
