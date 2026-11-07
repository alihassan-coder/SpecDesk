from fastapi.testclient import TestClient

from app.main import create_app

client = TestClient(create_app())

# Feature objects exactly as the web app holds them (apps/web/src/mocks/data.ts).
DEMO = [
    {
        "id": "f1",
        "name": "Email & phone sign-in",
        "complexity": "S",
        "moscow": "must",
        "hours": 24,
        "included": True,
    },
    {"id": "f2", "complexity": "L", "hours": 80, "included": True},
    {"id": "f3", "complexity": "M", "hours": 48, "included": True},
    {"id": "f4", "complexity": "L", "hours": 72, "included": True},
    {"id": "f5", "complexity": "M", "hours": 40, "included": True},
    {"id": "f6", "complexity": "M", "hours": 44, "included": True},
    {"id": "f7", "complexity": "S", "hours": 20, "included": True},
    {"id": "f8", "complexity": "M", "hours": 36, "included": False},
    {"id": "f9", "complexity": "L", "hours": 64, "included": False},
    {"id": "f10", "complexity": "XL", "hours": 220, "included": False},
]


def test_estimate_returns_camel_case_demo_numbers() -> None:
    res = client.post(
        "/api/v1/pricing/estimate", json={"features": DEMO, "hourlyRate": 35, "buffer": 0.15}
    )
    assert res.status_code == 200
    assert res.json() == {
        "hours": 405,
        "priceMin": 12_000,
        "priceMax": 16_300,
        "weeks": 9,
        "currency": "USD",
    }


def test_estimate_rejects_unknown_complexity_with_humanized_error() -> None:
    res = client.post("/api/v1/pricing/estimate", json={"features": [{"complexity": "XXL"}]})
    assert res.status_code == 422
    err = res.json()["error"]
    assert err["code"] == "invalid_input"
    assert "features.0.complexity" in err["message"]
