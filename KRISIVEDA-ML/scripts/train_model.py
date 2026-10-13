"""Train a verified-data-only Krisiveda model."""

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.training import train_dataset


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("dataset")
    parser.add_argument("--output-dir", default="models")
    args = parser.parse_args()
    print(json.dumps(train_dataset(args.dataset, args.output_dir), indent=2))


if __name__ == "__main__":
    main()
