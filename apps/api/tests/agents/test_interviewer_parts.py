from app.agents.interviewer.nodes import clean_answers
from app.agents.interviewer.schemas import Option, Question

PENDING = {
    "round": 1,
    "questions": [
        {
            "id": "r1_platform",
            "title": "Web or mobile?",
            "options": [{"id": "web"}, {"id": "mobile"}],
            "recommended": "web",
        },
        {
            "id": "r1_pay",
            "title": "Payments?",
            "options": [{"id": "yes"}, {"id": "no"}],
            "recommended": "yes",
        },
    ],
}


def test_clean_answers_keeps_valid_and_skips_the_rest() -> None:
    raw = {
        "r1_platform": {"optionId": "mobile"},
        "r1_pay": {"optionId": "bitcoin"},
        "unknown": {"optionId": "x"},
    }
    assert clean_answers(PENDING, raw) == {
        "r1_platform": {"optionId": "mobile", "skipped": False},
        "r1_pay": {"skipped": True},  # not one of the offered options
    }


def test_clean_answers_accepts_free_text_and_json_strings() -> None:
    raw = '{"r1_platform": {"text": "A watch app"}}'
    cleaned = clean_answers(PENDING, raw)
    assert cleaned["r1_platform"] == {"text": "A watch app", "skipped": False}
    assert cleaned["r1_pay"] == {"skipped": True}


def test_garbage_answers_count_as_skipped() -> None:
    assert all(a == {"skipped": True} for a in clean_answers(PENDING, 42).values())


def test_recommendation_given_as_a_label_is_repaired() -> None:
    q = Question(
        id="x",
        title="?",
        body=".",
        options=[Option(id="a", label="Alpha"), Option(id="b", label="Beta")],
        recommended="Beta",
    )
    assert q.recommended == "b"
