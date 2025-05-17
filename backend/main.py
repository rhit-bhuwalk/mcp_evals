# backend/main.py
import os
import json
import subprocess
import tempfile
import shutil
import asyncio
import time

from pathlib import Path
from uuid import uuid4

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List

import anthropic  # pip install anthropic
import dotenv
from config import settings

dotenv.load_dotenv()

app = FastAPI(title="MCP-Eval")

# ──────────────────────────────────────────────────────────────────────────
# ⬩ Request / response models
# ──────────────────────────────────────────────────────────────────────────
class EvalRequest(BaseModel):
    package_name: str

class EvalResponse(BaseModel):
    score: int
    findings: List[str]
    summary: str

# ──────────────────────────────────────────────────────────────────────────
def run_security_scan(src: Path):
    """
    Runs multiple security & malware checks and returns:
      - score: int (0–100)
      - findings: list of human-readable strings
    """
    crit = 0
    findings: List[str] = []

    # 1) Semgrep
    sem_json = src / "semgrep.json"
    subprocess.run(
        f"semgrep scan --config p/ci --json --output {sem_json} {src}",
        shell=True, check=False
    )
    if sem_json.exists():
        sem = json.loads(sem_json.read_text())
        for r in sem.get("results", []):
            sev = r.get("severity")
            if sev in {"ERROR", "WARNING"}:
                crit += 1
                findings.append(f"Semgrep {sev}: {r.get('check_id')} in {r['path']}:{r['start']['line']}")

    # 2) Bandit (Python files)
    if any(p.suffix == ".py" for p in src.rglob("*.py")):
        bandit_json = src / "bandit.json"
        subprocess.run(
            f"bandit -r {src} -f json -o {bandit_json} -q",
            shell=True, check=False
        )
        if bandit_json.exists():
            issues = json.loads(bandit_json.read_text()).get("results", [])
            for i in issues:
                if i.get("issue_severity") == "HIGH":
                    crit += 1
                    findings.append(f"Bandit HIGH: {i.get('test_name')} in {i['filename']}:{i['line_number']}")

    # 3) npm audit (Node)
    if (src / "package.json").exists():
        audit = subprocess.run(
            "npm audit --production --json",
            shell=True, cwd=src, capture_output=True, text=True
        )
        if audit.stdout:
            vulns = json.loads(audit.stdout).get("metadata", {}).get("vulnerabilities", {})
            for sev in ("critical", "high"):
                count = vulns.get(sev, 0)
                if count:
                    crit += count
                    findings.append(f"npm audit {sev.upper()}: {count} vulnerabilities")

    # 4) Safety (Python deps)
    req = src / "requirements.txt"
    if req.exists():
        safety_json = src / "safety.json"
        subprocess.run(
            f"safety check --file={req} --json > {safety_json}",
            shell=True, check=False
        )
        if safety_json.exists():
            issues = json.loads(safety_json.read_text())
            for i in issues:
                crit += 1
                findings.append(f"Safety: {i.get('package_name')} {i.get('vuln_id')}")
                

    # 5) Malicious-pattern sniffing
    patterns = ["eval(", "exec(", "os.system(", "base64.b64decode"]
    for p in src.rglob("*.*"):
        try:
            text = p.read_text(errors="ignore")
        except:
            continue
        for pat in patterns:
            if pat in text:
                crit += 1
                findings.append(f"Suspicious pattern `{pat}` in {p.relative_to(src)}")
                break

    # 6) ClamAV scan
    clam = subprocess.run(
        f"clamscan -r --infected --no-summary {src}",
        shell=True, capture_output=True, text=True
    )
    for line in clam.stdout.splitlines():
        if line.endswith("FOUND"):
            crit += 1
            findings.append(f"ClamAV infected file: {line.split(':')[0]}")

    # 7) CodeQL taint tracking (if available)
    if shutil.which("codeql"):
        db = src / "codeql_db"
        subprocess.run(f"codeql database create {db} --language=python --source-root={src}", shell=True, check=False)
        result = subprocess.run(
            f"codeql query run python-taint-tracking.ql --database={db} --format=csv",
            shell=True, capture_output=True, text=True
        )
        for row in result.stdout.splitlines()[1:]:
            crit += 1
            findings.append(f"CodeQL taint: {row}")

    score = max(0, 100 - crit * 15)
    return score, findings

def summarize_with_anthropic(findings: List[str]) -> str:
    if len(findings) == 0:
        return "Everything looks good!", ""
    else: 
        client = anthropic.Anthropic(api_key=settings.anthropic_key)
        prompt = "\n".join(f"- {f}" for f in findings)
        message = client.messages.create(
            model="claude-3-haiku-20240307",
            max_tokens=200,
            messages=[
                {
                    "role": "user", 
                    "content": f"You are a security analyst. Summarize these findings succinctly:\n\n{prompt}"
                }
            ],
        )
    return message.content[0].text.strip(), prompt

def evaluate(req: EvalRequest):
    workdir = Path(tempfile.mkdtemp(prefix="mcp_"))
    src_root = workdir

    pkg = req.package_name.strip()
    local = Path(pkg).expanduser()

    # -- 0) Local folder
    if local.exists() and local.is_dir():
        dst = workdir / local.name
        shutil.copytree(local, dst)
        src_root = dst

    # -- 1) Git URL
    elif pkg.startswith(("git+", "https://", "http://")) and pkg.endswith(".git"):
        subprocess.run(f"git clone {pkg} {workdir}", shell=True, check=True)
        src_root = workdir

    else:
        # -- 2) Python package
        is_py = "==" in pkg or pkg.endswith((".whl", ".tar.gz"))
        if is_py:
            subprocess.run(f"pip download --no-deps -d . {pkg}", shell=True, check=True, cwd=workdir)
            for f in workdir.iterdir():
                if f.suffix == ".whl":
                    subprocess.run(f"python -m wheel unpack {f.name}", shell=True, check=True, cwd=workdir)
                elif f.suffix in {".gz", ".bz2"}:
                    subprocess.run(f"tar -xzf {f.name}", shell=True, check=True, cwd=workdir)
            src_root = next(p for p in workdir.iterdir() if p.is_dir())
        # -- 3) npm package
        else:
            subprocess.run(f"npm pack {pkg}", shell=True, check=True, cwd=workdir)
            subprocess.run("tar -xzf *.tgz --strip-components=1", shell=True, check=True, cwd=workdir)
            src_root = workdir

    # ── debug
    print("Scanning contents of", src_root)
    for p in src_root.rglob("*"):
        print(" ", p.relative_to(src_root))
    print("─" * 40)

    # ── run scans & summarization
    score, findings = run_security_scan(src_root)
    summary, prompt = summarize_with_anthropic(findings)

    return score, findings, summary

# ──────────────────────────────────────────────────────────────────────────
@app.post("/eval", response_model=EvalResponse)
async def start_eval(req: EvalRequest):
    try:
        score, findings, summary = evaluate(req)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    return EvalResponse(score=score, findings=findings, summary=summary)