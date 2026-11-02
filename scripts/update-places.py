"""Build a compact local place index from GeoNames CC BY 4.0 public data."""
from __future__ import annotations

import datetime
import io
import json
import re
import urllib.request
import zipfile
from pathlib import Path

BASE = "https://download.geonames.org/export/dump/"
HEADERS = {"User-Agent": "Glim/0.2 (+https://github.com/sreyasts/glim)"}


def download(name: str) -> bytes:
    with urllib.request.urlopen(urllib.request.Request(BASE + name, headers=HEADERS), timeout=60) as response:
        return response.read()


def main() -> None:
    with zipfile.ZipFile(io.BytesIO(download("cities15000.zip"))) as archive:
        text = archive.read("cities15000.txt").decode("utf-8")
    cities: list[list[str | int | float]] = []
    for line in text.splitlines():
        parts = line.split("\t")
        if len(parts) < 19:
            continue
        latitude, longitude = float(parts[4]), float(parts[5])
        if not (-90 <= latitude <= 90 and -180 <= longitude <= 180):
            continue
        aliases = list(dict.fromkeys([parts[2], *[alias for alias in parts[3].split(",") if re.fullmatch(r"[A-Za-z][A-Za-z .'-]{2,60}", alias)]]))[:12]
        cities.append([parts[0], parts[1], parts[8], round(latitude, 5), round(longitude, 5), int(parts[14] or 0), ",".join(aliases)])
    countries: list[list[str]] = []
    for line in download("countryInfo.txt").decode("utf-8").splitlines():
        parts = line.split("\t")
        if not line.startswith("#") and len(parts) >= 6:
            countries.append([parts[0], parts[2], parts[4], parts[5]])
    target = Path(__file__).resolve().parent.parent / "shared" / "data" / "places.json"
    target.parent.mkdir(parents=True, exist_ok=True)
    payload = {"source": BASE, "license": "https://creativecommons.org/licenses/by/4.0/", "generatedOn": datetime.date.today().isoformat(), "cities": cities, "countries": countries}
    target.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"Indexed {len(cities)} cities and {len(countries)} country records.")


if __name__ == "__main__":
    main()
