"""
Train the classical text-emotion baseline (TF-IDF + Logistic Regression) on GoEmotions,
map it to the Empathetic AI taxonomy, calibrate it with temperature scaling and export
a JSON model that the TypeScript runtime (apps/web/src/lib/emotion/baseline.ts) can run
without Python.

Usage:
    python services/ml/train_text_baseline.py --data data/goemotions --out apps/web/src/lib/emotion/model

Data: https://github.com/google-research/google-research/tree/master/goemotions/data
(train.tsv, dev.tsv, test.tsv, emotions.txt). GoEmotions is released under CC BY 4.0.
Reddit comments are not clinical data and are not a safety ground truth.
"""

from __future__ import annotations

import argparse
import json
import math
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import sklearn
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    classification_report,
    confusion_matrix,
    f1_score,
    log_loss,
)

TAXONOMY = ["joy", "sadness", "anger", "fear_anxiety", "frustration", "calm", "neutral"]

# GoEmotions label -> Empathetic AI taxonomy. Labels mapped to None are ambiguous for
# this taxonomy (curiosity, confusion, surprise, realization, desire) and are dropped.
GOEMOTIONS_MAP = {
    "admiration": "joy",
    "amusement": "joy",
    "approval": "joy",
    "caring": "joy",
    "excitement": "joy",
    "gratitude": "joy",
    "joy": "joy",
    "love": "joy",
    "optimism": "joy",
    "pride": "joy",
    "relief": "calm",
    "sadness": "sadness",
    "grief": "sadness",
    "disappointment": "sadness",
    "remorse": "sadness",
    "embarrassment": "sadness",
    "anger": "anger",
    "disgust": "anger",
    "annoyance": "frustration",
    "disapproval": "frustration",
    "fear": "fear_anxiety",
    "nervousness": "fear_anxiety",
    "neutral": "neutral",
    "curiosity": None,
    "confusion": None,
    "surprise": None,
    "realization": None,
    "desire": None,
}

TOKEN_PATTERN = r"(?u)\b\w\w+\b"


def load_split(path: Path, names: list[str]):
    texts, labels = [], []
    dropped_conflict = dropped_unmapped = 0
    for line in path.read_text(encoding="utf-8").splitlines():
        parts = line.split("\t")
        if len(parts) < 2:
            continue
        text, ids = parts[0], parts[1]
        mapped = {GOEMOTIONS_MAP[names[int(i)]] for i in ids.split(",")}
        mapped.discard(None)
        if not mapped:
            dropped_unmapped += 1
            continue
        if len(mapped) > 1:
            dropped_conflict += 1  # mixed emotions: handled at runtime by abstention
            continue
        texts.append(text)
        labels.append(TAXONOMY.index(mapped.pop()))
    return texts, np.array(labels), {"dropped_conflict": dropped_conflict, "dropped_unmapped": dropped_unmapped}


def softmax(z: np.ndarray) -> np.ndarray:
    z = z - z.max(axis=1, keepdims=True)
    e = np.exp(z)
    return e / e.sum(axis=1, keepdims=True)


def fit_temperature(logits: np.ndarray, y: np.ndarray) -> float:
    best_t, best_nll = 1.0, float("inf")
    for t in np.arange(0.3, 4.01, 0.05):
        nll = log_loss(y, softmax(logits / t), labels=list(range(len(TAXONOMY))))
        if nll < best_nll:
            best_t, best_nll = float(t), nll
    return round(best_t, 2)


