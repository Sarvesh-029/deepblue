"""
CareGuard Bharat - Model Downloader Script
Downloads lightweight OpenCV YuNet (Face Detection, ~335 KB)
and SFace (Face Recognition, ~10.7 MB) ONNX models from official OpenCV Zoo.
"""
import os
import sys
from pathlib import Path
import urllib.request
import urllib.error

# Determine target directory
CURRENT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = CURRENT_DIR.parent
TARGET_DIR = BACKEND_DIR / "models_data"

MODELS = {
    "face_detection_yunet_2023mar.onnx": [
        "https://huggingface.co/opencv/opencv_zoo/resolve/main/models/face_detection_yunet/face_detection_yunet_2023mar.onnx",
        "https://github.com/opencv/opencv_zoo/raw/main/models/face_detection_yunet/face_detection_yunet_2023mar.onnx?raw=true",
        "https://media.githubusercontent.com/media/opencv/opencv_zoo/main/models/face_detection_yunet/face_detection_yunet_2023mar.onnx"
    ],
    "face_recognition_sface_2021dec.onnx": [
        "https://huggingface.co/opencv/opencv_zoo/resolve/main/models/face_recognition_sface/face_recognition_sface_2021dec.onnx",
        "https://github.com/opencv/opencv_zoo/raw/main/models/face_recognition_sface/face_recognition_sface_2021dec.onnx?raw=true",
        "https://media.githubusercontent.com/media/opencv/opencv_zoo/main/models/face_recognition_sface/face_recognition_sface_2021dec.onnx"
    ]
}


def download_file_with_progress(urls, target_path):
    target_path.parent.mkdir(parents=True, exist_ok=True)
    if target_path.exists() and target_path.stat().st_size > 100000:
        print(f"[OK] {target_path.name} already exists ({target_path.stat().st_size / 1024:.1f} KB).")
        return True

    for url in urls:
        print(f"Downloading {target_path.name} from {url}...")
        try:
            req = urllib.request.Request(
                url,
                headers={"User-Agent": "CareGuard-Bharat-Downloader/1.0"}
            )
            with urllib.request.urlopen(req, timeout=30) as response, open(target_path, 'wb') as out_file:
                total_size = int(response.headers.get('content-length', 0))
                downloaded = 0
                chunk_size = 64 * 1024

                while True:
                    chunk = response.read(chunk_size)
                    if not chunk:
                        break
                    out_file.write(chunk)
                    downloaded += len(chunk)
                    if total_size > 0:
                        percent = (downloaded / total_size) * 100
                        sys.stdout.write(f"\r  Progress: {percent:.1f}% ({downloaded / (1024*1024):.2f} MB)")
                        sys.stdout.flush()

                print(f"\n[SUCCESS] Downloaded {target_path.name} ({target_path.stat().st_size / (1024*1024):.2f} MB)")
                return True
        except Exception as e:
            print(f"\n[WARN] Failed from {url}: {e}. Trying fallback mirror...")
            if target_path.exists():
                target_path.unlink()

    print(f"[ERROR] Could not download {target_path.name} from any mirror.")
    return False


def main():
    print("=" * 60)
    print("CareGuard Bharat: Downloading OpenCV Edge AI Models")
    print(f"Target Directory: {TARGET_DIR}")
    print("=" * 60)

    success = True
    for filename, urls in MODELS.items():
        dest = TARGET_DIR / filename
        if not download_file_with_progress(urls, dest):
            success = False

    if success:
        print("\nAll face models are downloaded and ready for CPU inference!")
    else:
        print("\nWarning: One or more models could not be downloaded. Ensure internet connectivity.")
    return 0 if success else 1


if __name__ == "__main__":
    sys.exit(main())
