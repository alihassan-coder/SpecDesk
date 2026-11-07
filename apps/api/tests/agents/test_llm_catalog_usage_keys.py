from decimal import Decimal
from pathlib import Path

import pytest
from pydantic import SecretStr, ValidationError

from app.agents.llm.catalog import DEFAULT_CATALOG, ModelCatalog
from app.agents.llm.keys import KeyCipher, provider_environ, resolve_api_key
from app.agents.llm.usage import ModelPrice, Usage
from app.core.errors import AppError

# ---------- catalog ----------


def test_default_catalog_uses_opus_then_falls_back_to_sonnet() -> None:
    chain = DEFAULT_CATALOG.chain_for("interviewer")
    assert [m.id for m in chain] == ["anthropic:claude-opus-5-5", "anthropic:claude-sonnet-5-5"]


def test_agent_override_disabled_models_and_providers() -> None:
    catalog = DEFAULT_CATALOG.model_copy(
        update={
            "agent_models": {"critic": "anthropic:claude-haiku-5-5"},
            "fallback_models": ["anthropic:claude-opus-5-5"],
        }
    )
    assert [m.id for m in catalog.chain_for("critic")] == [
        "anthropic:claude-haiku-5-5",
        "anthropic:claude-opus-5-5",
    ]

    off = catalog.model_copy(update={"disabled_providers": ["anthropic"]})
    with pytest.raises(AppError) as err:
        off.chain_for("critic")
    assert err.value.error.code == "model_not_configured"


def test_catalog_rejects_references_to_unknown_models() -> None:
    data = DEFAULT_CATALOG.model_dump()
    data["default_model"] = "openai:gpt-nope"
    with pytest.raises(ValidationError, match="unknown models"):
        ModelCatalog.model_validate(data)


# ---------- usage ----------


def test_usage_splits_cached_tokens_and_prices_them() -> None:
    usage = Usage.from_langchain(
        {
            "input_tokens": 1_000,
            "output_tokens": 500,
            "input_token_details": {"cache_read": 800, "cache_creation": 0},
        }
    )
    assert usage == Usage(input_tokens=200, output_tokens=500, cache_read_tokens=800)

    price = ModelPrice(input=Decimal(4), output=Decimal(20), cache_read=Decimal("0.20"))
    # 200*4 + 500*20 + 800*0.20 = 800 + 10000 + 160 = 10960 per million
    assert usage.cost_usd(price) == Decimal("0.010960")


def test_usage_handles_missing_metadata() -> None:
    assert Usage.from_langchain(None) == Usage()


# ---------- keys ----------


def test_cipher_round_trip() -> None:
    from cryptography.fernet import Fernet

    cipher = KeyCipher(SecretStr(Fernet.generate_key().decode()))
    token = cipher.encrypt("sk-ant-secret")
    assert "sk-ant" not in token
    assert cipher.decrypt(token).get_secret_value() == "sk-ant-secret"


def test_env_key_is_used_when_nothing_is_saved() -> None:
    key = resolve_api_key(
        "anthropic", session=None, cipher=None, environ={"ANTHROPIC_API_KEY": " sk-env "}
    )
    assert key is not None and key.get_secret_value() == "sk-env"
    assert resolve_api_key("anthropic", session=None, cipher=None, environ={}) is None
    assert resolve_api_key("made-up", session=None, cipher=None, environ={"X": "1"}) is None


def test_keys_written_in_the_env_file_are_found(tmp_path: Path) -> None:
    env_file = tmp_path / ".env"
    env_file.write_text("ANTHROPIC_API_KEY=sk-from-file\nEMPTY=\n")
    environ = provider_environ(env_file)
    key = resolve_api_key("anthropic", session=None, cipher=None, environ=environ)
    assert key is not None and key.get_secret_value() == "sk-from-file"
    assert "EMPTY" not in environ
