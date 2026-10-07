# Astra — Forensic Plagiarism Console: Teacher's Guide

## 1. What is Astra?

Astra is a console that checks student programming submissions for **AI-assisted plagiarism and copying** — including work that has been disguised (renamed variables, reformatted code, restructured logic). You upload student code, and Astra compares it against a vault of reference solutions (real AI-model outputs and teacher-provided solutions) using four independent analysis techniques, then gives you a verdict per student plus a **student-vs-student collusion report** that groups classmates whose work is suspiciously similar.

**In one sentence:** create an assignment → collect student files → run a scan → review who is flagged, who copied from whom, and inspect the evidence side by side.

---

## 2. What Astra catches (and what it doesn't)

**It catches:**
- Direct copy-paste of AI-generated solutions (ChatGPT, Claude, Gemini, DeepSeek, etc.).
- Common disguise tricks: renaming variables/functions, changing whitespace and formatting, reordering statements, converting loops (`for` ↔ `while`), splitting code into helpers.
- Structural copying where data structures were swapped (e.g. reference uses `std::find`, student rewrote it as a manual loop) — the *meaning* still matches.
- Student-to-student copying, including chains (A copied B who copied C end up in one cluster).

**It does NOT prove cheating by itself.** A flag means "this deserves a conversation," not "guilty." Two students can independently write similar code for simple problems, and common boilerplate can raise scores. Always review the evidence and talk to the student before acting. See §8 for how to interpret scores fairly.

---

## 3. How the detection works (the four tiers)

Every comparison runs up to four analyses. Understanding them helps you read reports:

| # | Tier | What it measures | Weight (default) |
|---|------|------------------|------------------|
| 1 | **Token winnowing** | Literal text overlap, ignoring comments and spacing. Fast first filter. | 20% |
| 2 | **AST normalization** | Code *structure* after renaming every custom variable/function to `var_0`, `func_0`, … Defeats renaming tricks. | 20% |
| 3 | **Control-flow graph (CFG)** | The program's logic shape — branches, loops, exits — compared as graphs. Defeats reformatting and loop-swapping. | 20% |
| 4 | **CodeBERT semantics** | A neural network (Microsoft CodeBERT) judges what the code *means*. Scores are **corpus-centered**, i.e. adjusted so that genuinely independent solutions score near zero instead of being falsely flagged. | 40% |

**The sieve (quick filter):** if Tier 1 overlap is below the sieve threshold (default 10%), the submission is marked Safe and the expensive tiers are skipped — unless force-scan is on. This keeps classroom-size scans fast.

**The fused score** is the weighted combination (default 20/20/20/40, adjustable in Settings). Verdict labels the engine produces:

| Verdict | Meaning |
|---------|---------|
| *GPT-4o / Gemini 1.5 Pattern* | Low text overlap but matching structure and meaning — typical renamed/paraphrased AI copy. |
| *Claude 3.5 Pattern* | Low text *and* structure overlap but high meaning match — heavily restructured AI copy. |
| *Flat Logic Duplication* | Control-flow blocks copied nearly as-is. |
| *High Plagiarism Risk* | Overall fused score ≥ 70% — highly identical work. |
| *(no flag)* | No pattern matched — treat as clear, subject to your judgment. |

**Languages:** C++, Python, and Java. Language is auto-detected from the file extension (`.cpp` / `.py` / `.java`); each language uses its own grammar and keyword lists, so results are comparable within a language.

---

## 4. Setup (one time, ~10 minutes)

You need two programs running: the **backend** (analysis engine, port 8000) and the **frontend** (the pages you click, port 3000). Your IT support or the provided runbook handles this:

```bash
# Terminal 1 — backend
cd backend && source .venv/bin/activate && PYTHONPATH=.. uvicorn app.main:app --reload
# Terminal 2 — frontend
cd frontend && npm run dev
```

Then open `http://localhost:3000`. On first start the system seeds itself with a demo assignment and four AI reference solutions, so you can try it immediately.

**OpenRouter API key (needed only for the "Fetch AI answers" feature, §6):**
1. Create a free account at **openrouter.ai** → Keys → create a key (`sk-or-v1-…`).
2. In Astra go to **Settings** → paste the key → **Test & save** until you see "Key configured ✓".
3. Note: flagship models (GPT-4o, Claude Sonnet) consume paid credits on OpenRouter; free-tier models are available if you prefer zero cost. Key validation passing does *not* guarantee a paid model will run without credits — the error message will tell you if credits are the issue.

**Light/dark theme:** toggle in the top-right navbar (sun/moon button). Works on every page, including the code editors, and is remembered.

---

## 5. Your workflow, step by step

### Step 1 — Create the assignment (Assignments page)
- Click **Assignments** → fill in **name**, short **description**, and the full **problem statement** (the exact text given to students — the AI generator uses this, so paste it completely).
- Click **Create**. You can edit or delete assignments later; deleting removes its submissions and reports too.

