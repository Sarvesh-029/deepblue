# Project Deep Blue: Abstract Draft
## Project Title: CareGuard Bharat - Privacy-First Smart Caregiver Safety & Monitoring System

### Problem Context
Millions of families in India rely on domestic caregivers to assist vulnerable elderly family members and infants while working outside the home. However, families often lack visibility into whether care shifts are honored or if emergencies occur. Conventional surveillance systems (CCTV) represent a severe intrusion into personal domestic privacy, run expensive cloud streaming, and leave vulnerable families susceptible to data leaks.

### Proposed Solution
**CareGuard Bharat** is a lightweight, edge-oriented, privacy-preserving intelligent monitoring system that transforms any standard smartphone or laptop web browser into a safety monitor without requiring specialized hardware or expensive cloud subscriptions.

By combining browser-side edge intelligence (motion filtering and TensorFlow.js audio distress detection) with a local computer vision pipeline (OpenCV YuNet and SFace), CareGuard Bharat identifies critical safety situations in real time:
1. **Unrecognized Visitors**: Alerts family if an unregistered face is detected in the monitored room.
2. **Dependent Unattended**: Flags situations where a dependent is left alone without a caregiver for a configurable time window.
3. **Caregiver Shift Adherence**: Automatically checks whether scheduled shifts are honored without intrusive continuous surveillance.
4. **Distress Audio Classification**: Detects acoustic signatures of distress (screams, crying, shouts) strictly within the local client browser without ever transmitting or storing raw audio.
5. **Dignity & Privacy Guarantees**: Guarantees zero raw video or audio storage, enforces irreversible Gaussian blurring on all saved snapshot evidence, provides consent workflows, and automates 7-day data destruction.

### Architectural Impact
CareGuard Bharat is designed with a cloud-ready adapter architecture, allowing 100% free, local offline execution on standard consumer hardware, while offering a 1-to-1 switch to AWS services (Rekognition, S3, SNS, DynamoDB) for scalable cloud deployments.
