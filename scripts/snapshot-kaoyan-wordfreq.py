#!/usr/bin/env python3
"""Create the audited wordfreq snapshot used to order the Kaoyan starter list."""

import csv
import json
from pathlib import Path

from wordfreq import zipf_frequency


ROOT = Path(__file__).resolve().parent.parent
AUTHORING_PATH = ROOT / "src/content/vocabulary/generated/kaoyan-core-v1.json"
OUTPUT_PATH = ROOT / "src/content/vocabulary/sources/kaoyan-wordfreq-3.1.1.csv"


def main() -> None:
    document = json.loads(AUTHORING_PATH.read_text(encoding="utf-8"))
    words = sorted({entry["word"].lower() for entry in document["words"]})
    if len(words) != 600:
        raise RuntimeError(f"Expected 600 unique Kaoyan words, got {len(words)}")

    with OUTPUT_PATH.open("w", encoding="utf-8", newline="") as output:
        writer = csv.writer(output, lineterminator="\n")
        writer.writerow(["word", "zipfFrequency"])
        for word in words:
            writer.writerow([word, f"{zipf_frequency(word, 'en'):.2f}"])

    print(
        f"Snapshotted wordfreq 3.1.1 Zipf frequencies for {len(words)} words: "
        f"{OUTPUT_PATH}"
    )


if __name__ == "__main__":
    main()
