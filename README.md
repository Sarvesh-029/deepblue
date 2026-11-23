# CareGuard Bharat

> Privacy-conscious caregiver monitoring prototype built for Project Deep Blue.

CareGuard Bharat helps families monitor caregiver presence and safety-related events through a browser-based room monitor, a dashboard, and a lightweight API. It is designed to run on everyday devices and uses local processing and storage adapters for development.

**Live demo:** [deepblue-mu.vercel.app](https://deepblue-mu.vercel.app)  
**Application source:** [`careguard-bharat/`](careguard-bharat/)

> **Important:** This project is a prototype and is not a medical device, emergency response service, or replacement for human supervision. Do not rely on it as the sole means of ensuring anyone’s safety.

## What it does

- **Caregiver and family accounts** with authenticated access.
- **Person enrollment** with an explicit consent flow.
- **Room monitoring** using a browser camera, with motion-triggered frame processing.
- **Safety event detection and logging**, including unknown visitors, caregiver presence or absence, unattended dependents, and detected distress sounds.
- **Dashboard and alerts** for reviewing events, presence, shifts, and snapshots.
- **Privacy-focused handling:** audio analysis runs in the browser; snapshots are blurred before storage and configured for automatic retention cleanup.
- **Adapter-based backend** for face recognition, storage, alerts, and event persistence.

Detection and alerting depend on device capabilities, permissions, configuration, and the availability of the downloaded recognition models. See the [application README](careguard-bharat/README.md) for implementation details and known limitations.

## Technology

| Area | Stack |
| --- | --- |
| Frontend | React 18, Vite, Tailwind CSS |
| Backend | Python, FastAPI, Uvicorn |
| Database | SQLite, SQLAlchemy |
| Face processing | OpenCV YuNet and SFace ONNX models |
| Browser audio | TensorFlow.js YAMNet |

## Repository layout

```text
.
├── careguard-bharat/
│   ├── backend/       # FastAPI application, rules, adapters, and scripts
│   ├── frontend/      # React application
│   ├── docs/          # Architecture and project documentation
│   ├── .env.example   # Local configuration template
│   └── README.md      # Detailed setup, features, and implementation notes
├── data/              # Repository-level demo data
└── careguard.db       # SQLite database file
```

## Run locally

### Prerequisites

- Python 3.12 recommended
- Node.js 18 or later and npm

### 1. Configure the backend

```bash
git clone https://github.com/Sarvesh-029/deepblue.git
cd deepblue/careguard-bharat
cp .env.example .env
```

On Windows Command Prompt, use `copy .env.example .env` instead of `cp`.

Review `.env` before running the application. In particular, set a strong, unique `SECRET_KEY` for any non-local deployment. Do not commit `.env` or production credentials.

### 2. Install and start the API

```bash
cd backend
python -m venv .venv
```

Activate the virtual environment, then install dependencies and download the face models:

```bash
# macOS / Linux
source .venv/bin/activate

# Windows PowerShell
# .venv\Scripts\Activate.ps1

pip install -r requirements.txt
python scripts/download_models.py
uvicorn app.main:app --reload --port 8000
```

The API documentation is available at [http://localhost:8000/docs](http://localhost:8000/docs).

### 3. Install and start the frontend

In another terminal:

```bash
cd deepblue/careguard-bharat/frontend
npm install
npm run dev
```

Open the local address printed by Vite (typically [http://localhost:5173](http://localhost:5173)). Camera and microphone features require browser permission. For production use, serve the app over HTTPS.

### Optional: seed demo data

To populate a local development database with sample account and event data, run this from `careguard-bharat/backend`:

```bash
python scripts/seed_demo_data.py
```

The seed script provides demo credentials; consult its output or the [detailed application README](careguard-bharat/README.md) for the current values. Demo face embeddings are synthetic and are not suitable for real recognition.

## Configuration and privacy

Configuration is documented in [`careguard-bharat/.env.example`](careguard-bharat/.env.example). The local setup uses SQLite and local storage by default. Review the application’s [privacy notes and limitations](careguard-bharat/README.md#privacy-by-design-guarantees) before use, and obtain informed consent from everyone who may be monitored. Do not use real or sensitive personal data in a demo environment.

The privacy measures described in the project documentation are implementation goals and should not be treated as a security or compliance certification. Verify the behavior and deployment configuration for your use case.

## Documentation

- [Detailed setup, capabilities, and limitations](careguard-bharat/README.md)
- [Architecture overview](careguard-bharat/docs/architecture.md)
- [Project abstract](careguard-bharat/docs/abstract_draft.md)

## Contributing

Contributions and feedback are welcome. For changes, please include a clear description and test the affected frontend or backend components locally. Avoid including secrets, personal data, or unblurred imagery in commits or issue reports.

## License

No license is currently specified in this repository. Unless a license is added, standard copyright restrictions apply; please contact the repository owner before reusing or distributing the code.
