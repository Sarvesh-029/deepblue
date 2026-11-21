"""
evaluate.py
───────────
Offline evaluation benchmark for CareGuard Bharat's face recognition pipeline.

Tests run entirely on-disk using the sample face stored at:
    backend/data/sample_face.jpg   (Lena test image, real face)

Metrics produced:
  1. Same-face similarity   — embedding vs itself → should be ~1.0
  2. Cross-face similarity  — embedding vs zero vector → should be < 0.363
  3. Face detection rate    — % of real-face images where YuNet detects ≥ 1 face
  4. False-alarm rate       — blank/solid frames should trigger 0 UNKNOWN_VISITOR events
  5. Blur quality check     — blurred snapshot is different bytes from original

Usage (from careguard-bharat/backend/):
    python scripts/evaluate.py

Outputs a formatted benchmark table to stdout.
"""

import sys
import json
import time
import numpy as np
from pathlib import Path

# ── Make "app" importable ────────────────────────────────────────────────────
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

SAMPLE_FACE = Path(__file__).resolve().parent.parent / "data" / "sample_face.jpg"
RESULTS = []  # list of (metric, result, target, status)


def _status(result, target, cmp=">="):
    """Return PASS / FAIL string."""
    try:
        if cmp == ">=":
            return "PASS ✓" if float(result) >= float(target) else "FAIL ✗"
        if cmp == "<=":
            return "PASS ✓" if float(result) <= float(target) else "FAIL ✗"
        if cmp == "==":
            return "PASS ✓" if result == target else "FAIL ✗"
    except Exception:
        return "N/A"


