#!/usr/bin/env python3
"""
Browser automation for CRM app interaction
Usage: python browser_control.py <command> [args]
Commands:
  screenshot - Take screenshot
  click <selector> - Click element
  fill <selector> <text> - Fill input
  text <selector> - Get element text
  html <selector> - Get element HTML
  evaluate <js> - Execute JS
  goto <url> - Navigate to URL
  title - Get page title
"""

import sys
import json
from playwright.sync_api import sync_playwright


class BrowserController:
    def __init__(self):
        self.p = None
        self.browser = None
        self.page = None

    def start(self, headless=True):
        self.p = sync_playwright().start()
        self.browser = self.p.chromium.launch(headless=headless)
        self.page = self.browser.new_page()

    def stop(self):
        if self.browser:
            self.browser.close()
        if self.p:
            self.p.stop()

    def screenshot(self, path="screenshot.png"):
        self.page.screenshot(path=path)
        return path

    def click(self, selector):
        self.page.click(selector)

    def fill(self, selector, text):
        self.page.fill(selector, text)

    def text(self, selector):
        return self.page.text_content(selector) or ""

    def html(self, selector):
        return self.page.inner_html(selector) or ""

    def evaluate(self, js):
        return self.page.evaluate(js)

    def goto(self, url):
        self.page.goto(url)

    def title(self):
        return self.page.title()

    def wait_for_load(self, timeout=5000):
        self.page.wait_for_load_state(timeout=timeout)


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    cmd = sys.argv[1]
    ctrl = BrowserController()

    try:
        # Start with headless=False if user wants to see browser
        headless = "--headless" not in sys.argv
        ctrl.start(headless=headless)

        if cmd == "screenshot":
            path = sys.argv[2] if len(sys.argv) > 2 else "screenshot.png"
            ctrl.screenshot(path)
            print(f"Screenshot saved to {path}")

        elif cmd == "click":
            ctrl.click(sys.argv[2])
            print("Clicked")

        elif cmd == "fill":
            ctrl.fill(sys.argv[2], sys.argv[3])
            print("Filled")

        elif cmd == "text":
            print(ctrl.text(sys.argv[2]))

        elif cmd == "html":
            print(ctrl.html(sys.argv[2]))

        elif cmd == "evaluate":
            print(ctrl.evaluate(sys.argv[2]))

        elif cmd == "goto":
            ctrl.goto(sys.argv[2])
            ctrl.wait_for_load()
            print(f"Navigated to {sys.argv[2]}")

        elif cmd == "title":
            print(ctrl.title())

        else:
            print(f"Unknown command: {cmd}")
            sys.exit(1)

    finally:
        ctrl.stop()


if __name__ == "__main__":
    main()
