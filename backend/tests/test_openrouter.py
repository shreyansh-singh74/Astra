"""
OpenRouter client tests — network mocked with httpx.MockTransport.
"""
import httpx
import pytest

from backend.app.core import openrouter_client as orc


def _install_mock(monkeypatch, handler):
    """Route every AsyncClient the client creates through a MockTransport."""
    transport = httpx.MockTransport(handler)
    original = httpx.AsyncClient

    def patched(*args, **kwargs):
        kwargs["transport"] = transport
        return original(*args, **kwargs)

    monkeypatch.setattr(orc.httpx, "AsyncClient", patched)


@pytest.mark.anyio
async def test_validate_key_ok(monkeypatch):
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/api/v1/key"
        assert request.headers["authorization"] == "Bearer sk-test"
        return httpx.Response(200, json={"data": {"label": "astra"}})

    _install_mock(monkeypatch, handler)
    result = await orc.validate_key("sk-test")
    assert result["data"]["label"] == "astra"


@pytest.mark.anyio
async def test_validate_key_rejects_401(monkeypatch):
    _install_mock(monkeypatch, lambda request: httpx.Response(401, json={}))
    with pytest.raises(ValueError, match="401"):
        await orc.validate_key("bad")


@pytest.mark.anyio
async def test_generate_solution_happy_path(monkeypatch):
    cpp_code = "bool solve(std::vector<int>& v) {\n    int total = 0;\n    for (int x : v) total += x;\n    return total >= 0;\n}\n"
    fenced = f"Here you go:\n```cpp\n{cpp_code}```\nGood luck!"

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={
            "choices": [{"message": {"content": fenced}}]
        })

    _install_mock(monkeypatch, handler)
    result = await orc.generate_solution("sum things", "cpp", "openai/gpt-4o", api_key="sk-x")
    assert result["valid"] is True
    assert result["code"] == cpp_code.strip()


@pytest.mark.anyio
async def test_generate_solution_rejects_broken_code(monkeypatch):
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={
            "choices": [{"message": {"content": "```cpp\nint main( { return ;\n```"}}]
        })

    _install_mock(monkeypatch, handler)
    result = await orc.generate_solution("p", "cpp", "m", api_key="k")
    assert result["valid"] is False
    assert "syntax" in result["error"]


@pytest.mark.anyio
async def test_generate_solution_maps_credit_error(monkeypatch):
    _install_mock(monkeypatch, lambda request: httpx.Response(402, json={}))
    with pytest.raises(ValueError, match="credits"):
        await orc.generate_solution("p", "cpp", "m", api_key="k")


@pytest.mark.anyio
async def test_generate_solution_requires_key(monkeypatch):
    monkeypatch.setattr(orc, "get_api_key", lambda: "")
    with pytest.raises(ValueError, match="API key"):
        await orc.generate_solution("p", "cpp", "m")


def test_extract_code_prefers_largest_fence():
    text = "```cpp\nint a;\n``` blabla ```cpp\nint b;\nint c;\n```"
    assert orc._extract_code(text) == "int b;\nint c;"
