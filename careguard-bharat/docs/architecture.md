# CareGuard Bharat - System Architecture & Design

## 1. Problem Statement & Motivation
In urban and semi-urban households across Bharat, nuclear and working families increasingly depend on domestic caregivers (ayahs, nurses, domestic assistants) to care for elderly parents or young children. Working family members face constant anxiety regarding adherence to care routines and the prompt detection of emergencies.

Traditional commercial CCTV monitoring introduces severe privacy intrusions and risks transmitting raw private footage to commercial cloud servers. **CareGuard Bharat** solves this with a **privacy-first edge monitoring system**:
- Turns any everyday phone, tablet, or laptop browser into an intelligent safety sentinel.
- **Never records or stores raw video or raw audio**.
- Runs browser-side motion filtering and audio ML (YAMNet) to keep unneeded data off the wire.
- Blurs all faces in stored event snapshots to preserve dignity and privacy.
- Uses explicit consent protocols prior to face enrollment or room monitoring.

---

## 2. Cloud-Ready Hexagonal Architecture (Adapters Pattern)

To allow zero-cost local execution during development/hackathons while ensuring immediate readiness for AWS deployment, all core operations are abstracted behind strict Adapter interfaces. The Rules Engine and API routes interact *only* with these interfaces:

```
+--------------------------------------------------------------+
|                     CareGuard Bharat API                     |
|                 (FastAPI + JWT Auth + CORS)                  |
+--------------------------------------------------------------+
                               |
                               v
+--------------------------------------------------------------+
|                         Rules Engine                         |
|  - UNKNOWN_VISITOR       - DEPENDENT_UNATTENDED              |
|  - CAREGIVER_ABSENT      - DISTRESS_SOUND                    |
+--------------------------------------------------------------+
        |                  |                 |             |
        v                  v                 v             v
+---------------+  +---------------+  +------------+  +-----------+
|  FaceService  |  |SnapshotStorage|  |AlertService|  |EventStore |
|  [Interface]  |  |  [Interface]  |  | [Interface]|  |[Interface]|
+---------------+  +---------------+  +------------+  +-----------+
        |                  |                 |             |
  +-----+-----+      +-----+-----+     +-----+-----+  +----+----+
  |           |      |           |     |           |  |         |
LocalFace    AWS    Local     AWS S3  In-App/     AWS  SQLite    AWS
(YuNet+     Rekog-  Storage   Storage  SMTP       SNS  (SQLAlchemy) DynamoDB
SFace)      nition
[NOW]       [LATER]  [NOW]    [LATER]  [NOW]    [LATER] [NOW]   [LATER]
```

### Adapter Definitions:
1. **FaceService**:
   - `LocalFaceService` (Current): OpenCV `FaceDetectorYN` (YuNet) + `FaceRecognizerSF` (SFace) running locally on CPU. Fast, zero cloud cost, no dlib.
   - `RekognitionFaceService` (AWS Target): Swaps to AWS Rekognition Face Search Collection via Boto3.
2. **SnapshotStorage**:
   - `LocalStorage` (Current): Stores blurred JPEG frames on local disk with 7-day automated pruning.
   - `S3Storage` (AWS Target): Encrypted Amazon S3 bucket with Lifecycle rule for 7-day expiration.
3. **AlertService**:
   - `LocalAlertService` (Current): In-app live alert ring buffer + optional standard SMTP email notifications.
   - `SNSAlertService` (AWS Target): Dispatches alerts via Amazon SNS (SMS / Push).
4. **EventStore**:
   - `SQLiteEventStore` (Current): Local SQLite database managed via SQLAlchemy.
   - `DynamoDBEventStore` (AWS Target): Amazon DynamoDB table with TTL enabled on events.

---

## 3. Privacy-First Guarantees
- **No Raw Video / Audio Persistence**: Audio is processed entirely client-side inside the browser using WebAssembly / TensorFlow.js YAMNet. Video streams are never streamed or recorded; only sporadic frames during detected motion are sent.
- **Client-Side Throttling**: Frames are throttled to at most 1 frame per 4–5 seconds and downscaled to 640px maximum width.
- **Mandatory Face Blurring**: Any frame saved as an event snapshot has all detected facial regions heavily Gaussian blurred.
- **7-Day Retention Limit**: Scheduled task removes snapshots older than 7 days automatically.
- **Consent Logs**: Enrolling any face or starting the monitor requires explicit consent logging.
