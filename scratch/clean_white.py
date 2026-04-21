from PIL import Image, ImageOps
import numpy as np

def clean_white_background(input_path, output_path):
    # Load as RGBA
    img = Image.open(input_path).convert("RGBA")
    data = np.array(img)
    
    r, g, b, a = data[:,:,0], data[:,:,1], data[:,:,2], data[:,:,3]
    
    # White detection: Very high values in R, G, and B
    # We use a slight tolerance to catch near-whites
    white_mask = (r > 245) & (g > 245) & (b > 245)
    
    # Apply transparency to white areas
    data[white_mask, 3] = 0
    
    # Create new image
    new_img = Image.fromarray(data)
    
    # Smooth the edges of the transparency
    # We can do this by slightly blurring the alpha channel
    # but a better way for professional look is to just ensure the mask is clean.
    
    new_img.save(output_path, "PNG")
    print(f"White background clean finished: {output_path}")

if __name__ == "__main__":
    clean_white_background('apps/web/public/assets/logo.png', 'apps/web/public/assets/logo_white_clean.png')
