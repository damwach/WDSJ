#!/usr/bin/env python3
"""Materialize five CC/FAL-licensed ski jumping photo references for offline art review.

Only used to curate reference photographs. Do not use them as game textures.
"""
from __future__ import annotations

import hashlib
from pathlib import Path
import time
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1] / "references" / "athlete"
UA = "WDSJ-reference-library/1.0 (https://github.com/damwach/WDSJ; reference documentation)"
PHOTOS = [
    (
        "01_prevc_flight_side.jpg",
        [
            "https://thumb.wikimedia.org/wikipedia/commons/thumb/6/61/FIS_Ski_Weltcup_Titisee-Neustadt_2016_-_Peter_Prevc1_%28cropped%29.jpg/1280px-FIS_Ski_Weltcup_Titisee-Neustadt_2016_-_Peter_Prevc1_%28cropped%29.jpg",
            "https://upload.wikimedia.org/wikipedia/commons/6/61/FIS_Ski_Weltcup_Titisee-Neustadt_2016_-_Peter_Prevc1_%28cropped%29.jpg",
        ],
    ),
    (
        "02_v_front.jpg",
        [
            "https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a3/2021-08-28_FIS_Sommer_Grand_Prix_2021_Oberhof_and_Steinbach-Hallenberg_%28Women%27s_Ski_Jumping%29_by_Sandro_Halank%E2%80%93032.jpg/1280px-2021-08-28_FIS_Sommer_Grand_Prix_2021_Oberhof_and_Steinbach-Hallenberg_%28Women%27s_Ski_Jumping%29_by_Sandro_Halank%E2%80%93032.jpg",
            "https://upload.wikimedia.org/wikipedia/commons/a/a3/2021-08-28_FIS_Sommer_Grand_Prix_2021_Oberhof_and_Steinbach-Hallenberg_%28Women%27s_Ski_Jumping%29_by_Sandro_Halank%E2%80%93032.jpg",
        ],
    ),
    (
        "03_hvala_threequarter.jpg",
        ["https://upload.wikimedia.org/wikipedia/commons/4/41/Hvala_Jaka_SLO_IMG_9144.JPG"],
    ),
    (
        "04_schmitt_front_threequarter.jpg",
        ["https://upload.wikimedia.org/wikipedia/commons/0/0a/Thorsten_Schmitt_jumps_from_Holmenkollen.jpg"],
    ),
    (
        "05_stoch_telemark.jpg",
        [
            "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ae/2017-10-03_FIS_SGP_2017_Klingenthal_Kamil_Stoch_Telemark.jpg/1280px-2017-10-03_FIS_SGP_2017_Klingenthal_Kamil_Stoch_Telemark.jpg",
            "https://upload.wikimedia.org/wikipedia/commons/a/ae/2017-10-03_FIS_SGP_2017_Klingenthal_Kamil_Stoch_Telemark.jpg",
        ],
    ),
]


def read_jpeg(url: str) -> bytes:
    req = Request(url, headers={"User-Agent": UA, "Accept": "image/jpeg,image/*;q=0.9", "Referer": "https://commons.wikimedia.org/"})
    with urlopen(req, timeout=55) as response:
        data = response.read()
    if not (data.startswith(b"\xff\xd8\xff") and data.endswith(b"\xff\xd9") and len(data) > 30_000):
        raise ValueError(f"Invalid or incomplete JPEG ({len(data)} bytes)")
    return data


def main() -> None:
    ROOT.mkdir(parents=True, exist_ok=True)
    for name, urls in PHOTOS:
        dest = ROOT / name
        if dest.exists():
            data = dest.read_bytes()
            if data.startswith(b"\xff\xd8\xff") and len(data) > 30_000:
                print(f"Already present: {name} ({len(data)} bytes)")
                continue
        errors = []
        for url in urls:
            for attempt in range(3):
                try:
                    data = read_jpeg(url)
                    dest.write_bytes(data)
                    print(f"Downloaded {name}: {len(data)} bytes sha256={hashlib.sha256(data).hexdigest()}")
                    break
                except Exception as exc:
                    errors.append(f"{type(exc).__name__}: {exc}")
                    time.sleep(attempt + 1)
            if dest.exists() and dest.stat().st_size > 30_000:
                break
        if not dest.exists() or dest.stat().st_size < 30_000:
            raise RuntimeError(f"Could not download {name}: {errors}")
    print("All five offline Wikimedia photo references are ready.")


if __name__ == "__main__":
    main()
