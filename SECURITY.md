# Security and privacy

Never publish `.local/`, application executables, ASAR archives, backups, histories, profiles or unredacted logs. Release packaging excludes them by allowlist and checks for credential and machine-path patterns.

This adapter changes executable bytes in a local copy and invalidates its vendor signature. It does not disable Chromium sandboxing or global OS security settings. Do not weaken system protections to force installation. If the copy is rejected, use the official app.

Report sensitive findings privately to the repository owner using their GitHub profile contact options. A confidential reporting channel has not yet been configured; do not put credentials in a public issue.