def expected_calibration_error(probs: np.ndarray, y: np.ndarray, bins: int = 10) -> float:
    conf = probs.max(axis=1)
    pred = probs.argmax(axis=1)
    ece = 0.0
    for lo in np.linspace(0, 1, bins, endpoint=False):
        mask = (conf > lo) & (conf <= lo + 1 / bins)
        if mask.any():
            ece += mask.mean() * abs((pred[mask] == y[mask]).mean() - conf[mask].mean())
    return float(ece)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default="data/goemotions")
    ap.add_argument("--out", default="apps/web/src/lib/emotion/model")
    ap.add_argument("--max-features", type=int, default=4000)
    args = ap.parse_args()

    data = Path(args.data)
    names = [n.strip() for n in (data / "emotions.txt").read_text().splitlines() if n.strip()]
    xtr, ytr, st_tr = load_split(data / "train.tsv", names)
    xdv, ydv, _ = load_split(data / "dev.tsv", names)
    xte, yte, _ = load_split(data / "test.tsv", names)

    vec = TfidfVectorizer(
        lowercase=True,
        token_pattern=TOKEN_PATTERN,
        ngram_range=(1, 2),
        min_df=3,
        max_features=args.max_features,
        sublinear_tf=True,
    )
    Xtr = vec.fit_transform(xtr)
    Xdv = vec.transform(xdv)
    Xte = vec.transform(xte)

    # Choose C on the dev split by macro F1.
    best = None
    for c in [0.5, 1.0, 2.0, 4.0]:
        clf = LogisticRegression(C=c, max_iter=3000, class_weight="balanced")
        clf.fit(Xtr, ytr)
        f1 = f1_score(ydv, clf.predict(Xdv), average="macro")
        if best is None or f1 > best[0]:
            best = (f1, c, clf)
    dev_f1, best_c, clf = best

    temperature = fit_temperature(clf.decision_function(Xdv), ydv)
    raw_te = softmax(clf.decision_function(Xte))
    cal_te = softmax(clf.decision_function(Xte) / temperature)
    pred = cal_te.argmax(axis=1)

    report = classification_report(yte, pred, target_names=TAXONOMY, output_dict=True, zero_division=0)
    cm = confusion_matrix(yte, pred, labels=list(range(len(TAXONOMY))))
    counts = {TAXONOMY[i]: int((ytr == i).sum()) for i in range(len(TAXONOMY))}

    metrics = {
        "dataset": "GoEmotions (Demszky et al., 2020), single-taxonomy-label subset",
        "train_counts": counts,
        "n_train": int(len(ytr)),
        "n_dev": int(len(ydv)),
        "n_test": int(len(yte)),
        "train_filtering": st_tr,
        "chosen_C": best_c,
        "dev_macro_f1": round(float(dev_f1), 4),
        "test_macro_f1": round(float(report["macro avg"]["f1-score"]), 4),
        "test_accuracy": round(float(report["accuracy"]), 4),
        "test_per_class": {
            k: {m: round(float(v[m]), 4) for m in ("precision", "recall", "f1-score", "support")}
            for k, v in report.items()
            if k in TAXONOMY
        },
        "confusion_matrix": {"labels": TAXONOMY, "rows_true_cols_pred": cm.tolist()},
        "temperature": temperature,
        "ece_before_calibration": round(expected_calibration_error(raw_te, yte), 4),
        "ece_after_calibration": round(expected_calibration_error(cal_te, yte), 4),
    }

    vocab = vec.vocabulary_
    features = [None] * len(vocab)
    for term, idx in vocab.items():
        features[idx] = term

    model = {
        "model_version": f"tfidf-lr-goemotions-{datetime.now(timezone.utc).strftime('%Y%m%d')}",
        "classes": TAXONOMY,
        "features": features,
        "idf": [round(float(v), 5) for v in vec.idf_],
        "coef": [[round(float(v), 5) for v in row] for row in clf.coef_],
        "intercept": [round(float(v), 5) for v in clf.intercept_],
        "temperature": temperature,
        "ngram_range": [1, 2],
        "sublinear_tf": True,
        "sklearn_version": sklearn.__version__,
        "metrics": metrics,
    }

    # Parity fixtures so the TypeScript port can be tested against sklearn.
    fixtures_text = [
        "I am so happy and grateful for my friends today",
        "This is really annoying, nothing works",
        "I'm terrified about my exam tomorrow",
        "I feel so sad and alone",
        "What a relief, it finally worked out",
        "The meeting is at 3pm",
    ]
    fx = softmax(clf.decision_function(vec.transform(fixtures_text)) / temperature)
    fixtures = [{"text": t, "probs": [round(float(p), 5) for p in row]} for t, row in zip(fixtures_text, fx)]

    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    (out / "text-baseline.json").write_text(json.dumps(model, separators=(",", ":")))
    (out / "text-baseline.fixtures.json").write_text(json.dumps(fixtures, indent=2))
    (out / "text-baseline.metrics.json").write_text(json.dumps(metrics, indent=2))
    print(json.dumps({k: metrics[k] for k in ("n_train", "chosen_C", "dev_macro_f1", "test_macro_f1", "test_accuracy", "temperature", "ece_before_calibration", "ece_after_calibration")}, indent=2))
    for k, v in metrics["test_per_class"].items():
        print(f"{k:14s} P={v['precision']:.3f} R={v['recall']:.3f} F1={v['f1-score']:.3f} n={int(v['support'])}")


if __name__ == "__main__":
    main()
