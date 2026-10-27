# Written by patchbay from the API documentation. Regenerated on every attempt, do not edit.
# {{PATCHBAY_DOCS_HEADER}}

"""Contract fixtures for the connector under test.

Exports:
  SOURCE_EXAMPLE   dict  — documented event payload
  TARGET_ENDPOINTS list  — endpoints the connector may call, in documented order
  contract_fetch()       — fake async transport answering documented endpoints, raising otherwise
  fake_fetch(handler)    — fake async transport driven by a user handler
  json_response(body, status=200, headers=None)
"""
from __future__ import annotations

import json as _json
import re as _re
from typing import Any, Awaitable, Callable, TypedDict

#: Example payload of the source event, as documented.
SOURCE_EXAMPLE: dict[str, Any] = {{PATCHBAY_SOURCE_EXAMPLE}}


class DocumentedEndpoint(TypedDict):
    method: str
    url: str
    response: Any


#: Target endpoints the connector may call, in the documented order, with documented responses.
TARGET_ENDPOINTS: list[DocumentedEndpoint] = {{PATCHBAY_TARGET_ENDPOINTS}}


class RecordedCall(TypedDict):
    method: str
    url: str
    body: Any
    json: Any
    headers: dict[str, str]


class FakeResponse:
    """Minimal response object: status_code, headers (dict), text, json(), raise_for_status()."""

    def __init__(self, body: Any, status: int = 200, headers: dict[str, str] | None = None) -> None:
        self.status_code = status
        self.status = status  # alias
        self.headers = dict(headers or {})
        if status == 204:
            self._raw = b''
        elif isinstance(body, (bytes, bytearray)):
            self._raw = bytes(body)
        elif isinstance(body, str):
            self._raw = body.encode('utf-8')
        else:
            self._raw = _json.dumps(body).encode('utf-8')
            self.headers.setdefault('Content-Type', 'application/json')

    @property
    def content(self) -> bytes:
        return self._raw

    @property
    def text(self) -> str:
        return self._raw.decode('utf-8', errors='replace')

    def json(self) -> Any:
        return _json.loads(self._raw.decode('utf-8')) if self._raw else None

    def raise_for_status(self) -> None:
        if self.status_code >= 400:
            raise Exception(f"HTTP {self.status_code}")


FetchHandler = Callable[[RecordedCall], FakeResponse | Awaitable[FakeResponse]]


def _parse_json(raw: Any) -> Any:
    if raw is None:
        return None
    # dict / list already parsed — most connectors pass body=<dict>, not body=json.dumps(dict)
    if isinstance(raw, (dict, list)):
        return raw
    if isinstance(raw, (bytes, bytearray)):
        try:
            return _json.loads(raw.decode('utf-8'))
        except Exception:
            return None
    if isinstance(raw, str):
        try:
            return _json.loads(raw)
        except Exception:
            return None
    return None


_URL = _re.compile(r'^https?://([^/?#]+)([^?#]*)', _re.IGNORECASE)
_PLACEHOLDER = _re.compile(r'^\{[^}]+\}$|^:[A-Za-z_]\w*$|^<[^>]+>$')


def _split_url(url: str) -> tuple[str, str] | None:
    m = _URL.match(url)
    if not m:
        return None
    host = m.group(1).lower()
    path = m.group(2) or '/'
    return host, path


def _url_matches(template: str, actual: str) -> bool:
    t, a = _split_url(template), _split_url(actual)
    if not t or not a:
        return False
    t_host, t_path = t
    a_host, a_path = a
    if '.'.join(t_host.split('.')[-2:]) != '.'.join(a_host.split('.')[-2:]):
        return False
    t_segs = t_path.rstrip('/').split('/')
    a_segs = a_path.rstrip('/').split('/')
    if len(t_segs) != len(a_segs):
        return False
    for ts, as_ in zip(t_segs, a_segs):
        if _PLACEHOLDER.match(ts):
            continue
        if ts != as_:
            return False
    return True


def find_endpoint(method: str, url: str) -> DocumentedEndpoint | None:
    for ep in TARGET_ENDPOINTS:
        if ep['method'] == method.upper() and _url_matches(ep['url'], url):
            return ep
    return None


def fake_fetch(handler: FetchHandler) -> tuple[Callable[..., Awaitable[FakeResponse]], list[RecordedCall]]:
    """A correctly-typed fake async fetch for every non-contract test.

    The handler receives the recorded request dict: method, url, body, json, headers.
    It may return a FakeResponse directly or an awaitable.
    """
    calls: list[RecordedCall] = []

    async def fetch(url: str, method: str = 'GET', body: Any = None, headers: dict[str, str] | None = None, **_: Any) -> FakeResponse:
        call: RecordedCall = {
            'method': method.upper(),
            'url': url,
            'body': body,
            'json': _parse_json(body),
            'headers': dict(headers or {}),
        }
        calls.append(call)
        result = handler(call)
        if hasattr(result, '__await__'):
            return await result  # type: ignore[return-value]
        return result  # type: ignore[return-value]

    return fetch, calls


def contract_fetch() -> tuple[Callable[..., Awaitable[FakeResponse]], list[RecordedCall]]:
    """Fake async fetch that answers every documented endpoint with its documented response
    and raises on anything else. Use it in the contract test:

        fetch, calls = contract_fetch()
        await handle(SOURCE_EXAMPLE, { 'fetch': fetch, ... })
        assert len(calls) > 0
    """

    def _handler(req: RecordedCall) -> FakeResponse:
        ep = find_endpoint(req['method'], req['url'])
        if not ep:
            raise AssertionError(f"contract: {req['method']} {req['url']} is not a documented endpoint")
        return json_response(ep['response'])

    return fake_fetch(_handler)


_STATUS_TEXT: dict[int, str] = {
    200: 'OK', 201: 'Created', 202: 'Accepted', 204: 'No Content',
    400: 'Bad Request', 401: 'Unauthorized', 403: 'Forbidden', 404: 'Not Found', 409: 'Conflict',
    422: 'Unprocessable Entity', 429: 'Too Many Requests',
    500: 'Internal Server Error', 502: 'Bad Gateway', 503: 'Service Unavailable',
}


def json_response(body: Any, status: int = 200, headers: dict[str, str] | None = None) -> FakeResponse:
    """A JSON FakeResponse with the standard status text and content-type.

    Extra response headers (Retry-After for 429 tests, Location for redirects, etc.) can be passed via
    the headers= kwarg and are merged on top of the content-type header.
    """
    merged: dict[str, str] = {'Content-Type': 'application/json'}
    if headers:
        merged.update(headers)
    return FakeResponse(body, status, headers=merged)
