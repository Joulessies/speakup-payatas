"""
app.py — SpeakUp Payatas Random Forest Incident Classifier.

FastAPI REST API + Interactive Gradio UI mounted on Hugging Face Spaces.
Provides:
  - POST /api/predict     (Single prediction)
  - POST /api/batch       (Batch predictions)
  - GET  /api/health      (Health check)
  - GET  /api/model-info  (Model metadata & accuracy)
  - /                     (Interactive Gradio Web UI)
"""

import os
import json
from typing import List, Optional, Dict
import numpy as np
import joblib
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import gradio as gr

from train import (
    preprocess_text,
    train_and_save,
    CATEGORY_LABELS,
    CATEGORY_DEPT_MAP,
    AREA_BASE_MAP,
    CATEGORY_URGENCY_MAP,
)

# ─────────────────────────── Model Loading ───────────────────────────

MODEL_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "model")


def load_artifacts():
    meta_path = os.path.join(MODEL_DIR, "metadata.json")
    if not os.path.exists(meta_path):
        print("[App] Models not found on disk. Running training pipeline...")
        train_and_save()

    print("[App] Loading joblib models and metadata...")
    tfidf_cat = joblib.load(os.path.join(MODEL_DIR, "tfidf_category.joblib"))
    rf_cat = joblib.load(os.path.join(MODEL_DIR, "rf_category.joblib"))
    tfidf_urg = joblib.load(os.path.join(MODEL_DIR, "tfidf_urgency.joblib"))
    rf_urg = joblib.load(os.path.join(MODEL_DIR, "rf_urgency.joblib"))

    with open(meta_path, "r", encoding="utf-8") as f:
        metadata = json.load(f)

    print(f"[App] Loaded {metadata.get('model_name')} v{metadata.get('version')}")
    return tfidf_cat, rf_cat, tfidf_urg, rf_urg, metadata


tfidf_category, rf_category, tfidf_urgency, rf_urgency, model_metadata = load_artifacts()

# ─────────────────────────── Core Predictor ───────────────────────────


def predict_single(text: str, area: str = "") -> dict:
    clean = preprocess_text(text)
    if not clean.strip():
        return {
            "category": "other",
            "category_label": CATEGORY_LABELS.get("other", "Others"),
            "urgency": "LOW",
            "department": "Secretary",
            "confidence": 0.0,
            "all_probabilities": {cat: 0.0 for cat in model_metadata.get("categories", [])},
        }

    # 1. Category Prediction
    X_cat = tfidf_category.transform([clean])
    probs = rf_category.predict_proba(X_cat)[0]
    classes = rf_category.classes_
    best_idx = int(np.argmax(probs))
    best_cat = str(classes[best_idx])
    confidence = float(probs[best_idx])

    all_probs = {str(c): round(float(p), 4) for c, p in zip(classes, probs)}
    all_probs_sorted = dict(sorted(all_probs.items(), key=lambda item: item[1], reverse=True))

    # 2. Urgency Prediction
    X_urg = tfidf_urgency.transform([clean])
    u_probs = rf_urgency.predict_proba(X_urg)[0]
    u_classes = rf_urgency.classes_
    u_best_idx = int(np.argmax(u_probs))
    predicted_urgency = str(u_classes[u_best_idx])
    urgency_conf = float(u_probs[u_best_idx])
    if urgency_conf < 0.35:
        predicted_urgency = CATEGORY_URGENCY_MAP.get(best_cat, "MEDIUM")

    # 3. Department Routing
    dept = CATEGORY_DEPT_MAP.get(best_cat, "Secretary")
    area_norm = area.strip().upper()
    if area_norm in AREA_BASE_MAP and best_cat in ("safety_concern", "noise_nuisance", "threats_harassment"):
        dept = AREA_BASE_MAP[area_norm]

    return {
        "category": best_cat,
        "category_label": CATEGORY_LABELS.get(best_cat, best_cat),
        "urgency": predicted_urgency,
        "department": dept,
        "confidence": round(confidence, 4),
        "all_probabilities": all_probs_sorted,
    }


# ─────────────────────────── FastAPI App ───────────────────────────

