# Security Policy

## Privacy & Data Handling
This extension adheres strictly to the principle of least privilege:
- **No data collection:** The extension does not collect, record, or track any personal user data, browsing history, or login credentials.
- **No external network communication:** All network requests (`/watch?v=...`) are performed exclusively within the user's active YouTube session to fetch public video metadata. No data is sent to any external server.
- **Client-side only:** All settings are stored locally in your browser via `chrome.storage.sync`.

## Reporting a Vulnerability
If you discover a security vulnerability or bug that compromises user security:
1. Please do **NOT** open a public issue.
2. Instead, report it privately via GitHub Security Advisories or contact the repository owner directly.
3. Vulnerabilities will be addressed and resolved promptly.
