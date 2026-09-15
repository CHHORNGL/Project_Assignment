#!/usr/bin/env python3
"""
Dependency Security and Integrity Audit Utility.
Audits Python, Frontend (Node), and Mobile (Dart/Flutter) dependency trees
for consistency, broken requirements, missing lockfile records, and security advisories.
"""

import argparse
import os
import re
import subprocess
import sys
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parent.parent


def parse_requirement_name(line: str) -> str:
    """Extract normalized package name from a requirement specifier line."""
    cleaned = line.split("#", 1)[0].strip()
    if not cleaned or cleaned.startswith("-"):
        return ""
    # Strip extras e.g. Flask-Limiter[redis] -> Flask-Limiter
    match = re.match(r"^([a-zA-Z0-9_\-\.]+)", cleaned)
    if match:
        return match.group(1).lower().replace("_", "-")
    return ""


def check_manifest_lockfile_sync(req_path: Path, lock_path: Path):
    """Ensure every package declared in requirements.txt is recorded in requirements.lock."""
    print("🔍 [Python] Validating requirements.txt vs requirements.lock parity...")
    if not req_path.exists():
        return False, f"Manifest file not found: {req_path}"
    if not lock_path.exists():
        return False, f"Lockfile not found: {lock_path}"

    def pins(path):
        result = {}
        for raw in path.read_text().splitlines():
            line = raw.split("#", 1)[0].strip()
            if not line:
                continue
            match = re.fullmatch(r"([A-Za-z0-9_.-]+)(?:\[[^\]]+\])?==([^\s;]+)", line)
            if not match:
                raise ValueError(f"Unpinned or invalid requirement in {path.name}: {line}")
            name = match[1].lower().replace("_", "-").replace(".", "-")
            if name in result:
                raise ValueError(f"Duplicate requirement in {path.name}: {name}")
            result[name] = match[2]
        return result

    try:
        declared, locked = pins(req_path), pins(lock_path)
    except ValueError as error:
        return False, str(error)
    mismatches = [name for name, version in declared.items() if locked.get(name) != version]
    if mismatches:
        return False, f"Missing or mismatched locked versions: {sorted(mismatches)}"

    print(f"  ✅ All {len(declared)} declared dependencies are locked in {lock_path.name} ({len(locked)} total packages locked).")
    return True, "Manifest and lockfile are in sync."


def check_pip_tree():
    """Run `pip check` to ensure there are no conflicting or broken dependencies."""
    print("🔍 [Python] Checking dependency tree integrity (pip check)...")
    res = subprocess.run(
        [sys.executable, "-m", "pip", "check"],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True
    )
    if res.returncode == 0:
        print("  ✅ No broken requirements found in the Python environment.")
        return True, res.stdout.strip()
    else:
        output = (res.stdout + "\n" + res.stderr).strip()
        print(f"  ❌ Broken requirements detected:\n{output}")
        return False, output


def run_pip_audit():
    """Run `pip-audit` if available to discover known CVEs and security advisories."""
    print("🔍 [Python] Scanning for security vulnerabilities (pip-audit)...")
    res = subprocess.run(
        [sys.executable, "-m", "pip_audit", "--version"],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True
    )
    if res.returncode != 0:
        print("  ⚠️  pip-audit is not installed. Install via `pip install pip-audit` to scan for CVEs.")
        return False, "pip-audit not installed"

    lock_file = ROOT_DIR / "requirements.lock"
    cmd = [sys.executable, "-m", "pip_audit"]
    if lock_file.exists():
        cmd.extend(["-r", str(lock_file)])

    audit_res = subprocess.run(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True
    )
    if audit_res.returncode == 0:
        print("  ✅ pip-audit: No known vulnerabilities found.")
        return True, audit_res.stdout.strip()
    else:
        print("  ⚠️  pip-audit discovered vulnerable packages:")
        for line in audit_res.stdout.strip().splitlines()[:15]:
            print(f"     {line}")
        if len(audit_res.stdout.strip().splitlines()) > 15:
            print("     ... (run `.venv/bin/pip-audit` for complete CVE breakdown)")
        detail = (audit_res.stdout + "\n" + audit_res.stderr).strip()
        if audit_res.stderr.strip():
            print(audit_res.stderr.strip())
        return False, detail


