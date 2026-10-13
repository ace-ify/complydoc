# Evals on your own documents

A benchmark says how a reader does on someone else's documents. An eval is a
passage one of yours must come out with: a total, a clause, a row of a table.
complydoc checks each one against the text every reader returned, so the choice
of reader is measured on the documents it will be used on, and a change that
loses a passage is caught.

## Expect a passage

Open the viewer on a run that kept its text, which an audit does by default:

```bash
complydoc audit ./contracts
complydoc ui
```

In a document's **Text** view, select a passage and press **Expect this
passage**. It is written to the folder's evals file and checked against the run
at once. The **Evals** page lists what is expected, takes a passage typed or
pasted in, and has the scoreboard: for each reader the run holds, how many
passages it kept, nearly kept and lost. A lost passage is shown with the nearest
thing that reader did return, which is usually the reason it went missing.

A passage that holds a masked value cannot be expected from the viewer, since the
run kept dots where the document has digits.

## The file

```yaml title=".complydoc-evals.yaml"
schema_version: 1
facts:
  - text: Invoices are payable within fourteen days of the invoice date
    document: terms-and-conditions.pdf
  - text: The Supplier shall notify the Customer within 72 hours
```

It lives at the top of the folder a run reads, and can be edited by hand.
`document` limits a passage to one file; without it, any document may hold it. The
file holds text as your documents write it, so it is as sensitive as they are:
keep it with them.

Case, spacing, invisible characters and words broken at a line end do not matter
when a passage is looked for. One found with small differences counts as nearly
kept.

## Where it is checked

| Run | Scored on |
| --- | --- |
| `complydoc audit` | The audit's reader, and each `--compare-extractor` whose text it kept |
| `complydoc compare-loaders` | Every loader compared |
| The viewer's **Run evals** | The text the open run kept, with the file as it is now |

An audit prints a line for each reader, and the report JSON has the detail under
`evals`:

```text
Evals   complydoc: 4 of 5 expected passages kept, 1 lost
```

Scoring a run again reads no document: it uses the text the run kept. A run made
with `--no-extracted-text` names the file and checks nothing. A viewer served
read-only shows the scores and takes no new passage.
