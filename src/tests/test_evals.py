"""Evals on your own documents: the folder's expected passages, checked against every reading."""

from __future__ import annotations

import http.client
import json
import shutil
from pathlib import Path

import pytest
from pypdf import PdfReader
from typer.testing import CliRunner

import complydoc as cd
from complydoc import offline
from complydoc.cli import app
from complydoc.evals import (
    EVALS_FILENAME,
    EvalError,
    ExpectedFact,
    add_fact,
    find_evals_file,
    load_evals,
    remove_fact,
)
from complydoc.report.json_reader import load_report
from complydoc.viewer import launch_ui

runner = CliRunner()
SAMPLE = Path(__file__).parents[1] / "complydoc" / "sample" / "terms-and-conditions.pdf"

KEPT = "Invoices are payable within fourteen days of the invoice date"
LOST = "Title in any goods supplied passes on receipt of payment in full"
NOWHERE = "The supplier indemnifies the customer against all third party claims"


@pytest.fixture
def folder(tmp_path: Path) -> Path:
    documents = tmp_path / "contracts"
    documents.mkdir()
    shutil.copy(SAMPLE, documents / "terms.pdf")
    return documents


def test_a_fact_is_added_once_tidied_and_taken_out(folder: Path):
    file = folder / EVALS_FILENAME
    assert find_evals_file(folder) is None and load_evals(file).facts == []

    assert add_fact(file, ExpectedFact(text=f"  {KEPT}\n", document="terms.pdf"))
    assert not add_fact(file, ExpectedFact(text=KEPT.upper(), document="terms.pdf"))
    assert add_fact(file, ExpectedFact(text=LOST))
    assert find_evals_file(folder) == file
    assert [(f.text, f.document) for f in load_evals(file).facts] == [
        (KEPT, "terms.pdf"),
        (LOST, None),
    ]
    assert file.read_text().startswith("# Passages a reading of these documents must contain.")

    assert not remove_fact(file, KEPT)  # not without its document
    assert remove_fact(file, KEPT, "terms.pdf")
    assert [f.text for f in load_evals(file).facts] == [LOST]


def test_a_fact_too_short_to_mean_anything_and_a_broken_file_are_refused(folder: Path):
    with pytest.raises(ValueError):
        ExpectedFact(text=" a ")
    (folder / EVALS_FILENAME).write_text("facts: [oops")
    with pytest.raises(EvalError, match="not valid YAML"):
        load_evals(folder / EVALS_FILENAME)
    (folder / EVALS_FILENAME).write_text("facts:\n  - passage: wrong key\n")
    with pytest.raises(EvalError, match="not a valid evals file"):
        load_evals(folder / EVALS_FILENAME)


def test_an_audit_checks_the_folders_evals_against_its_own_reading(folder: Path, tmp_path: Path):
    """The sample is a two-column page, and the audit's reader goes straight across it:
    the heading survives, and a clause comes out spliced with the one beside it."""
    add_fact(
        folder / EVALS_FILENAME, ExpectedFact(text="Terms and conditions", document="terms.pdf")
    )
    add_fact(folder / EVALS_FILENAME, ExpectedFact(text=KEPT, document="terms.pdf"))
    out = tmp_path / "out"
    result = runner.invoke(app, ["audit", str(folder), "--out", str(out), "--no-ocr", "-q"])
    assert result.exit_code == 0, result.output

    written = json.loads((out / "complydoc.json").read_text())["evals"]
    assert written["file"].endswith(EVALS_FILENAME)
    (reader,) = written["readers"]
    heading, clause = written["checks"]
    assert heading["found"][reader] == "exact" and heading["pages"][reader] == 1
    assert clause["fact"] == KEPT and clause["found"][reader] is None
    # What the miss looks like: the end of the clause, behind words from the other column.
    assert clause["nearest"][reader].endswith("fourteen days of the invoice date")
    assert not clause["nearest"][reader].startswith("Invoices")

    evals = load_report(out / "complydoc.json").evals
    assert evals is not None and [check.fact for check in evals.checks] == [
        "Terms and conditions",
        KEPT,
    ]