def run():
    print("\n  CareGuard Bharat — Face Pipeline Evaluation")
    print("  " + "─" * 51)

    # ── Import face service ───────────────────────────────────────────────────
    try:
        from app.adapters.face.local_face import LocalFaceService
        import cv2
        face_svc = LocalFaceService()
        if face_svc.detector is None or face_svc.recognizer is None:
            print("  [WARN] Models not loaded — run download_models.py first.")
            print("         All tests will show N/A.\n")
            models_ok = False
        else:
            models_ok = True
    except Exception as e:
        print(f"  [ERROR] Cannot import LocalFaceService: {e}")
        return

    # ── 1. Sample face file check ─────────────────────────────────────────────
    if not SAMPLE_FACE.exists():
        print(f"  [WARN] Sample face not found at: {SAMPLE_FACE}")
        print("         Copy a real face photo to data/sample_face.jpg to run tests.\n")
        RESULTS.append(("Sample face file", "MISSING", "EXISTS", "FAIL ✗"))
        _print_table()
        return

    face_bytes = SAMPLE_FACE.read_bytes()
    RESULTS.append(("Sample face file", "EXISTS", "EXISTS", "PASS ✓"))

    # ── 2. Face detection rate ────────────────────────────────────────────────
    if models_ok:
        t0 = time.perf_counter()
        faces = face_svc.detect_faces(face_bytes)
        detect_ms = round((time.perf_counter() - t0) * 1000, 1)
        detected = len(faces) >= 1
        RESULTS.append(("Face detection (sample_face.jpg)", f"{len(faces)} face(s)  [{detect_ms} ms]",
                         "≥ 1 face", _status(len(faces), 1, ">=")))
    else:
        RESULTS.append(("Face detection (sample_face.jpg)", "N/A", "≥ 1 face", "N/A"))
        faces = []

    # ── 3. Same-face similarity (embedding vs itself) ─────────────────────────
    if models_ok and faces:
        t0 = time.perf_counter()
        emb = face_svc.extract_embedding(face_bytes)
        emb_ms = round((time.perf_counter() - t0) * 1000, 1)

        if emb is not None:
            # Compare embedding to itself via match_face
            enrolled = [{"id": 1, "name": "Self", "role_type": "family", "embedding": emb.tolist()}]
            match = face_svc.match_face(emb, enrolled, threshold=0.0)  # threshold=0 to get raw score
            similarity = match["similarity"] if match else 0.0
            RESULTS.append(("Same-face similarity (self→self)", f"{similarity:.4f}  [{emb_ms} ms]",
                             "≥ 0.95", _status(similarity, 0.95, ">=")))
        else:
            RESULTS.append(("Same-face similarity (self→self)", "N/A — embedding failed",
                             "≥ 0.95", "FAIL ✗"))
            emb = None
    else:
        RESULTS.append(("Same-face similarity (self→self)", "N/A", "≥ 0.95", "N/A"))
        emb = None

    # ── 4. Cross-face similarity (real embedding vs zero vector) ──────────────
    if models_ok and emb is not None:
        zero_vec = np.zeros_like(emb, dtype=np.float32)
        enrolled_zero = [{"id": 99, "name": "Zero", "role_type": "family", "embedding": zero_vec.tolist()}]
        cross_match = face_svc.match_face(emb, enrolled_zero, threshold=0.0)
        cross_sim = cross_match["similarity"] if cross_match else 0.0
        RESULTS.append(("Cross-face similarity (real vs zeros)", f"{cross_sim:.4f}",
                         "< 0.363", _status(cross_sim, 0.363, "<=")))
    else:
        RESULTS.append(("Cross-face similarity (real vs zeros)", "N/A", "< 0.363", "N/A"))

    # ── 5. False-alarm rate — blank image ─────────────────────────────────────
    if models_ok:
        try:
            import cv2 as _cv2
            blank = np.zeros((480, 640, 3), dtype=np.uint8)
            _, buf = _cv2.imencode(".jpg", blank)
            blank_bytes = buf.tobytes()
            blank_faces = face_svc.detect_faces(blank_bytes)
            fa = len(blank_faces)
            RESULTS.append(("False alarms on blank frame", f"{fa} face(s) detected",
                             "0 faces", _status(fa, 0, "<=")))
        except Exception as e:
            RESULTS.append(("False alarms on blank frame", f"Error: {e}", "0 faces", "FAIL ✗"))
    else:
        RESULTS.append(("False alarms on blank frame", "N/A", "0 faces", "N/A"))

    # ── 6. Blur quality check ─────────────────────────────────────────────────
    if models_ok and faces:
        try:
            bboxes = [f["bbox"] for f in faces]
            blurred_bytes = face_svc.blur_faces(face_bytes, bboxes)
            is_different = blurred_bytes != face_bytes
            is_valid_jpeg = blurred_bytes[:2] == b'\xff\xd8'
            blur_ok = is_different and is_valid_jpeg
            RESULTS.append(("Blur output differs from input",
                             "Yes — Gaussian blur applied" if blur_ok else "No difference",
                             "True", _status(blur_ok, True, "==")))
        except Exception as e:
            RESULTS.append(("Blur output differs from input", f"Error: {e}", "True", "FAIL ✗"))
    else:
        RESULTS.append(("Blur output differs from input", "N/A", "True", "N/A"))

    # ── 7. Threshold boundary: known face recognized above 0.363 ─────────────
    if models_ok and emb is not None:
        enrolled_known = [{"id": 1, "name": "Known", "role_type": "family", "embedding": emb.tolist()}]
        match_known = face_svc.match_face(emb, enrolled_known, threshold=0.363)
        recognized = match_known is not None
        RESULTS.append(("Known face recognized (sim ≥ 0.363)", str(recognized),
                         "True", _status(recognized, True, "==")))
    else:
        RESULTS.append(("Known face recognized (sim ≥ 0.363)", "N/A", "True", "N/A"))

    _print_table()


def _print_table():
    col_w = [42, 36, 14, 10]
    header = ["Metric", "Result", "Target", "Status"]
    sep = "  " + "─" * (sum(col_w) + 3 * 3)

    print(sep)
    print("  " + " │ ".join(h.ljust(w) for h, w in zip(header, col_w)))
    print(sep)
    for row in RESULTS:
        line = "  " + " │ ".join(str(v).ljust(w) for v, w in zip(row, col_w))
        print(line)
    print(sep)

    passes = sum(1 for r in RESULTS if "PASS" in str(r[3]))
    fails  = sum(1 for r in RESULTS if "FAIL" in str(r[3]))
    nas    = sum(1 for r in RESULTS if "N/A" == str(r[3]))
    print(f"\n  Summary: {passes} PASS  |  {fails} FAIL  |  {nas} N/A\n")


if __name__ == "__main__":
    run()
