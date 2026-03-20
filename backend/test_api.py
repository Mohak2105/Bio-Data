import requests
import sys

def main():
    try:
        from PIL import Image, ImageDraw, ImageFont
        img = Image.new('RGB', (800, 600), color='white')
        d = ImageDraw.Draw(img)
        d.text((50, 50), "मुलाचे नाव: सिद्धार्थ पाटील", fill='black')
        img.save("test_bio.png")

        with open("test_bio.png", "rb") as f:
            resp = requests.post("http://localhost:8000/api/ocr/preview", files={"document": f})
        
        print(f"Status: {resp.status_code}")
        print("Response:", resp.json() if resp.status_code == 200 else resp.text)
    except Exception as e:
        print("Error:", e)

if __name__ == "__main__":
    main()
