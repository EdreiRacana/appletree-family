from PIL import Image, ImageDraw

def simple_flood_clean(input_path, output_path):
    # Load as RGBA
    img = Image.open(input_path).convert("RGBA")
    
    # We flood fill from the 4 corners
    # Tolerance is handled by checking a small region or just filling the specific checkerboard colors
    # PIL's floodfill handles solid colors. Since checkerboard has 2 colors, 
    # we we identify them from the pixels at (0,0) and (1,0)
    
    color1 = img.getpixel((0, 0))
    color2 = img.getpixel((1, 0)) # Usually the other checkerboard color
    
    # List of points to start from (the 4 corners)
    w, h = img.size
    corners = [(0, 0), (w-1, 0), (0, h-1), (w-1, h-1)]
    
    for corner in corners:
        # Fill both possible checkerboard colors if they match
        ImageDraw.floodfill(img, corner, (0, 0, 0, 0), thresh=20)
        # Also try a neighbor to catch the second checkerboard color
        ImageDraw.floodfill(img, (corner[0]+1 if corner[0]==0 else corner[0]-1, corner[1]), (0, 0, 0, 0), thresh=20)

    img.save(output_path, "PNG")
    print(f"Simple flood clean finished: {output_path}")

if __name__ == "__main__":
    simple_flood_clean('apps/web/public/assets/logo.png', 'apps/web/public/assets/logo_master.png')
