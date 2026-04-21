from PIL import Image, ImageFilter
import numpy as np

def final_rescue(input_path, output_path):
    # Load as RGBA
    img = Image.open(input_path).convert("RGBA")
    data = np.array(img)
    
    r, g, b, a = data[:,:,0], data[:,:,1], data[:,:,2], data[:,:,3]
    
    # ADVANCED NEUTRAL DETECTION
    # Neutral colors have very small differences between R, G, and B
    diff_rg = np.abs(r.astype(int) - g.astype(int))
    diff_gb = np.abs(g.astype(int) - b.astype(int))
    diff_br = np.abs(b.astype(int) - r.astype(int))
    
    # A pixel is neutral if all color components are within 10 units of each other
    neutral_mask = (diff_rg < 12) & (diff_gb < 12) & (diff_br < 12)
    
    # We only want to remove LIGHT or MEDIUM neutrals (background squares)
    # The logo might have very dark neutrals (blacks) that we want to keep
    bright_neutral_mask = neutral_mask & (r > 120) 
    
    # Apply transparency
    data[bright_neutral_mask, 3] = 0
    
    # Create new image
    new_img = Image.fromarray(data)
    
    # Clean up stray pixels (Despeckle)
    # We use a small median filter on the alpha channel to remove isolated "dots"
    alpha = new_img.getchannel('A')
    alpha = alpha.filter(ImageFilter.MedianFilter(size=3))
    new_img.putalpha(alpha)
    
    new_img.save(output_path, "PNG")
    print(f"Final Rescue finished: {output_path}")

if __name__ == "__main__":
    final_rescue('apps/web/public/assets/logo.png', 'apps/web/public/assets/logo_final_master.png')
