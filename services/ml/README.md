# ML services

The runtime runs entirely in TypeScript on Vercel. Python is used offline to train and
evaluate the classical baseline and export it as JSON.

```bash
pip install -r services/ml/requirements.txt
bash services/ml/download_goemotions.sh
python services/ml/train_text_baseline.py --data data/goemotions --out apps/web/src/lib/emotion/model
cd apps/web && npm test   # parity tests check the TS runtime against sklearn
```

Outputs (committed): `text-baseline.json` (vocabulary, idf, coefficients, temperature),
`text-baseline.metrics.json` (per-class P/R/F1, confusion matrix, calibration) and
`text-baseline.fixtures.json` (sklearn probabilities used by the parity test).
