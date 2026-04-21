from PIL import Image
import numpy as np

def remove_checkerboard(input_path, output_path):
    img = Image.open(input_path).convert("RGBA")
    data = np.array(img)
    
    # Typical checkerboard colors (approx)
    # White: 255, 255, 255
    # Grey: 204, 204, 204 (often seen in editors)
    
    r, g, b, a = data[:,:,0], data[:,:,1], data[:,:,2], data[:,:,3]
    
    # Logic: If R,G,B are very close to 255 (white) OR very close to 204 (grey)
    # AND it's in the background area (we can't know for sure, so we use color matching)
    
    white_mask = (r > 240) & (g > 240) & (b > 240)
    grey_mask = (r > 190) & (r < 220) & (g > 190) & (g < 220) & (b > 190) & (b < 220)
    
    # Apply transparency to these pixels
    data[white_mask | grey_mask, 3] = 0
    
    new_img = Image.fromarray(data)
    new_img.save(output_path, "PNG")
    print(f"Processed {input_path} and saved to {output_path}")

if __name__ == "__main__":
    remove_checkerboard('apps/web/public/assets/logo.png', 'apps/web/public/assets/logo_clean.png')
