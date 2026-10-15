"""`cd.observe` on libraries read directly: Docling, Unstructured and an embedding SDK.

Docling and Unstructured are large installs, so they are stood in for here by classes of
the same shape, in modules of the same names. The OpenAI SDK is used for real, against a
server on this machine.
"""

from __future__ import annotations

import json
import sys
import threading
import types
from collections.abc import Iterator
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from typing import Any

import pytest

import complydoc as cd

IBAN = "GB29 NWBK 6016 1331 9268 19"


def _module(monkeypatch: pytest.MonkeyPatch, name: str, **members: Any) -> types.ModuleType:
    module = types.ModuleType(name)
    for key, value in members.items():
        setattr(module, key, value)
        if isinstance(value, type):
            value.__module__ = name
    monkeypatch.setitem(sys.modules, name, module)
    return module


class _Origin:
    def __init__(self, filename: str) -> None:
        self.filename = filename


class _Document:
    """Docling's document: pages, and its text as Markdown, a page at a time or whole."""

    def __init__(self, filename: str, pages: list[str]) -> None:
        self.origin = _Origin(filename)
        self.pages = {number: object() for number in range(1, len(pages) + 1)}
        self._pages = pages

    def export_to_markdown(self, page_no: int | None = None) -> str:
        return "\n\n".join(self._pages) if page_no is None else self._pages[page_no - 1]


class _Input:
    def __init__(self, file: Path) -> None:
        self.file = file


class _Result:
    """What Docling's converter returns for each file."""

    def __init__(self, path: Path, pages: list[str]) -> None:
        self.input = _Input(path)
        self.document = _Document(path.name, pages)


class _Meta:
    def __init__(self, filename: str, page: int) -> None:
        self.origin = _Origin(filename)
        self._page = page

    def export_json_dict(self) -> dict[str, Any]:
        return {"doc_items": [{"prov": [{"page_no": self._page}]}]}


class _Chunk:
    def __init__(self, text: str, meta: _Meta) -> None:
        self.text = text
        self.meta = meta


PAGES = [f"Payments go to account {IBAN} every month.", "Termination needs thirty days notice."]


@pytest.fixture
def docling(monkeypatch: pytest.MonkeyPatch) -> types.SimpleNamespace:
    """Docling's converter and a chunker, in the modules Docling keeps them in."""

    class DocumentConverter:
        def convert(self, source: Path) -> _Result:
            return _Result(Path(source), PAGES)

        def convert_all(self, sources: list[Path]) -> Iterator[_Result]:
            for source in sources:
                yield self.convert(source)

    class BaseChunker:
        def chunk(self, dl_doc: _Document) -> Iterator[_Chunk]:
            raise NotImplementedError

    class HybridChunker(BaseChunker):
        def chunk(self, dl_doc: _Document) -> Iterator[_Chunk]:
            for number in sorted(dl_doc.pages):
                text = dl_doc.export_to_markdown(page_no=number)
                yield _Chunk(text, _Meta(dl_doc.origin.filename, number))

    for name in (
        "docling",
        "docling_core",
        "docling_core.transforms",
        "docling_core.transforms.chunker",
    ):
        _module(monkeypatch, name)
    _module(monkeypatch, "docling.document_converter", DocumentConverter=DocumentConverter)
    _module(monkeypatch, "docling.datamodel.document", _Result=_Result, _Document=_Document)
    _module(
        monkeypatch,
        "docling_core.transforms.chunker.base",
        BaseChunker=BaseChunker,
        HybridChunker=HybridChunker,
    )
    _module(monkeypatch, "docling_core.transforms.chunker.doc_chunk", _Chunk=_Chunk)
    return types.SimpleNamespace(converter=DocumentConverter, chunker=HybridChunker)


