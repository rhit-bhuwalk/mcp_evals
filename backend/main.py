# backend/main.py
import os, json, subprocess, tempfile, shutil, asyncio, time
from pathlib import Path
from uuid import uuid4
from fastapi import FastAPI, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import Optional

app = FastAPI(title="MCP-Eval")

# ──────────────────────────────────────────────────────────────────────────
# ⬩ Request / response models
# ──────────────────────────────────────────────────────────────────────────
class EvalRequest(BaseModel):
    package_name: str
    start_cmd: Optional[str] = None  # e.g. "node build/cli.js --port 3333"
    port: int | None = 3333
    spec_url: Optional[str] = None
    auth_env: Optional[str] = None
  

class EvalResponse(BaseModel):
    job_id: str
    score: dict      

def run_security_scan(src: Path) -> int:
    """Language-agnostic security score 0-100."""
    crit = 0

    # 1) Semgrep for TS/JS/Py   (fast, multi-lang)
    sem_json = src / "semgrep.json"
    subprocess.run(
        f"semgrep scan --config p/ci --verbose {src} --json --output {sem_json}",
        shell=True, check=False
    )
    if sem_json.exists():
        sem = json.loads(sem_json.read_text())
        crit += sum(1 for r in sem.get("results", [])
                    if r["severity"] in {"ERROR", "WARNING"})

    # 2) Bandit only if we actually saw .py files
    if any(p.suffix == ".py" for p in src.rglob("*.py")):
        bandit_json = src / "bandit.json"
        subprocess.run(
            f"bandit -r {src} -f json -o {bandit_json} -q",
            shell=True, check=False
        )
        if bandit_json.exists():
            issues = json.loads(bandit_json.read_text())["results"]
            crit += sum(1 for i in issues if i["issue_severity"] == "HIGH")

    # 3) npm-audit if package.json exists
    if (src / "package.json").exists():
        audit = subprocess.run(
            "npm audit --production --json",
            shell=True, cwd=src, capture_output=True, text=True
        )
        if audit.stdout:
            vulns = json.loads(audit.stdout).get("metadata", {}).get("vulnerabilities", {})
            crit += vulns.get("critical", 0) + vulns.get("high", 0)

    return max(0, 100 - crit * 15)   # −15 pts per critical/high finding

def run_spec_check(spec_url: str | None) -> int:
    """Return dummy spec score."""
    if not spec_url:
        return 0
    # TODO: call openapi-diff
    return 90

def run_runtime_test(port: int) -> int:
    """Hit /list_tools and return 0-100."""
    # TODO: use real MCP client; for now assume healthy.
    return 95

# ──────────────────────────────────────────────────────────────────────────
# ⬩ Background evaluation task
# ──────────────────────────────────────────────────────────────────────────
def evaluate(req: EvalRequest, job_id: str, report_path: Path):
    """
    1. Download + unpack the package (npm or pip)
    2. Launch the MCP server under our control
    3. Run security / spec / runtime checks
    4. Persist JSON report (or error) to report_path
    """
    workdir   = Path(tempfile.mkdtemp(prefix="mcp_"))
    src_root  = workdir          # may change for Python wheels
    server    = None

    try:
        # ── 1 ▸ fetch + unpack source code ────────────────────────────────
        pkg_id   = req.package_name.strip()
        is_py    = "==" in pkg_id or pkg_id.endswith((".whl", ".tar.gz"))

        if is_py:
            # Python: download wheel/sdist
            subprocess.run(f"pip download --no-deps -d . {pkg_id}",
                           shell=True, check=True, cwd=workdir)
            for f in workdir.iterdir():
                if f.suffix == ".whl":
                    subprocess.run(f"python -m wheel unpack {f.name}",
                                   shell=True, check=True, cwd=workdir)
                elif f.suffix in {".gz", ".bz2"}:
                    subprocess.run(f"tar -xzf {f.name}", shell=True,
                                   check=True, cwd=workdir)
            src_root = next(p for p in workdir.iterdir() if p.is_dir())
        else:
            # Node: npm pack tarball
            subprocess.run(f"npm pack {pkg_id}", shell=True, check=True, cwd=workdir)
            subprocess.run("tar -xzf *.tgz --strip-components=1",
                           shell=True, check=True, cwd=workdir)

        # ── 2 ▸ show file tree for debugging ──────────────────────────────
        print("Package contents:")
        for p in src_root.rglob("*"):
            print("  ", p.relative_to(src_root))
        print("─" * 40)

        # ── 3 ▸ launch the server we’ll test ──────────────────────────────
        start_cmd = req.start_cmd
        if not start_cmd:
            if is_py:
                mod = pkg_id.split("==")[0].split("/")[-1].replace("-", "_")
                start_cmd = f"python -m {mod} --port {req.port}"
            else:
                start_cmd = f"node ./dist/index.js -p {req.port}"

        env = os.environ.copy()
        if req.auth_env:
            for kv in req.auth_env.split(","):
                k, v = kv.split("=", 1)
                env[k] = v

        server = subprocess.Popen(start_cmd, shell=True, cwd=src_root, env=env,
                                  stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        time.sleep(3)   # give the server time to bind

        # ── 4 ▸ run checks ────────────────────────────────────────────────
        security   = run_security_scan(src_root)
        spec_score = run_spec_check(req.spec_url)
        runtime    = run_runtime_test(req.port)

        total = round(0.4 * security + 0.3 * spec_score + 0.3 * runtime)
        report_path.write_text(json.dumps(
            {"security": security, "spec": spec_score,
             "runtime": runtime, "total": total},
            indent=2
        ))

    except Exception as e:
        report_path.write_text(json.dumps({"error": str(e)}))
    finally:
        if server:
            server.terminate()
        shutil.rmtree(workdir, ignore_errors=True)
# ──────────────────────────────────────────────────────────────────────────
# ⬩ API endpoint
# ──────────────────────────────────────────────────────────────────────────


@app.post("/eval", response_model=EvalResponse)
async def start_eval(req: EvalRequest):
    job_id  = uuid4().hex
    report  = Path(f"./reports/{job_id}.json")
    report.parent.mkdir(exist_ok=True)

    # ⚡ run the evaluation right here (blocking)
    evaluate(req, job_id, report)

    # read the result and send it back
    score = json.loads(report.read_text())
    return EvalResponse(job_id=job_id, score=score)