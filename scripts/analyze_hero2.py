from PIL import Image
img = Image.open('D:\\resumé_api\\scripts\\img_hero.png')
pixels = img.load()

width, height = img.size

# Find the rightmost column that has significant non-white content
# We'll check each x column and count non-white pixels
col_nonwhite = {}
for x in range(width):
    count = 0
    for y in range(height):
        r, g, b = pixels[x, y][:3]
        if not (r > 240 and g > 240 and b > 240):
            count += 1
    col_nonwhite[x] = count

# Find where content drops significantly
for x in range(width):
    if col_nonwhite[x] < 10:  # very few colored pixels
        print(f'Column {x} has only {col_nonwhite[x]} colored pixels')
        if x > 200:
            break

# Print columns with significant content
print('\nColumns with >100 colored pixels:')
significant_cols = [x for x, c in col_nonwhite.items() if c > 100]
if significant_cols:
    print(f'  First: {significant_cols[0]}, Last: {significant_cols[-1]}')
    print(f'  Content spans {significant_cols[-1] - significant_cols[0]} pixels ({(significant_cols[-1] - significant_cols[0])/width*100:.0f}%)')

# Print columns with >50 colored pixels
significant_cols_50 = [x for x, c in col_nonwhite.items() if c > 50]
if significant_cols_50:
    print(f'\nColumns with >50 colored pixels:')
    print(f'  First: {significant_cols_50[0]}, Last: {significant_cols_50[-1]}')
    print(f'  Content spans {significant_cols_50[-1] - significant_cols_50[0]} pixels ({(significant_cols_50[-1] - significant_cols_50[0])/width*100:.0f}%)')

# Check right edge more carefully
print('\nRightmost 200 columns with any colored pixels:')
for x in range(width - 1, width - 201, -1):
    if col_nonwhite[x] > 0:
        print(f'  x={x}: {col_nonwhite[x]} colored pixels')
        if col_nonwhite[x] < 5:
            break