def test_docling_read_directly_is_a_load_and_a_split(docling, tmp_path: Path) -> None:  # type: ignore[no-untyped-def]
    with cd.observe("docling", out=None) as observation:
        chunks = []
        for result in docling.converter().convert_all([tmp_path / "contract.pdf"]):
            chunks += list(docling.chunker().chunk(result.document))
    # What the program was given is Docling's own, untouched.
    assert isinstance(chunks[0], _Chunk)

    load, split = observation.report.trace.stages
    assert (load.kind, load.component, split.kind, split.component) == (
        "load",
        "DocumentConverter",
        "split",
        "HybridChunker",
    )
    # One document a page, as LangChain's loaders give a PDF, named by the file read.
    assert load.documents_out == 2 and load.sources == ["contract.pdf"]
    assert split.documents_in == 2 and split.documents_out == 2
    assert [i.label for i in load.identifiers] == ["IBAN"]
    document = observation.report.documents[0]
    assert document.page_count == 2


def test_one_conversion_is_a_load_of_its_pages(docling, tmp_path: Path) -> None:  # type: ignore[no-untyped-def]
    with cd.observe("docling", out=None) as observation:
        docling.converter().convert(tmp_path / "contract.pdf")
    (load,) = observation.report.trace.stages
    # `convert` is the converter calling itself: one step, not one inside another.
    assert load.documents_out == 2 and load.characters_out == sum(len(p) for p in PAGES)


class _Metadata:
    def __init__(self, filename: str) -> None:
        self.filename = filename

    def to_dict(self) -> dict[str, Any]:
        return {"filename": self.filename}


class _Element:
    """An Unstructured element: its text, and its metadata as an object."""

    def __init__(self, text: str, filename: str) -> None:
        self.text = text
        self.metadata = _Metadata(filename)


def test_unstructured_elements_pass_through_a_step_of_your_own(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _module(monkeypatch, "unstructured.documents.elements", _Element=_Element)

    @cd.stage("partition", kind="load")
    def partition(filename: str) -> list[_Element]:
        return [_Element(PAGES[0], filename), _Element(PAGES[1], filename)]

    @cd.stage("chunk_by_title", kind="split")
    def chunk_by_title(elements: list[_Element]) -> list[_Element]:
        return [_Element(" ".join(e.text for e in elements), elements[0].metadata.filename)]

    with cd.observe("unstructured", out=None) as observation:
        chunk_by_title(partition("contract.docx"))
    load, split = observation.report.trace.stages
    assert load.documents_out == 2 and load.sources == ["contract.docx"]
    assert split.documents_in == 2 and split.documents_out == 1
    assert [i.label for i in split.identifiers] == ["IBAN"]


class _Embeddings(BaseHTTPRequestHandler):
    """OpenAI's embeddings endpoint: a vector of eight numbers a text."""

    def do_POST(self) -> None:
        body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
        texts = body["input"] if isinstance(body["input"], list) else [body["input"]]
        vectors = [
            {"object": "embedding", "index": i, "embedding": [0.1] * 8} for i in range(len(texts))
        ]
        usage = {"prompt_tokens": 1, "total_tokens": 1}
        data = json.dumps(
            {"object": "list", "model": body["model"], "usage": usage, "data": vectors}
        )
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data.encode())

    def log_message(self, *args: Any) -> None:
        pass


def test_an_embedding_sdk_called_directly_is_an_embedding_step() -> None:
    openai = pytest.importorskip("openai")
    server = HTTPServer(("127.0.0.1", 0), _Embeddings)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    try:
        client = openai.OpenAI(api_key="test", base_url=f"http://127.0.0.1:{server.server_port}/v1")
        with cd.observe("sdk", out=None) as observation:
            client.embeddings.create(model="text-embedding-3-small", input=[PAGES[0], PAGES[1]])
            client.embeddings.create(model="text-embedding-3-small", input="one text alone")
    finally:
        server.shutdown()

    first, second = observation.report.trace.stages
    assert (first.kind, first.component) == ("embed", "OpenAI embeddings")
    assert first.parameters["model"] == "text-embedding-3-small"
    assert (first.documents_in, first.vectors, first.dimensions) == (2, 2, 8)
    assert first.hosts == ["127.0.0.1"] and [i.label for i in first.identifiers] == ["IBAN"]
    # Priced from the model the call named, as a framework's settings would name it.
    assert first.usd is not None and first.usd_basis == "estimated"
    assert (second.documents_in, second.vectors) == (1, 1)
