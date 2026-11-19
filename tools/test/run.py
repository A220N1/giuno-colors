"""Run the browser tests of Giuno Colors in headless Firefox and save a screenshot of each case."""
import argparse
import http.server
import json
import shutil
import subprocess
import sys
import threading
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent

# name, test module, window size
CASES = [
    ("play-412x700", "play", (412, 700)),
    ("play-412x860", "play", (412, 860)),
    ("play-860x412", "play", (860, 412)),
    ("gallery", "gallery", (412, 860)),
    ("draw-412x860", "draw", (412, 860)),
    ("draw-412x700", "draw", (412, 700)),
    ("draw-860x412", "draw", (860, 412)),
]

PREFS = """\
user_pref("devtools.console.stdout.content", true);
user_pref("dom.serviceWorkers.enabled", false);
user_pref("browser.cache.disk.enable", false);
user_pref("browser.cache.memory.enable", false);
user_pref("browser.shell.checkDefaultBrowser", false);
user_pref("datareporting.policy.dataSubmissionEnabled", false);
user_pref("toolkit.telemetry.reportingpolicy.firstRun", false);
"""
PROFILE_MARK = "giuno-test-profile"
GIF = b"GIF89a\x01\x00\x01\x00\x00\x00\x00;"


class Results:
    """What the test page posts back. The page's last image waits for it, so the screenshot shows the end state."""

    def __init__(self):
        self.lock = threading.Lock()
        self.done = threading.Event()
        self.data = None
        self.hold_s = 60

    def reset(self, hold_s):
        with self.lock:
            self.done = threading.Event()
            self.data = None
            self.hold_s = hold_s


def make_handler(site, results):
    class Handler(http.server.SimpleHTTPRequestHandler):
        def __init__(self, *a, **k):
            super().__init__(*a, directory=str(site), **k)

        def end_headers(self):
            self.send_header("Cache-Control", "no-store")
            super().end_headers()

        def do_GET(self):
            if self.path.startswith("/__hold"):
                results.done.wait(results.hold_s)
                self.send_response(200)
                self.send_header("Content-Type", "image/gif")
                self.end_headers()
                self.wfile.write(GIF)
                return
            super().do_GET()

        def do_POST(self):
            body = self.rfile.read(int(self.headers.get("Content-Length", 0)))
            if self.path.startswith("/__result"):
                results.data = json.loads(body)
                results.done.set()
            self.send_response(204)
            self.end_headers()

        def log_message(self, *args):
            pass

    return Handler


def host_path(path, firefox):
    """Path as Firefox sees it: a Windows path when a Windows Firefox runs from WSL."""
    if firefox.suffix.lower() == ".exe" and shutil.which("wslpath"):
        return subprocess.run(["wslpath", "-w", str(path)], check=True, capture_output=True, text=True).stdout.strip()
    return str(path)


def stop_leftovers(args):
    """Stop any Firefox still running on the test profile; killing the WSL side of firefox.exe leaves it running."""
    if not (args.firefox.suffix.lower() == ".exe" and shutil.which("powershell.exe")):
        return
    profile = host_path(args.profile, args.firefox).replace("'", "''")
    script = ("Get-CimInstance Win32_Process -Filter \"name='firefox.exe'\" | "
              f"Where-Object {{ $_.CommandLine -like '*--profile {profile} *' }} | "
              "ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }")
    subprocess.run(["powershell.exe", "-NoProfile", "-Command", script], capture_output=True)


def prepare_profile(profile):
    profile.mkdir(parents=True, exist_ok=True)
    mark = profile / PROFILE_MARK
    if any(profile.iterdir()) and not mark.exists():
        sys.exit(f"error: {profile} is not empty and was not made by this script")
    mark.write_text("Firefox profile for the Giuno Colors tests; safe to delete.\n")
    (profile / "user.js").write_text(PREFS)


