# Security

Do not publish credentials, private camera links, session tokens, push endpoints, or personal data in issues. For sensitive findings, use GitHub's private vulnerability reporting when enabled; otherwise contact the maintainer through the contact information published on their GitHub profile before sharing exploit details.

The server accepts known provider camera IDs instead of arbitrary stream inputs. Its Caltrans HLS relay validates every playlist and segment URL against HTTPS government hosts, rejects redirects and unrelated hosts, and checks response types. Catalog endpoints are fixed operator APIs. Mutation routes check the exact configured Origin, use SameSite Strict HTTP-only session cookies, validate inputs, and scope private records to the session. Browser push fetches are restricted to known HTTPS push-service hosts. Windy API keys remain server-side in a gitignored environment file.

This first release has anonymous browser sessions, no account recovery, and one SQLite-backed worker. Internet-scale abuse resistance and distributed execution require additional work. It must not be used as a safety-critical surveillance or emergency notification system.
