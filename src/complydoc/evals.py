"""Evals on your own documents: what a reading of them must contain. A prototype.

    # .complydoc-evals.yaml
    schema_version: 1
    facts:
      - text: Total due 5,100.00
        document: invoices/2026-03.pdf
      - text: The Supplier shall notify the Customer within 72 hours

A benchmark says how a loader reads someone else's documents. An eval is a passage one
of yours must come out with: a total, a clause, a row of a table. Each is checked
against the text every loader returned, so which loader to use is measured on the
documents it will be used on, and a change of loader that loses one is caught.

A run reads `.complydoc-evals.yaml` at the top of the folder it reads. The file holds
passages as they are written in your documents, so it is as sensitive as they are: keep
it with them.

Matching is `complydoc.extraction.facts`: case, spacing, invisible characters and words
broken at a line end do not matter, and a near miss is scored and shown.
"""

from __future__ import annotations

from pathlib import Path

import yaml
from pydantic import BaseModel, ConfigDict, Field, field_validator

from complydoc.extraction.facts import Fact

__all__ = [
    "EVALS_FILENAME",
    "EvalError",
    "EvalsFile",
    "ExpectedFact",
    "add_fact",
    "find_evals_file",
    "load_evals",
    "remove_fact",
]

EVALS_FILENAME = ".complydoc-evals.yaml"

_HEADER = """\
# Passages a reading of these documents must contain. Each is checked against the text
# every loader returns: `complydoc audit` and `complydoc compare-loaders` read this file.
# It holds text as your documents write it, so keep it with them.
# Written by `complydoc ui`; edit it by hand as well.
"""


class EvalError(ValueError):
    """The evals file cannot be read, or a fact is not valid."""


class ExpectedFact(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    text: str
    """The passage, as the document writes it."""
    document: str | None = None
    """The document it must be in, by name or relative path. Any document when left out."""

    @field_validator("text")
    @classmethod
    def _said(cls, value: str) -> str:
        value = " ".join(value.split())
        if len(value) < 3:
            raise ValueError("a fact is at least three characters of a document's text")
        return value

    @field_validator("document")
    @classmethod
    def _named(cls, value: str | None) -> str | None:
        return (value or "").strip() or None

    def as_fact(self) -> Fact:
        return Fact(self.text, self.document)


class EvalsFile(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    schema_version: int = 1
    facts: list[ExpectedFact] = Field(default_factory=list)

    def as_facts(self) -> list[Fact]:
        return [fact.as_fact() for fact in self.facts]


def find_evals_file(target: Path) -> Path | None:
    """The evals file at the top of `target`, when there is one."""
    folder = target if target.is_dir() else target.parent
    candidate = folder / EVALS_FILENAME
    return candidate if candidate.is_file() else None


def load_evals(path: Path) -> EvalsFile:
    """The facts in `path`. An absent file has none."""
    if not path.is_file():
        return EvalsFile()
    try:
        data = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    except yaml.YAMLError as exc:
        raise EvalError(f"{path} is not valid YAML: {exc}") from exc
    if not isinstance(data, dict):
        raise EvalError(f"{path} must hold a mapping with a `facts` list")
    try:
        return EvalsFile.model_validate(data)
    except ValueError as exc:
        raise EvalError(f"{path} is not a valid evals file:\n{exc}") from exc


def _write(path: Path, facts: list[ExpectedFact]) -> None:
    body = yaml.safe_dump(
        {"schema_version": 1, "facts": [fact.model_dump(exclude_none=True) for fact in facts]},
        sort_keys=False,
        allow_unicode=True,
        width=100,
    )
    path.write_text(_HEADER + body, encoding="utf-8")


def _same(left: ExpectedFact, right: ExpectedFact) -> bool:
    return (left.text.casefold(), left.document) == (right.text.casefold(), right.document)


def add_fact(path: Path, fact: ExpectedFact) -> bool:
    """Add `fact` to the file, creating it. Whether it was not already there."""
    facts = list(load_evals(path).facts)
    if any(_same(fact, existing) for existing in facts):
        return False
    _write(path, [*facts, fact])
    return True


def remove_fact(path: Path, text: str, document: str | None = None) -> bool:
    """Take a fact out of the file. Whether it was there."""
    try:
        wanted = ExpectedFact(text=text, document=document)
    except ValueError:
        return False
    facts = list(load_evals(path).facts)
    kept = [fact for fact in facts if not _same(fact, wanted)]
    if len(kept) == len(facts):
        return False
    _write(path, kept)
    return True