def test_a_folder_with_no_evals_file_has_none(folder: Path, tmp_path: Path):
    out = tmp_path / "out"
    assert (
        runner.invoke(app, ["audit", str(folder), "--out", str(out), "--no-ocr", "-q"]).exit_code
        == 0
    )
    assert json.loads((out / "complydoc.json").read_text())["evals"] is None


class Page:
    def __init__(self, text: str, source: str, number: int) -> None:
        self.page_content = text
        self.metadata = {"source": source, "page": number}


class Whole:
    """A loader that returns the page as the file writes it."""

    def __init__(self, path: str) -> None:
        self.path = path

    def load(self) -> list[Page]:
        pages = PdfReader(self.path).pages
        return [Page(page.extract_text(), self.path, number) for number, page in enumerate(pages)]


class DropsAClause(Whole):
    """A loader that loses a line, as a reading of a two-column page can."""

    def load(self) -> list[Page]:
        return [
            Page(
                page.page_content.replace("passes on receipt of payment in", ""), self.path, number
            )
            for number, page in enumerate(super().load())
        ]


def test_a_loader_comparison_scores_every_loader_on_the_folders_evals(folder: Path):
    for text in (KEPT, LOST, NOWHERE):
        add_fact(folder / EVALS_FILENAME, ExpectedFact(text=text))
    report = cd.compare_loaders({"whole": Whole, "drops": DropsAClause}, paths=folder)

    assert report.evals is not None
    assert report.evals.readers == ["whole", "drops"]
    kept, lost, nowhere = report.evals.checks
    assert (kept.found["whole"], kept.found["drops"]) == ("exact", "exact")
    assert lost.found["whole"] == "exact" and lost.found["drops"] != "exact"
    assert lost.nearest["drops"]  # what the miss looks like in that loader's text
    assert nowhere.found == {"whole": None, "drops": None}
    # The same checks the comparison ranks its loaders by.
    assert report.loader_comparison is not None
    assert report.loader_comparison.facts == report.evals.checks
    assert report.loader_comparison.ranked[0] == "whole"


def test_facts_given_outright_are_used_in_place_of_the_file(folder: Path):
    add_fact(folder / EVALS_FILENAME, ExpectedFact(text=NOWHERE))
    report = cd.compare_loaders({"whole": Whole, "drops": DropsAClause}, paths=folder, facts=[KEPT])
    assert report.evals is None
    assert report.loader_comparison is not None
    assert [check.fact for check in report.loader_comparison.facts] == [KEPT]


def send(port: int, method: str, path: str, body: object | None = None) -> tuple[int, bytes]:
    connection = http.client.HTTPConnection("127.0.0.1", port, timeout=5)
    headers = {"Content-Type": "application/json", "Origin": f"http://127.0.0.1:{port}"}
    connection.request(
        method, path, body=json.dumps(body) if body is not None else None, headers=headers
    )
    response = connection.getresponse()
    data = response.read()
    connection.close()
    return response.status, data


def test_the_viewer_lists_adds_and_removes_the_folders_facts(folder: Path, tmp_path: Path):
    out = tmp_path / "out"
    assert (
        runner.invoke(app, ["audit", str(folder), "--out", str(out), "--no-ocr", "-q"]).exit_code
        == 0
    )
    offline.disarm()
    dist = tmp_path / "dist"
    dist.mkdir()
    (dist / "index.html").write_text("<html><head></head><body></body></html>")
    viewer = launch_ui(out, port=0, open_browser=False, dist=dist)
    try:
        (report,) = viewer.reports()
        url = f"/api/reports/{report.id}/evals"
        status, body = send(viewer.port, "GET", url)
        assert status == 200 and json.loads(body)["facts"] == []

        status, body = send(viewer.port, "POST", url, {"text": KEPT, "document": "terms.pdf"})
        assert status == 200, body
        assert json.loads(body)["facts"] == [{"text": KEPT, "document": "terms.pdf"}]
        assert load_evals(folder / EVALS_FILENAME).facts[0].text == KEPT

        assert send(viewer.port, "POST", url, {"text": "x"})[0] == 400
        status, body = send(viewer.port, "DELETE", url, {"text": KEPT, "document": "terms.pdf"})
        assert status == 200 and json.loads(body)["facts"] == []
    finally:
        viewer.stop()