def prepare_site(site):
    """Add the test modules and one page per test module next to the app's index.html."""
    shutil.copytree(HERE, site / "test", ignore=shutil.ignore_patterns("*.py", "__pycache__"))
    index = (site / "index.html").read_text(encoding="utf-8")
    app = '<script type="module" src="js/main.js"></script>'
    if index.count(app) != 1 or index.count("<body>") != 1:
        sys.exit("error: index.html no longer has the expected main.js script or <body> tag")
    for module in sorted({m for _, m, _ in CASES}):
        page = index.replace(app, f'<script type="module" src="test/{module}.test.js"></script>')
        page = page.replace("<body>", '<body>\n<img src="__hold" alt="" hidden>')
        (site / f"test-{module}.html").write_text(page, encoding="utf-8")


def run_case(name, module, size, args, results, out):
    shot = out / f"{name}.png"
    results.reset(args.timeout)
    cmd = [str(args.firefox), "--headless", "--no-remote", "--profile", host_path(args.profile, args.firefox),
           f"--window-size={size[0]},{size[1]}", "--screenshot", host_path(shot, args.firefox),
           f"http://localhost:{args.port}/test-{module}.html?case={name}"]
    t0 = time.monotonic()
    proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, errors="replace")
    try:
        output, _ = proc.communicate(timeout=args.timeout + 30)
    except subprocess.TimeoutExpired:
        proc.kill()
        stop_leftovers(args)
        output, _ = proc.communicate()
    (out / f"{name}.log").write_text(output)
    data = results.data
    took = time.monotonic() - t0
    if data is None:
        print(f"FAIL {name}: no result after {took:.0f} s (see {name}.log)")
        return False
    failures = data.get("failures", [])
    print(f"{'ok  ' if not failures else 'FAIL'} {name}: {data.get('checks', 0)} checks, "
          f"{len(failures)} failed, {took:.0f} s")
    for line in data.get("log", []):
        print(f"     {line}")
    for f in failures:
        print(f"     failed: {f}")
    return not failures


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--firefox", type=Path, required=True, help="Firefox executable (firefox.exe works from WSL)")
    ap.add_argument("--profile", type=Path, required=True,
                    help="folder for a dedicated Firefox profile, created if missing; from WSL it must be on a "
                         "Windows drive, or the browser storage the app needs is refused")
    ap.add_argument("--out", type=Path, required=True, help="new or empty folder for the site, screenshots and logs")
    ap.add_argument("--only", action="append", default=[], help="run only this case (repeatable)")
    ap.add_argument("--port", type=int, default=8765, help="local port for the test server")
    ap.add_argument("--timeout", type=int, default=180, help="seconds allowed per case")
    ap.add_argument("--list", action="store_true", help="list the cases and exit")
    args = ap.parse_args()

    if args.list:
        for name, module, size in CASES:
            print(f"{name}: {module}.test.js at {size[0]} x {size[1]}")
        return
    cases = [c for c in CASES if not args.only or c[0] in args.only]
    unknown = set(args.only) - {c[0] for c in CASES}
    if unknown:
        sys.exit("error: unknown case " + ", ".join(sorted(unknown)))
    if args.out.exists() and any(args.out.iterdir()):
        sys.exit(f"error: {args.out} is not empty")
    args.out.mkdir(parents=True, exist_ok=True)
    prepare_profile(args.profile)
    stop_leftovers(args)

    site = args.out / "site"
    subprocess.run([sys.executable, str(ROOT / "build.py"), "--out", str(site)], check=True, stdout=subprocess.DEVNULL)
    prepare_site(site)

    results = Results()
    server = http.server.ThreadingHTTPServer(("127.0.0.1", args.port), make_handler(site, results))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    try:
        passed = [run_case(name, module, size, args, results, args.out) for name, module, size in cases]
    finally:
        server.shutdown()
    print(f"{sum(passed)} of {len(passed)} cases passed; screenshots in {args.out}")
    sys.exit(0 if all(passed) else 1)


if __name__ == "__main__":
    main()
