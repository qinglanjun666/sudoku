import os
import re

root_dir = r"c:\xampp\htdocs\Sudoku"

def process_file(file_path):
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
    except Exception as e:
        print(f"Error reading {file_path}: {e}")
        return

    original_content = content
    
    # Regex to match fetch calls for header/footer that DON'T already have a query param
    # We look for fetch('path') or fetch("path")
    # And we want to avoid replacing if it already has ?v=
    
    # Pattern 1: /partials/header.html
    # We want to replace fetch('/partials/header.html') with fetch('/partials/header.html?v=' + Date.now())
    # But only if ?v= is not there.
    
    def replace_func(match):
        prefix = match.group(1) # fetch(' or fetch("
        path = match.group(2)   # /partials/header.html or ../partials/header.html
        suffix = match.group(3) # ') or ")
        
        if '?' in path:
            return match.group(0) # Already has query param
            
        new_path = path + "?v=' + Date.now()"
        # If the quote was closed immediately, we need to adjust syntax
        # The original code: fetch('/partials/header.html')
        # We want: fetch('/partials/header.html?v=' + Date.now())
        
        # If the regex matched the closing quote, we need to be careful.
        # My regex below captures the path inside quotes.
        
        quote = prefix[-1]
        return f"{prefix[:-1]}{quote}{path}?v=' + Date.now(){quote}{suffix[1:]}"

    # Simple string replacement might be safer if the patterns are consistent.
    # The patterns observed:
    # fetch('/partials/header.html')
    # fetch('../partials/header.html')
    # fetch("/partials/header.html")
    
    # Let's use simple replacement with a check
    
    replacements = [
        ("fetch('/partials/header.html')", "fetch('/partials/header.html?v=' + Date.now())"),
        ("fetch('/partials/footer.html')", "fetch('/partials/footer.html?v=' + Date.now())"),
        ("fetch('../partials/header.html')", "fetch('../partials/header.html?v=' + Date.now())"),
        ("fetch('../partials/footer.html')", "fetch('../partials/footer.html?v=' + Date.now())"),
        ('fetch("/partials/header.html")', 'fetch("/partials/header.html?v=" + Date.now())'),
        ('fetch("/partials/footer.html")', 'fetch("/partials/footer.html?v=" + Date.now())'),
        ('fetch("../partials/header.html")', 'fetch("../partials/header.html?v=" + Date.now())'),
        ('fetch("../partials/footer.html")', 'fetch("../partials/footer.html?v=" + Date.now())'),
    ]
    
    changed = False
    for old, new in replacements:
        if old in content and new not in content:
            # Check if it's already patched with a different timestamp logic?
            # The check `new not in content` is insufficient if the spacing is different, 
            # but strict string replacement relies on exact match.
            # If the file has `fetch('/partials/header.html?v=...')` it won't match `old` which is `fetch('/partials/header.html')`
            # Wait, `fetch('/partials/header.html')` is a substring of `fetch('/partials/header.html?v=...')`?
            # No, because of the closing quote.
            # `fetch('/partials/header.html')` ends with `')`.
            # `fetch('/partials/header.html?v=...')` ends with `?v=...')`.
            
            # So looking for the EXACT string `fetch('/partials/header.html')` is safe.
            # It implies the string ends there.
            
            content = content.replace(old, new)
            changed = True
            
    if changed:
        print(f"Updating {file_path}")
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)

for root, dirs, files in os.walk(root_dir):
    for file in files:
        if file.endswith(".html"):
            process_file(os.path.join(root, file))
