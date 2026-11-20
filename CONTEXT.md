# CONTEXT.md — Buzz Foundation Project Context & Handoff Document

## Architecture Overview
- **Core Technology Stack**:
  - Desktop Client: Tauri 2 + React 19 + TypeScript + Vite + Tailwind CSS.
  - Native Backend: Rust (`buzz_foundation_lib`, `src-tauri/`).
  - Bundled Sidecars & Resources (`src-tauri/resources/bin/`):
    - `goose-acp` (1.59.2, staged via `scripts/build-goose-acp.mjs`)
    - `buzz-agent-command` (`crates/agent-command`, built via `scripts/build-agent-command.mjs`)
    - `buzz-cli` (built from `block/buzz` rev `630922a9`, staged via `scripts/build-buzz-cli.mjs`)
  - Platform Overrides:
    - Windows: `src-tauri/tauri.windows.conf.json` (`productName: "Buzz Foundation"`, `installerHooks: "installer-hooks.nsh"` for PATH injection and AppUserModelId registration).

## k2alpha Auto-Updater & Release Pipeline
- **Distribution Model**:
  - Workflow: `.github/workflows/release.yml` triggers on version tag pushes (`v*`) and manual `workflow_dispatch`.
  - Runner: `windows-latest` (`x86_64-pc-windows-msvc`).
  - Bundler: `tauri-apps/tauri-action@v0` generates per-user NSIS installer (`Buzz.Foundation_<version>_x64-setup.exe`), signature (`.sig`), and updater manifest (`latest.json`).
  - Endpoint: `https://github.com/ranjank2alpha/buzz-v1.0plus-app/releases/latest/download/latest.json`.
  - Frontend Updates Service: `src/features/updates/updates.ts` checks every 60 minutes and on app launch, shows restart action in top navigation bar (`UpdateAction.tsx`) and notification toasts (`UpdateNotice.tsx`), invoking Rust command `update_restart` upon confirmation.
- **Signing & Cryptography**:
  - Tool: Minisign via `pnpm tauri signer`.
  - Public Key (embedded in `src-tauri/tauri.conf.json` and `release.yml`):
    `dW50cnVzdGVkIGNvbW1lbnQ6IG1pbmlzaWduIHB1YmxpYyBrZXk6IDFBNjZEMTFCNjJFNzk1NkMKUldSc2xlZGlHOUZtR3VUTXhMcXAxeHFRSCtYeklYQjlvaFJOeDhWbkFtYkF6MTVmbm5pOTVIdHMK`
  - GitHub Actions Secrets on `ranjank2alpha/buzz-v1.0plus-app`:
    - `TAURI_SIGNING_PRIVATE_KEY` (configured)
    - `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` (configured, blank)
- **Compilation Gating**:
  - `src-tauri/build.rs` requires `BUZZ_UPDATER_PUBLIC_KEY` and `BUZZ_UPDATER_ENDPOINT` environment variables to emit `cargo:rustc-cfg=buzz_updater_enabled`.
  - `src-tauri/src/lib.rs` gates `tauri_plugin_updater::Builder::new().build()` on `#[cfg(buzz_updater_enabled)]` and `!tauri::is_dev()`.

## App Identifiers & Migration
- App Identifier: `xyz.block.buzz.desktop`
- Legacy 0.5.x App Identifier: `xyz.block.buzz.app`
- Migration: One-time identity import from legacy store documented in `docs/migrating-to-foundation.md`.
- NSIS Installation: Per-user (`currentUser`, no UAC/admin elevation required).
