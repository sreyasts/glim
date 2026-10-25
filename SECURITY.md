# Security

Do not publish credentials, private camera links, session tokens, push endpoints, or personal data in issues. For sensitive findings, use GitHub's private vulnerability reporting when enabled; otherwise contact the maintainer through the contact information published on their GitHub profile before sharing exploit details.

The server accepts only curated camera IDs. It never fetches a user-supplied stream URL. Mutation routes check the exact configured Origin, use SameSite Strict HTTP-only session cookies, validate inputs, and scope private records to the session. Browser push fetches are restricted to known HTTPS push-service hosts.

This first release has anonymous browser sessions, no account recovery, and one SQLite-backed worker. Internet-scale abuse resistance and distributed execution require additional work. It must not be used as a safety-critical surveillance or emergency notification system.
