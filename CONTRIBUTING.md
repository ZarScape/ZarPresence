# Contributing to ZarPresence

First off, thanks for taking the time to contribute! 🎉

## How Can I Contribute?

### Adding New Platforms
We want to support as many platforms as possible! To add a new platform:
1. Create a new content script in `src/extension/`.
2. Update `src/extension/manifest.json` to include the new matches.
3. Update the `DiscordState` in `src-tauri/src/discord.rs` to handle the new platform ID and assets.

### Reporting Bugs
If you find a bug, please open an issue with:
- Your Browser (Chrome/Edge/Brave).
- The platform you were using (YouTube/Crunchyroll).
- Steps to reproduce the issue.

### Pull Requests
- Keep your PRs focused on a single feature or bug fix.
- Ensure your code follows the existing style.
- Update the `CHANGELOG.md` if you are adding a new feature.

## License
By contributing, you agree that your contributions will be licensed under its **GPL-3.0 License**.
