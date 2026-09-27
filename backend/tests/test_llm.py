import json
from types import SimpleNamespace

import pytest
from pydantic import BaseModel

from app.common.llm import LLMError, client
from app.features.recipes.generator import GeneratedRecipes


class Answer(BaseModel):
    items: list[str]
    note: str | None = None


class FakeInteractions:
    def __init__(self, output_text=None, error=None):
        self.output_text, self.error, self.kwargs = output_text, error, None

    def create(self, **kwargs):
        self.kwargs = kwargs
        if self.error:
            raise self.error
        return SimpleNamespace(output_text=self.output_text)


@pytest.fixture()
def fake(monkeypatch):
    def install(**kw):
        interactions = FakeInteractions(**kw)
        monkeypatch.setattr(client, "_client", lambda: SimpleNamespace(interactions=interactions))
        return interactions

    return install


def test_builds_request_and_parses(fake):
    interactions = fake(output_text=json.dumps({"items": ["두부"]}))
    result = client.generate_structured(Answer, "찾아줘", system="시스템", images=[(b"img", "image/png")])

    assert result == Answer(items=["두부"])
    kw = interactions.kwargs
    assert kw["system_instruction"] == "시스템"
    assert kw["input"][0] == {"type": "text", "text": "찾아줘"}
    assert kw["input"][1] == {"type": "image", "data": "aW1n", "mime_type": "image/png"}
    assert kw["response_format"]["mime_type"] == "application/json"
    assert "default" not in json.dumps(kw["response_format"]["schema"])


def test_rate_limit_maps_to_llm_error(fake):
    err = Exception("quota")
    err.status_code = 429
    fake(error=err)
    with pytest.raises(LLMError, match="잠시 후"):
        client.generate_structured(Answer, "x")


def test_invalid_json_maps_to_llm_error(fake):
    fake(output_text="not json")
    with pytest.raises(LLMError):
        client.generate_structured(Answer, "x")


def test_recipe_schema_has_no_default_keys():
    assert "default" not in json.dumps(client._schema(GeneratedRecipes))


def test_client_retries_server_errors_but_not_rate_limit(monkeypatch):
    monkeypatch.setattr(client.settings, "GEMINI_API_KEY", "test-key")
    client._client.cache_clear()
    try:
        retry = client._client().interactions.sdk_configuration.retry_config
    finally:
        client._client.cache_clear()
    assert "429" not in retry.status_codes_override
    assert "503" in retry.status_codes_override
