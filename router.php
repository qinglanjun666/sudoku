<?php
// router.php

$uri = urldecode(
    parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH)
);

// Verify if the file exists
if ($uri !== '/' && file_exists(__DIR__ . $uri)) {
    // Check if it is a directory and has an index.html
    if (is_dir(__DIR__ . $uri)) {
        if (file_exists(__DIR__ . $uri . '/index.html')) {
            include __DIR__ . $uri . '/index.html';
            return;
        }
    } else {
        return false; // Serve the requested resource as-is
    }
}

// Handle root requests
if ($uri === '/') {
    include __DIR__ . '/index.html';
    return;
}

// Handle /sudoku/daily/ requests or root
if ($uri === '/sudoku/daily/' || $uri === '/sudoku/daily') {
    include __DIR__ . '/sudoku/daily/index.html';
    return;
}

// Handle daily challenge URLs: /DD-MM-YYYY-sudoku
// Regex matches: 1 or 2 digits, dash, 1 or 2 digits, dash, 4 digits, -sudoku
if (preg_match('/^\/\d{1,2}-\d{1,2}-\d{4}-sudoku$/', $uri)) {
    // Serve the daily page. 
    // The JavaScript in the page will handle parsing the URL to determine the date.
    include __DIR__ . '/sudoku/daily/index.html';
    return;
}

// Fallback to 404
http_response_code(404);
echo "404 Not Found";
