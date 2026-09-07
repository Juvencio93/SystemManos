import asyncio
import json
import os
from pathlib import Path
from playwright.async_api import async_playwright

SCREENSHOTS = Path("/tmp/browser/financeiro_responsivity/screenshots")
SCREENSHOTS.mkdir(parents=True, exist_ok=True)

async def check_resolution(page, width, height, label):
    await page.set_viewport_size({"width": width, "height": height})
    # Wait for any transitions
    await asyncio.sleep(1)
    
    # Check for horizontal overflow
    scroll_width = await page.evaluate("document.body.scrollWidth")
    inner_width = await page.evaluate("window.innerWidth")
    
    # Capture the cards area specifically
    cards_grid = page.locator(".grid").first
    grid_box = await cards_grid.bounding_box()
    
    # Measure card widths
    card_widths = await page.evaluate("""
        () => {
            const grid = document.querySelector('.grid');
            if (!grid) return [];
            return Array.from(grid.children).map(c => c.offsetWidth);
        }
    """)
    
    status = "OK" if scroll_width <= inner_width else "OVERFLOW"
    print(f"Resolution {width}x{height} ({label}): {status} | Scroll: {scroll_width} | Inner: {inner_width} | Cards: {card_widths}")
    
    await page.screenshot(path=str(SCREENSHOTS / f"{width}_{label}.png"))
    return {
        "label": label,
        "width": width,
        "scroll_width": scroll_width,
        "inner_width": inner_width,
        "card_widths": card_widths,
        "overflow": scroll_width > inner_width
    }

async def main():
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(headless=True)
        context = await browser.new_context()
        page = await context.new_page()

        # Auth injection
        storage_key = os.environ.get("BROWSER_SUPABASE_STORAGE_KEY")
        session_json = os.environ.get("BROWSER_SUPABASE_SESSION_JSON")
        if storage_key and session_json:
            await page.goto("http://localhost:8080")
            await page.evaluate(f"window.localStorage.setItem({json.dumps(storage_key)}, {json.dumps(session_json)})")

        await page.goto("http://localhost:8080/financeiro")
        # Wait for loading skeletons to disappear or data to load
        await page.wait_for_selector("h1:has-text('Financeiro')")
        await asyncio.sleep(2)

        resolutions = [
            (320, 568, "Mobile S"),
            (375, 667, "Mobile M"),
            (390, 844, "iPhone 12"),
            (414, 896, "Mobile L"),
            (768, 1024, "Tablet"),
            (1024, 768, "Laptop S"),
            (1280, 800, "Laptop M"),
            (1440, 900, "Desktop")
        ]

        results = []
        for w, h, label in resolutions:
            results.append(await check_resolution(page, w, h, label))

        with open("/tmp/browser/financeiro_responsivity/results.json", "w") as f:
            json.dump(results, f, indent=2)

        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
