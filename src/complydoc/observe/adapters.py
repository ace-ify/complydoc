"""What other libraries pass between steps, as the documents a trace reads.

A trace reads each step's items as text and metadata, the way LangChain documents and
LlamaIndex nodes already come. Docling and Unstructured return objects of their own: a
conversion's result holding a whole document, a chunk with its provenance beside it, an
element whose metadata is an object. Each is turned into documents here, as the step is
recorded; what the program itself receives is left as it was.
"""

from __future__ import annotations

from typing import Any

__all__ = ["documents_of", "listed"]


def documents_of(item: Any) -> list[Any]:
    """`item` as the documents a trace reads: one a page for a Docling document, one for a
    Docling chunk or an Unstructured element, and anything else as it is."""
    module = type(item).__module__
    if module.startswith("docling"):
        document = getattr(item, "document", None)
        if document is not None and hasattr(document, "export_to_markdown"):
            # A conversion's result: the document it holds, from the file it read.
            source = getattr(getattr(item, "input", None), "file", None)
            return _docling_pages(document, str(source) if source is not None else None)
        if hasattr(item, "export_to_markdown") and hasattr(item, "pages"):
            return _docling_pages(item, None)
        meta = getattr(item, "meta", None)
        if isinstance(getattr(item, "text", None), str) and meta is not None:
            return [_docling_chunk(item.text, meta)]
    if module.startswith("unstructured"):
        metadata = getattr(item, "metadata", None)
        to_dict = getattr(metadata, "to_dict", None)
        if isinstance(getattr(item, "text", None), str) and callable(to_dict):
            return [{"page_content": item.text, "metadata": dict(to_dict())}]
    return [item]


def listed(value: Any) -> list[Any] | None:
    """What a step was given or returned, as documents; None where it is not a list of
    them, nor one of the objects above standing for some."""
    if isinstance(value, list | tuple):
        return [document for item in value for document in documents_of(item)]
    if value is None or isinstance(value, str):
        return None
    documents = documents_of(value)
    return None if documents == [value] else documents


def _docling_pages(document: Any, source: str | None) -> list[dict[str, Any]]:
    """A Docling document as LangChain's loaders give a PDF: a document a page, in order."""
    origin = getattr(getattr(document, "origin", None), "filename", None)
    name = source or origin or getattr(document, "name", None)
    pages = sorted(getattr(document, "pages", None) or {})
    if not pages:
        return [{"page_content": document.export_to_markdown(), "metadata": _named(name)}]
    return [
        {
            "page_content": document.export_to_markdown(page_no=number),
            "metadata": {**_named(name), "page_number": number},
        }
        for number in pages
    ]


def _docling_chunk(text: str, meta: Any) -> dict[str, Any]:
    """A Docling chunk, with its provenance where Docling's LangChain loader puts it."""
    export = getattr(meta, "export_json_dict", None)
    exported = export() if callable(export) else {}
    origin = getattr(getattr(meta, "origin", None), "filename", None)
    return {"page_content": text, "metadata": {**_named(origin), "dl_meta": exported}}


def _named(source: str | None) -> dict[str, Any]:
    return {"source": source} if source else {}
