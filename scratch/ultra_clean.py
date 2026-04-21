from PIL import Image
import numpy as np

def ultra_clean(input_path, output_path):
    # Load as RGBA
    img = Image.open(input_path).convert("RGBA")
    data = np.array(img)
    
    # Extract channels
    r, g, b, a = data[:,:,0], data[:,:,1], data[:,:,2], data[:,:,3]
    
    # Target exactly the checkerboard colors
    # Common grey in checkerboards is 204, 204, 204 (0xCC) or 199, 199, 199
    # White is 255, 255, 255
    
    # Mask 1: Pure White and near-white
    white_mask = (r > 245) & (g > 245) & (b > 245)
    
    # Mask 2: The typical grey squares
    # Often they are (204, 204, 204) or (153, 153, 153)
    # We use a threshold to find neutral greys that aren't part of the logo
    grey_mask = (np.abs(r.astype(int) - g.astype(int)) < 5) & \
                (np.abs(g.astype(int) - b.astype(int)) < 5) & \
                (r > 150) & (r < 210) 

    # Combine masks and set alpha to 0
    data[white_mask | grey_mask, 3] = 0
    
    # Create new image
    new_img = Image.fromarray(data)
    new_img.save(output_path, "PNG")
    print(f"Ultra clean finished: {output_path}")

if __name__ == "__main__":
    ultra_clean('apps/web/public/assets/logo.png', 'apps/web/public/assets/logo_v2.png')
