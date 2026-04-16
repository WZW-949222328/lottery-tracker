from __future__ import annotations

import json
from datetime import date, datetime
from pathlib import Path
from typing import Dict, List

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator


PROJECTS = ["单关", "二串", "博主", "个人"]
DAILY_TARGETS = {
    "单关": 100.0,
    "二串": 200.0,
    "博主": 200.0,
    "个人": 200.0,
}

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
DATA_FILE = DATA_DIR / "records.json"


class ProjectInput(BaseModel):
    cost: float = Field(ge=0)
    bonus: float = Field(ge=0)


class DayInput(BaseModel):
    record_date: date
    projects: Dict[str, ProjectInput]

    @field_validator("projects")
    @classmethod
    def validate_projects(cls, value: Dict[str, ProjectInput]) -> Dict[str, ProjectInput]:
        names = set(value.keys())
        expected = set(PROJECTS)
        if names != expected:
            missing = sorted(expected - names)
            extra = sorted(names - expected)
            raise ValueError(f"projects keys invalid, missing={missing}, extra={extra}")
        return value


def ensure_storage() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    if not DATA_FILE.exists():
        DATA_FILE.write_text(json.dumps({"records": []}, ensure_ascii=False, indent=2), encoding="utf-8")


def load_records() -> List[dict]:
    ensure_storage()
    content = DATA_FILE.read_text(encoding="utf-8")
    data = json.loads(content)
    return data.get("records", [])


def save_records(records: List[dict]) -> None:
    ensure_storage()
    payload = {"records": records}
    DATA_FILE.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def previous_unrecovered_amount(records: List[dict], project: str) -> float:
    unrecovered = 0.0
    for rec in records:
        proj = rec["projects"][project]
        unrecovered += proj["cost"] + DAILY_TARGETS[project] - proj["bonus"]
    return max(unrecovered, 0.0)


def calculate_project_metrics(
    records: List[dict], project: str, cost: float, bonus: float
) -> Dict[str, float]:
    daily_target_profit = DAILY_TARGETS[project]
    daily_total_profit = bonus - cost
    previous_unrecovered = previous_unrecovered_amount(records, project)

    if bonus == 0:
        tomorrow_required_profit = previous_unrecovered + cost + daily_target_profit + daily_target_profit
    else:
        tomorrow_required_profit = max(previous_unrecovered + daily_target_profit, daily_target_profit)

    return {
        "daily_target_profit": daily_target_profit,
        "daily_total_profit": round(daily_total_profit, 2),
        "tomorrow_required_profit": round(tomorrow_required_profit, 2),
    }


def build_record(day_input: DayInput, old_records: List[dict]) -> dict:
    projects: Dict[str, dict] = {}
    for name in PROJECTS:
        entry = day_input.projects[name]
        metrics = calculate_project_metrics(old_records, name, entry.cost, entry.bonus)
        projects[name] = {
            "cost": round(entry.cost, 2),
            "bonus": round(entry.bonus, 2),
            **metrics,
        }

    day_profit = round(sum(item["daily_total_profit"] for item in projects.values()), 2)
    all_total_profit = round(sum(r["day_profit"] for r in old_records) + day_profit, 2)

    return {
        "record_date": day_input.record_date.isoformat(),
        "created_at": datetime.utcnow().isoformat() + "Z",
        "projects": projects,
        "day_profit": day_profit,
        "all_total_profit": all_total_profit,
    }


app = FastAPI(title="Lottery Tracker API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health() -> dict:
    return {"ok": True}


@app.get("/api/config")
def get_config() -> dict:
    return {"projects": PROJECTS, "daily_targets": DAILY_TARGETS}


@app.get("/api/records")
def get_records() -> dict:
    records = load_records()
    records = sorted(records, key=lambda x: x["record_date"])
    return {"records": records}


@app.post("/api/records")
def create_or_update_record(payload: DayInput) -> dict:
    records = load_records()
    date_key = payload.record_date.isoformat()

    records_without_current = [r for r in records if r["record_date"] != date_key]
    historical_records = sorted(records_without_current, key=lambda x: x["record_date"])

    new_record = build_record(payload, historical_records)
    merged = historical_records + [new_record]
    merged = sorted(merged, key=lambda x: x["record_date"])

    running_total = 0.0
    for rec in merged:
        running_total += rec["day_profit"]
        rec["all_total_profit"] = round(running_total, 2)

    save_records(merged)
    return {"record": new_record}


@app.delete("/api/records/{record_date}")
def delete_record(record_date: str) -> dict:
    records = load_records()
    if not any(r["record_date"] == record_date for r in records):
        raise HTTPException(status_code=404, detail="record not found")

    kept = [r for r in records if r["record_date"] != record_date]
    kept = sorted(kept, key=lambda x: x["record_date"])

    running_total = 0.0
    for rec in kept:
        running_total += rec["day_profit"]
        rec["all_total_profit"] = round(running_total, 2)

    save_records(kept)
    return {"deleted": record_date}
