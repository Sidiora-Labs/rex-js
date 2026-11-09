#!/usr/bin/env python3
"""Validate the rex-v04 specification pack without executing product code.

Checks authoring structure, references, requirement coverage, the interface ledger, the fleet
roster and local links. It runs no test, build or verify_cmd. --render rewrites only the derived
views (implementation-plan.md, traceability.md) and the validation report. Standard library only.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from pathlib import Path

PACK = Path(__file__).resolve().parents[1]
FEATURE = "rex-v04"
DERIVED = ("implementation-plan.md", "traceability.md")
REPORT = "authoring-validation.json"
CHAPTERS = ("README.md", "decisions.md", "design.body.md", "interface-contracts.md", "fleet-roles.md", "verification.md")
OUTCOMES = {"UNRUN", "PASS", "FAIL", "BLOCKED"}
TASK_STATUS = {"pending", "in_progress", "implemented", "done"}
TIERS = {"component", "integration", "e2e", "release", "external"}
TASK_KEYS = ("title", "status", "wave", "requires", "touches", "verify_cmd", "reqs", "owner", "cases", "provides", "consumes")


class InvalidKVX(ValueError):
    """A KVX document breaks the authoring grammar; the message names the line."""


def parse_kvx(text: str) -> dict:
    sections: dict = {}
    current = None
    for number, original in enumerate(text.splitlines(), 1):
        line = original.strip()
        if not line or line.startswith("#"):
            continue
        head = re.fullmatch(r"\[([A-Za-z0-9_.-]+)\]", line)
        if head:
            name = head.group(1)
            if name in sections:
                raise InvalidKVX(f"line {number}: duplicate section [{name}]")
            current = sections[name] = {}
            continue
        pair = re.fullmatch(r"([A-Za-z_][A-Za-z0-9_-]*)\s*=\s*(.+)", line)
        if not pair or current is None:
            raise InvalidKVX(f"line {number}: unsupported or out-of-section syntax")
        key, value = pair.groups()
        if key in current:
            raise InvalidKVX(f"line {number}: duplicate key {key}")
        try:
            current[key] = json.loads(value)
        except ValueError as error:
            raise InvalidKVX(f"line {number}: value must be one JSON literal: {error}") from error
    return sections


def order(ident: str) -> tuple[int, ...]:
    return tuple(int(part) for part in ident.split("."))


def group(sections: dict, prefix: str) -> dict:
    return {name[len(prefix) + 1 :]: body for name, body in sections.items() if name.startswith(prefix + ".")}


def closure(tasks: dict, ident: str, seen: set | None = None) -> set:
    seen = set() if seen is None else seen
    for parent in tasks[ident].get("requires", []):
        if parent in tasks and parent not in seen:
            seen.add(parent)
            closure(tasks, parent, seen)
    return seen


def validate(spec: dict, ifaces: dict, fleet: dict) -> tuple[list[str], dict]:
    errors: list[str] = []
    meta = spec.get("meta", {})
    if meta.get("feature") != FEATURE:
        errors.append(f"[meta] feature must be {FEATURE}")
    for key in ("name", "version", "status", "stage", "review_date", "source_baseline", "intro"):
        if not meta.get(key):
            errors.append(f"[meta] missing {key}")
    reqs, tasks, cases = group(spec, "req"), group(spec, "task"), group(spec, "case")
    clauses: dict[str, str] = {}
    for rid, body in reqs.items():
        if not body.get("title") or not body.get("story"):
            errors.append(f"req {rid}: title and story are required")
        for key, text in body.items():
            if key.startswith("ac_"):
                clause = f"{rid}.{key[3:]}"
                clauses[clause] = text
                if "SHALL" not in text:
                    errors.append(f"clause {clause}: no SHALL")
    task_clause, case_clause = set(), set()
    for tid, body in tasks.items():
        for key in TASK_KEYS:
            if key not in body:
                errors.append(f"task {tid}: missing {key}")
        if body.get("status") not in TASK_STATUS:
            errors.append(f"task {tid}: bad status {body.get('status')}")
        if body.get("wave") != order(tid)[0]:
            errors.append(f"task {tid}: wave does not match its id")
        steps = [key for key in body if key.startswith("do_")]
        if len(steps) < 4:
            errors.append(f"task {tid}: fewer than four do steps")
        if not body.get("touches"):
            errors.append(f"task {tid}: empty touches")
        for parent in body.get("requires", []):
            if parent not in tasks:
                errors.append(f"task {tid}: requires unknown task {parent}")
            elif tasks[parent]["wave"] > body.get("wave", 0):
                errors.append(f"task {tid}: requires {parent} from a later wave")
        for clause in body.get("reqs", []):
            if clause not in clauses:
                errors.append(f"task {tid}: unknown clause {clause}")
            task_clause.add(clause)
        if not body.get("reqs"):
            errors.append(f"task {tid}: no requirement clause")
        for cid in body.get("cases", []):
            if cid not in cases:
                errors.append(f"task {tid}: unknown case {cid}")
            elif tid not in cases[cid].get("tasks", []):
                errors.append(f"task {tid}: case {cid} does not list it back")
        if not body.get("cases"):
            errors.append(f"task {tid}: no case")
    for tid in tasks:
        if tid in closure(tasks, tid):
            errors.append(f"task {tid}: dependency cycle")
    for cid, body in cases.items():
        if body.get("status") not in OUTCOMES:
            errors.append(f"case {cid}: bad status {body.get('status')}")
        if body.get("tier") not in TIERS:
            errors.append(f"case {cid}: bad tier {body.get('tier')}")
        if not body.get("oracle"):
            errors.append(f"case {cid}: no oracle")
        for tid in body.get("tasks", []):
            if tid not in tasks:
                errors.append(f"case {cid}: unknown task {tid}")
            elif cid not in tasks[tid].get("cases", []):
                errors.append(f"case {cid}: task {tid} does not list it back")
        for clause in body.get("reqs", []):
            if clause not in clauses:
                errors.append(f"case {cid}: unknown clause {clause}")
            case_clause.add(clause)
    for clause in clauses:
        if clause not in task_clause:
            errors.append(f"clause {clause}: no task implements it")
        if clause not in case_clause:
            errors.append(f"clause {clause}: no case verifies it")
    # interface ledger
    faces = group(ifaces, "interface")
    provided: dict[str, str] = {}
    for tid, body in tasks.items():
        for iid in body.get("provides", []):
            if iid in provided:
                errors.append(f"interface {iid}: two providers, {provided[iid]} and {tid}")
            provided[iid] = tid
    for iid, body in faces.items():
        for key in ("kind", "path", "signature", "status", "provider", "consumers", "contract"):
            if key not in body:
                errors.append(f"interface {iid}: missing {key}")
        if provided.get(iid) != body.get("provider"):
            errors.append(f"interface {iid}: provider {body.get('provider')} does not declare provides")
        consumers = sorted(tid for tid, task in tasks.items() if iid in task.get("consumes", []))
        if sorted(body.get("consumers", [])) != consumers:
            errors.append(f"interface {iid}: consumers differ from task declarations")
        provider = body.get("provider")
        for tid in consumers:
            if provider not in tasks:
                continue
            if tasks[tid]["wave"] < tasks[provider]["wave"]:
                errors.append(f"interface {iid}: consumer {tid} is in an earlier wave than provider {provider}")
            elif tasks[tid]["wave"] == tasks[provider]["wave"] and provider not in closure(tasks, tid):
                errors.append(f"interface {iid}: same-wave consumer {tid} does not require provider {provider}")
    for iid in provided:
        if iid not in faces:
            errors.append(f"interface {iid}: provided by {provided[iid]} but not in interfaces.kvx")
    for tid, body in tasks.items():
        for iid in body.get("consumes", []):
            if iid not in faces:
                errors.append(f"task {tid}: consumes unknown interface {iid}")
    # fleet roster
    waves = group(fleet, "wave")
    rostered: set[str] = set()
    for wid, body in waves.items():
        expected = sorted((tid for tid, task in tasks.items() if str(task["wave"]) == wid), key=order)
        if body.get("tasks") != expected:
            errors.append(f"fleet wave {wid}: task list differs from spec.kvx")
        if body.get("workers") != [f"w-{FEATURE}-{tid}" for tid in expected]:
            errors.append(f"fleet wave {wid}: worker list differs from its tasks")
        if body.get("manager") != f"fm-{FEATURE}-{wid}" or body.get("branch") != f"wave/{FEATURE}/{wid}":
            errors.append(f"fleet wave {wid}: manager or branch does not follow the role template")
        if body.get("gate_case") not in cases:
            errors.append(f"fleet wave {wid}: unknown gate case")
        for before in body.get("after", []):
            if before not in waves:
                errors.append(f"fleet wave {wid}: after names unknown wave {before}")
        providers = {str(tasks[provided[iid]]["wave"]) for tid in expected for iid in tasks[tid].get("consumes", []) if iid in provided}
        reach, stack = set(), list(body.get("after", []))
        while stack:
            item = stack.pop()
            if item not in reach and item in waves:
                reach.add(item)
                stack.extend(waves[item].get("after", []))
        for need in providers - {wid} - reach:
            errors.append(f"fleet wave {wid}: consumes an interface from wave {need} but does not start after it")
        rostered.update(expected)
    if rostered != set(tasks):
        errors.append("fleet roster does not cover every task exactly")
    return errors, {"reqs": reqs, "tasks": tasks, "cases": cases, "clauses": clauses, "faces": faces, "waves": waves}


def digest(spec_text: str, ifaces_text: str, fleet_text: str) -> str:
    return hashlib.sha256("\0".join((spec_text, ifaces_text, fleet_text)).encode()).hexdigest()[:16]


def render_plan(model: dict, mark: str) -> str:
    tasks, waves = model["tasks"], model["waves"]
    out = [f"<!-- GENERATED by tools/validate_spec.py --render from spec.kvx ({mark}). Do not edit. -->", "",
           "# Implementation plan", "",
           "Derived view of the task list. Status here mirrors spec.kvx at render time and is not evidence.", ""]
    for wid in sorted(waves, key=int):
        wave = waves[wid]
        after = ", ".join(f"wave {item}" for item in wave.get("after", [])) or "none"
        out += [f"## Wave {wid}: {wave['title']}", "",
                f"Manager `{wave['manager']}` on `{wave['branch']}`. Starts after: {after}. Gate case `{wave['gate_case']}`.", "",
                "| Task | Title | Owner | Requires | Provides | Consumes | Minutes | Status |", "|---|---|---|---|---|---|---:|---|"]
        for tid in wave["tasks"]:
            task = tasks[tid]
            cell = lambda items: ", ".join(items) or "none"
            out.append(f"| {tid} | {task['title']} | {task['owner']} | {cell(task['requires'])} | {cell(task['provides'])} | "
                       f"{cell(task['consumes'])} | {task.get('time_limit_minutes', 45)} | {task['status']} |")
        out.append("")
        for tid in wave["tasks"]:
            task = tasks[tid]
            out += [f"### {tid} {task['title']}", "", f"- Worker: `w-{FEATURE}-{tid}` on `task/{FEATURE}/{tid}`",
                    f"- Clauses: {', '.join(task['reqs'])}", f"- Cases: {', '.join(task['cases'])}",
                    f"- Verify: `{task['verify_cmd']}`", "- Steps:"]
            out += [f"  {index}. {task[key]}" for index, key in enumerate(sorted((k for k in task if k.startswith('do_')), key=lambda k: int(k[3:])), 1)]
            out.append("")
    return "\n".join(out).rstrip() + "\n"


def render_trace(model: dict, mark: str) -> str:
    reqs, tasks, cases, clauses = model["reqs"], model["tasks"], model["cases"], model["clauses"]
    out = [f"<!-- GENERATED by tools/validate_spec.py --render from spec.kvx ({mark}). Do not edit. -->", "",
           "# Traceability", "", "Every acceptance clause with the tasks that implement it and the cases that verify it.",
           "A case status of UNRUN means no evidence exists yet.", ""]
    for rid in sorted(reqs, key=int):
        out += [f"## Requirement {rid}: {reqs[rid]['title']}", "", "| Clause | Tasks | Cases | Case status |", "|---|---|---|---|"]
        for clause in sorted((c for c in clauses if c.split(".")[0] == rid), key=order):
            by_task = sorted((tid for tid, task in tasks.items() if clause in task["reqs"]), key=order)
            by_case = sorted(cid for cid, case in cases.items() if clause in case["reqs"])
            states = ", ".join(sorted({cases[cid]["status"] for cid in by_case}))
            out.append(f"| {clause} | {', '.join(by_task)} | {', '.join(by_case)} | {states} |")
        out.append("")
    out += ["## Interfaces", "", "| Interface | Provider | Consumers | Status |", "|---|---|---|---|"]
    for iid, face in model["faces"].items():
        out.append(f"| {iid} | {face['provider']} | {', '.join(face['consumers']) or 'none'} | {face['status']} |")
    return "\n".join(out).rstrip() + "\n"


def link_errors() -> list[str]:
    errors = []
    for name in CHAPTERS:
        path = PACK / name
        if not path.is_file():
            errors.append(f"missing chapter {name}")
            continue
        for target in re.findall(r"\]\(([^)#\s]+)(?:#[^)]*)?\)", path.read_text()):
            if "://" in target or target.startswith("mailto:") or target in DERIVED or target == REPORT:
                continue
            if not (path.parent / target).exists():
                errors.append(f"{name}: broken link {target}")
    return errors


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--render", action="store_true", help="rewrite the derived views and the report")
    args = parser.parse_args()
    texts = [(PACK / name).read_text() for name in ("spec.kvx", "interfaces.kvx", "fleet.kvx")]
    try:
        spec, ifaces, fleet = (parse_kvx(text) for text in texts)
    except InvalidKVX as error:
        print(f"FAIL {error}")
        return 2
    errors, model = validate(spec, ifaces, fleet)
    errors += link_errors()
    mark = digest(*texts)
    views = {"implementation-plan.md": render_plan(model, mark), "traceability.md": render_trace(model, mark)} if not errors else {}
    counts = {"requirements": len(model["reqs"]), "clauses": len(model["clauses"]), "tasks": len(model["tasks"]),
              "cases": len(model["cases"]), "interfaces": len(model["faces"]), "waves": len(model["waves"]),
              "cases_unrun": sum(1 for case in model["cases"].values() if case["status"] == "UNRUN")}
    if args.render and not errors:
        for name, body in views.items():
            (PACK / name).write_text(body)
        report = {"feature": FEATURE, "source_digest": mark, "result": "PASS", "counts": counts,
                  "scope": "authoring structure only; no product code, test or verify_cmd was executed"}
        (PACK / REPORT).write_text(json.dumps(report, indent=2) + "\n")
    elif not errors:
        for name, body in views.items():
            path = PACK / name
            if not path.is_file() or path.read_text() != body:
                errors.append(f"{name} is stale; run tools/validate_spec.py --render")
    for error in errors:
        print(f"FAIL {error}")
    if errors:
        return 1
    print(f"PASS {FEATURE} {mark} " + " ".join(f"{key}={value}" for key, value in counts.items()))
    return 0


if __name__ == "__main__":
    sys.exit(main())
