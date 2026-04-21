import cv2
import numpy as np

def professional_clean(input_path, output_path):
    # Load image
    img = cv2.imread(input_path, cv2.IMREAD_UNCHANGED)
    if img.shape[2] == 3:
        img = cv2.cvtColor(img, cv2.COLOR_BGR2BGRA)
    
    # 1. Identify background using Flood Fill from 4 corners
    h, w = img.shape[:2]
    mask = np.zeros((h+2, w+2), np.uint8)
    
    # Fill from corners (typical for checkerboard backgrounds)
    # We use a tolerance (loDiff/upDiff) because checkerboard has 2 colors
    cv2.floodFill(img, mask, (0,0), (0,0,0,0), loDiff=(20,20,20,20), upDiff=(20,20,20,20))
    cv2.floodFill(img, mask, (w-1,0), (0,0,0,0), loDiff=(20,20,20,20), upDiff=(20,20,20,20))
    cv2.floodFill(img, mask, (0,h-1), (0,0,0,0), loDiff=(20,20,20,20), upDiff=(20,20,20,20))
    cv2.floodFill(img, mask, (w-1,h-1), (0,0,0,0), loDiff=(20,20,20,20), upDiff=(20,20,20,20))
    
    # 2. Save result
    cv2.imwrite(output_path, img)
    print(f"Professional clean finished: {output_path}")

if __name__ == "__main__":
    # We clean the ORIGINAL logo.png, not the broken cleaned one
    professional_clean('apps/web/public/assets/logo.png', 'apps/web/public/assets/logo_master.png')