def check_frontend():
    """Audit React/Vite frontend dependencies using package-lock.json and npm audit."""
    frontend_dir = ROOT_DIR / "frontend"
    pkg_json = frontend_dir / "package.json"
    pkg_lock = frontend_dir / "package-lock.json"

    print("🔍 [Frontend] Checking Node / npm dependency management...")
    if not pkg_json.exists():
        print("  ℹ️  No frontend package.json found.")
        return True, "Frontend not found"
    if not pkg_lock.exists():
        print("  ❌ frontend/package-lock.json is missing! Deterministic builds cannot be guaranteed.")
        return False, "package-lock.json missing"
    print("  ✅ package.json and package-lock.json present.")

    # Check if npm is available
    npm_path = None
    for candidate in ["npm", "npm.cmd"]:
        try:
            res = subprocess.run([candidate, "--version"], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
            if res.returncode == 0:
                npm_path = candidate
                break
        except FileNotFoundError:
            continue

    if npm_path:
        audit = subprocess.run(
            [npm_path, "audit", "--audit-level=high"],
            cwd=str(frontend_dir),
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        if audit.returncode == 0:
            print("  ✅ npm audit: No high or critical vulnerabilities found.")
            return True, "npm audit clean"
        else:
            print("  ⚠️  npm audit: High or critical vulnerabilities detected in frontend dependencies.")
            return False, audit.stdout.strip()
    return False, "npm not available"


def check_mobile():
    """Audit Flutter / Dart mobile app dependencies using pubspec.lock."""
    mobile_dir = ROOT_DIR / "mobile"
    pubspec = mobile_dir / "pubspec.yaml"
    lockfile = mobile_dir / "pubspec.lock"

    print("🔍 [Mobile] Checking Dart / Flutter dependency management...")
    if not pubspec.exists():
        print("  ℹ️  No mobile pubspec.yaml found.")
        return True, "Mobile app not found"
    if not lockfile.exists():
        print("  ❌ mobile/pubspec.lock is missing! Deterministic builds cannot be guaranteed.")
        return False, "pubspec.lock missing"
    print("  ✅ pubspec.yaml and pubspec.lock present.")
    return True, "Mobile dependencies locked"


def main():
    parser = argparse.ArgumentParser(description="Audit project dependencies across Python, Node, and Dart ecosystems.")
    parser.add_argument("--check-lockfile", action="store_true", help="Enforce manifest-to-lockfile parity.")
    parser.add_argument("--strict", action="store_true", help="Exit with code 1 if any warning or CVE is found.")
    parser.add_argument("--python-only", action="store_true", help="Run only Python checks; frontend has its own CI job.")
    args = parser.parse_args()

    req_file = ROOT_DIR / "requirements.txt"
    lock_file = ROOT_DIR / "requirements.lock"

    results = []

    # 1. Lockfile sync
    sync_ok, sync_msg = check_manifest_lockfile_sync(req_file, lock_file)
    results.append(("Manifest-Lockfile Sync", sync_ok, sync_msg))

    # 2. pip check
    tree_ok, tree_msg = check_pip_tree()
    results.append(("Python Tree Integrity", tree_ok, tree_msg))

    # 3. pip-audit
    audit_ok, audit_msg = run_pip_audit()
    results.append(("Python Vulnerability Audit", audit_ok, audit_msg))

    if not args.python_only:
        # 4. Frontend
        fe_ok, fe_msg = check_frontend()
        results.append(("Frontend Dependency Health", fe_ok, fe_msg))

        # 5. Mobile
        mob_ok, mob_msg = check_mobile()
        results.append(("Mobile Dependency Health", mob_ok, mob_msg))

    print("\n" + "=" * 60)
    print("📊 DEPENDENCY AUDIT SUMMARY")
    print("=" * 60)
    for name, ok, msg in results:
        status = "✅ PASS" if ok else "⚠️  FAIL/WARN"
        print(f" {status:<12} | {name}")
    print("=" * 60)

    if args.check_lockfile and not sync_ok:
        sys.exit(1)
    if not tree_ok:
        sys.exit(1)
    if args.strict and not all(ok for _, ok, _ in results):
        sys.exit(1)

    sys.exit(0)


if __name__ == "__main__":
    main()
