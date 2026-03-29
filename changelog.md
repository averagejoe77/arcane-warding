# Changelog

All notable changes to the Arcane Warding module will be documented in this file.

## [Unreleased] / Recent Updates (2026-03-29)

### Added
- **Socket Infrastructure**: Added new socket handlers (`applyEffect`, `updateItem`, `deleteEffect`) allowing players to securely delegate actions requiring elevated privileges to the Game Master's client.
- **Reaction Tracking**: Integrated Midi-QOL reaction usage tracking when a Projected Ward is absorbed.
- **Safe Wrapper Helpers**: Added `updateItemSafe` and `deleteEffectSafe` utility methods to transparently shift data edits via network sockets when the operating player lacks Actor modification permissions.

### Fixed
- **Actor Resolution**: Fixed a severe bug in Projected Ward where target resolutions grabbed raw Base Actors instead of immediate Token Actors, which previously prevented correct effect removal.
- **Socket Emission Bypass**: Remedied an edge case where attacking players triggered prompt dialogs locally rather than beaming it to the actual Abjurer player owning the Arcane Ward.

### Refactored
- **Dialog Handler**: Renamed and internally streamlined the dialog creation methods within `arcane-warding.js`.

---

## [1.2.22] - 2025-10-20
### Added
- **D&D 5e 2014 Support**: Re-added support integrations specifically tailored for the latest 2014 D&D 5e mechanics rule revisions.

## [1.2.21] - 2025-10-20
### Changed
- **Documentation**: Overhauled `README.md` to properly clarify 5e version support and streamline the general Arcane Ward mechanics documentation. Removed legacy references implicitly tying functionality to Midi-QOL features that were stripped.

## [1.2.18] - 2025-10-20
### Fixed
- **Detection Enhancements**: Improved the consistency of detecting underlying Arcane Ward Activities in the host actor framework.
- Simplified the verified compatibility tags to display cleaner metrics.

## [1.2.16] - 2025-09-16
### Fixed
- **UI Enhancements**: Resolved visual inconsistencies with the player's Chat Messages and UI pop-up bubbles.
- Removed excessive spam network logging.