app = FastAPI(
    title="SpeakUp Payatas AI Classifier",
    description="Random Forest & NLP incident triage for Barangay Payatas, Quezon City",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class PredictRequest(BaseModel):
    text: str
    area: Optional[str] = ""


class BatchRequest(BaseModel):
    texts: List[str]
    areas: Optional[List[str]] = None


@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "model_name": model_metadata.get("model_name"),
        "version": model_metadata.get("version"),
        "total_categories": len(model_metadata.get("categories", [])),
    }


@app.get("/api/model-info")
def model_info():
    return model_metadata


@app.post("/api/predict")
def api_predict(req: PredictRequest):
    if not req.text or not req.text.strip():
        raise HTTPException(status_code=400, detail="Missing or empty text field")
    return predict_single(req.text, req.area or "")


@app.post("/api/batch")
def api_batch(req: BatchRequest):
    if not req.texts:
        raise HTTPException(status_code=400, detail="Missing texts array")
    results = []
    areas = req.areas or [""] * len(req.texts)
    for i, text in enumerate(req.texts):
        area = areas[i] if i < len(areas) else ""
        results.append(predict_single(text, area))
    return results


# ─────────────────────────── Gradio Interface ───────────────────────────


def gradio_predict(text: str, area: str):
    res = predict_single(text, area)
    # Return formatted label for top classes
    top_classes = {
        CATEGORY_LABELS.get(cat, cat): prob
        for cat, prob in list(res["all_probabilities"].items())[:5]
    }
    return (
        top_classes,
        f"{res['category_label']} ({res['category']})",
        res["urgency"],
        res["department"],
        res["confidence"],
        res,
    )


with gr.Blocks(title="SpeakUp Payatas AI Classifier", theme=gr.themes.Soft()) as demo:
    gr.Markdown(
        """
        # 📢 SpeakUp Payatas — Incident Classifier
        **Random Forest & NLP automated triage** for Barangay Payatas EOC (Emergency Operations Center).
        Classifies incoming citizen reports into **22 concern categories**, detects **urgency level**, and routes to the **appropriate response department or base patrol**.
        """
    )

    with gr.Row():
        with gr.Column(scale=3):
            input_text = gr.Textbox(
                label="Incident Description (English, Tagalog, or Taglish)",
                placeholder="e.g. Bumabaha po sa may tulay sa Area A, barado ang kanal...",
                lines=4,
            )
            input_area = gr.Dropdown(
                label="Area (Optional)",
                choices=["", "AREA A", "AREA B", "LUPANG PANGAKO", "GROUP 13", "OTHERS"],
                value="",
            )
            submit_btn = gr.Button("Analyze Report", variant="primary")

        with gr.Column(scale=2):
            output_label = gr.Label(num_top_classes=5, label="Category Predictions (Top 5)")
            with gr.Row():
                output_urgency = gr.Textbox(label="Urgency Level")
                output_dept = gr.Textbox(label="Assigned Department")
            with gr.Row():
                output_cat_name = gr.Textbox(label="Classified Category")
                output_conf = gr.Number(label="Confidence Score")

    with gr.Accordion("Raw JSON Response (for Next.js API Integration)", open=False):
        output_json = gr.JSON(label="Full API Response")

    submit_btn.click(
        fn=gradio_predict,
        inputs=[input_text, input_area],
        outputs=[
            output_label,
            output_cat_name,
            output_urgency,
            output_dept,
            output_conf,
            output_json,
        ],
    )

    gr.Examples(
        examples=[
            ["May nasusunog po na bahay malapit sa palengke ng Lupang Pangako! Tulong po!", "LUPANG PANGAKO"],
            ["Barado po ang kanal dito sa Area A, umaapaw na ang maitim na tubig kapag umuulan.", "AREA A"],
            ["Loud karaoke music at videoke party sa tapat namin madaling araw na po maingay.", "AREA B"],
            ["Nakasabit at lumalaylay po ang kawad ng kuryente, may spark po minsan.", "GROUP 13"],
            ["May nangyaring banggaan ng motor at tricycle sa kanto, may sugatan po.", "AREA A"],
            ["Pumunta po ako para mag-apply ng barangay clearance at certificate of indigency.", ""],
            ["Pakisundo po ang tambak na basura sa tapat ng eskwelahan, mabaho na po.", "AREA B"],
        ],
        inputs=[input_text, input_area],
    )

app = gr.mount_gradio_app(app, demo, path="/")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=7860, reload=True)