### Step 2 — Build the reference vault (same page)
The vault is the set of solutions student work is compared against. Aim for **2–4 diverse references**:
- **Option A — Fetch AI answers (recommended):** in the *Fetch AI answers* panel, tick 2–3 models (e.g. GPT-4o, Claude 3.5 Sonnet, Gemini Flash), choose the language, click **Generate**. Valid solutions are added automatically with a preview. Requires the API key (§4).
- **Option B — Manual reference:** paste your own model solution (or a past topper's, with permission), give it a name, set the language, click **Add manual reference**.
- Vault entries show their origin (`seed` / `manual` / `openrouter`) and language. Delete stale ones with the trash icon. Only same-language references are compared against a submission.

### Step 3 — Collect submissions (Bulk page)
- Select the assignment at the top.
- Students submit **source files** (`.cpp`, `.py`, `.java`) or you upload a single **`.zip`** containing the whole class set — non-code files inside are ignored.
- **File naming matters:** the student name is taken from the filename (`alice_hw.cpp` → "Alice Hw"). Ask students to submit as `FullName_assignment.cpp` (or at least their name in the file name) so reports are readable.
- Upload via **Upload files / .zip**; the table lists everything received. Wrong files can be deleted row by row.

### Step 4 — Run the scan
- **One student (Scan page):** drop a file, paste code, or try a demo preset. Instant verdict with per-model scores and the full inspector. Good for spot checks.
- **Whole class (Bulk page):** click **Run bulk scan**. This runs in the background (progress bar; large classes take a few minutes) and produces two things: (a) each student's score against the vault, (b) the **collusion report** — every student compared with every other student.

### Step 5 — Read the results
- **Per-student cards:** name, best (max) vault score, `flagged`/`clear` chip. Sort by score, flagged-first, or name. Click any card to open the full inspector for that student.
- **Collusion matrix:** a grid where dark/red cells mark pairs with high mutual similarity. Symmetric; the diagonal is empty.
- **Cluster cards:** "these N students cluster together" with peak/average internal scores and the top suspect pairs with one-line reasons (e.g. *"Near-identical token fingerprints — likely direct copy with light edits"*).
- **Inspector drill-down:** side-by-side code viewers (student vs reference), the control-flow graphs (click a graph node to jump to that code), and a Debug tab with exact tier scores and the diagnostic message.
- **Exports:** download per-report CSVs and the collusion matrix CSV for your records or to attach to a case file.

---

## 6. Settings you may want to adjust (Settings page)

| Setting | Default | Guidance |
|---------|---------|----------|
| Tier weights | 20 / 20 / 20 / 40 | Must sum to 100%. Raise *semantic* if students paraphrase heavily; raise *token* for introductory classes where copying is usually verbatim. |
| Sieve threshold | 10% | Below this text overlap, deep analysis is skipped. Lower it (5%) if you want maximum sensitivity; raise it if scans feel slow. |
| Collusion threshold | 60% | Pairs scoring above this are flagged and clustered. Lower it to catch looser collaboration; raise it to reduce borderline flags. |
| Default generation models | GPT-4o, Claude 3.5, Gemini Flash | Pre-ticked in the Fetch-AI-answers panel. |
| OpenRouter key | — | See §4. "Test & save" validates before storing. |

---

## 7. Fair-use checklist before acting on a flag

1. **Open the inspector.** Do the highlighted regions look like genuine shared logic, or just common boilerplate (`#include`s, standard loops, input parsing)?
2. **Check the tier breakdown.** High semantic + low token scores mean "same idea, different words" — strong evidence of paraphrased copying, but also possible for short/trivial problems. High token scores are the strongest evidence.
3. **Check the collusion context.** Is the student only similar to the vault, or also to a classmate? A tight cluster of 3–4 students is much stronger evidence than a lone borderline flag.
4. **Consider the problem difficulty.** On a 10-line exercise, independent solutions converge; be more cautious than on a complex assignment.
5. **Talk to the student.** Ask them to explain their code. Keep the CSV/inspector output as supporting material, never as the sole basis for a penalty.

---

## 8. Limitations to be aware of

- **Novel solutions can evade it:** a student who writes a genuinely different algorithm (different logic, different structure) will score low — correctly, since it *is* independent work.
- **Short problems are noisy:** with very little code, coincidental similarity rises. Interpret small-assignment flags conservatively.
- **Three languages only:** C++, Python, Java. Other languages are rejected at upload.
- **Classroom scale:** comfortably handles up to ~200 submissions per scan; beyond that, scans get slow (pairwise comparison grows quadratically).
- **First run downloads the CodeBERT model** (~500 MB) — allow a few extra minutes once; afterwards it is cached.
- **AI generation costs:** free OpenRouter keys have limits; paid models need credits. Generation failures always state the reason — read the per-model error.

---

## 9. Troubleshooting (for you or IT support)

| Symptom | Likely cause / fix |
|---------|--------------------|
| "No OpenRouter API key" when generating | Add the key in Settings (§4). |
| "Rejected (401)" on Test & save | Key is wrong or revoked — regenerate at openrouter.ai. |
| "Insufficient credits (402)" on Generate | Key is valid but the chosen model needs paid credits — add credit or use a free-tier model. |
| "No problem statement" on Generate | Fill the problem statement in Assignments → Edit assignment. |
| Upload rejected | Only `.cpp/.py/.java` (plus `.zip`) are accepted. |
| Scan feels slow | Normal for 100+ submissions (background job with progress bar); first-ever run also downloads the AI model. |
| Theme toggle seems dead | Hard-refresh the page (`Ctrl+Shift+R`); the tab may hold a stale stylesheet. |
| Backend unreachable | Make sure the backend terminal is running on port 8000 and the frontend's `NEXT_PUBLIC_API_URL` points to it (default `http://localhost:8000`). |

---

## 10. For the technically curious (one paragraph)

Astra is a FastAPI backend (SQLite database, tree-sitter parsing for three languages, PyTorch CodeBERT embeddings, background-job bulk scans) with a Next.js frontend. All data stays local except OpenRouter generation calls (problem statement → generated code). Reports, vault entries, and settings persist in `backend/astra.db`; the test suite (`cd backend && python -m pytest tests/ -q`) covers the pipeline, collusion clustering, database, and API flows.

*Prepared for classroom use — treat every flag as the start of a conversation, not the end of one.*
