"""Minimal static file server for local preview (python3 -m http.server needs a
readable cwd, which the launcher doesn't always provide)."""
import functools
import os
import sys
from http.server import HTTPServer, SimpleHTTPRequestHandler

ROOT = os.path.dirname(os.path.abspath(__file__))
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8420

os.chdir(ROOT)
handler = functools.partial(SimpleHTTPRequestHandler, directory=os.getcwd())
print("serving %s on http://localhost:%d" % (os.getcwd(), PORT), flush=True)
HTTPServer(("127.0.0.1", PORT), handler).serve_forever()
