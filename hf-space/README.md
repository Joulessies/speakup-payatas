---
title: SpeakUp Payatas AI Classifier
emoji: 📢
colorFrom: blue
colorTo: green
sdk: docker
app_port: 7860
pinned: false
license: mit
---

# SpeakUp Payatas — AI Incident Classifier

A **Random Forest** machine-learning classifier that automatically categorises
barangay incident reports filed by residents of **Barangay Payatas, Quezon City**.

## Features

| Capability | Details |
|---|---|
| **Category classification** | 22 concern types from the EOC logbook |
| **Urgency detection** | LOW · MEDIUM · HIGH |
| **Department routing** | Maps to the correct barangay desk/unit |
| **Bilingual support** | English, Filipino, and Taglish (mixed) |
| **SMS-style text** | Handles "d2", "po", "brgy", "kc", etc. |

## API Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/predict` | Single text prediction |
| `POST` | `/api/batch` | Batch predictions |
| `GET` | `/api/health` | Health check |
| `GET` | `/api/model-info` | Model metadata & accuracy |

### Example — Single prediction

```bash
curl -X POST https://<space>.hf.space/api/predict \
  -H "Content-Type: application/json" \
  -d '{"text": "May nasusunog po sa Area A", "area": "AREA A"}'
```

### Response

```json
{
  "category": "fire_hazard",
  "category_label": "Fire and Disaster Alert",
  "urgency": "HIGH",
  "department": "BDRRM Office",
  "confidence": 0.92,
  "all_probabilities": { ... }
}
```

## Model Architecture

- **Text preprocessing** — Tagalog slang normalisation + stemmer → TF-IDF
  (8 000 features, unigrams + bigrams, sublinear TF)
- **Category model** — `RandomForestClassifier(n_estimators=100, class_weight='balanced')`
- **Urgency model** — separate Random Forest
- **Department router** — rule-based mapping from category + area

## Local Development

```bash
pip install -r requirements.txt
python train.py      # generates model/ artefacts
uvicorn app:app --host 0.0.0.0 --port 7860
```

## License

MIT — SpeakUp Payatas Project
