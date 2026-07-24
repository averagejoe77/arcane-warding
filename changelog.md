# Changelog

All notable changes to the Arcane Warding module will be documented in this file.

## [1.2.25] - 2026-07-23

### Added
- **Stat Tracking**: The readme now uses my own custom stat tracker becasue third party ones kept failing.
- **Update Chat Messages**: I know I hate them too, but after looking at the stats for this module, I figured I should I add a little notification to let you know that an update exists, so you can get the latest fixes/features.
- **Custom Ward Icon**: This was silly and not realyl something I wanted to do, but you can blame v14 for this as the icon I was using was no longer availble at the same path as v13. So, I made my own icon so the path will not change in future releases.

### Fixed
- **v14 Emote Messages**: Fixed a validation error (`type "3" is not a valid type for the ChatMessage Document class`) thrown when Projected Ward sent an "emote" chat message under Foundry v14. v14 moved the old numeric message type to a new `style` field, separate from the document's string `type` sub-type field.
- **v14 Effect Application and Removal**: Fixed the Projected Ward applying and removing the Arcane Ward effect from the target of an attack in v14.
- **v14 Arcane Ward not being removed on long rest**: Again why keep data models the same when you can change them and break the entire ecosystem, am I right Foundry?

---

## [1.2.24] - 2026-05-08

### Changed
- **Foundry v14 Support**: Bumped verified compatibility for Foundry, Midi-QOL, DAE, and Visual Active Effects to v14.
- **Active Effect Icon Display**: Switched the Arcane Ward effect to use the core `showIcon` flag instead of the DAE-specific `showIcon` flag, aligning with DAE's v14 behavior.

### Fixed
- **Emote Chat Messages**: Added a version-aware branch so emote-mode messages set `CONST.CHAT_MESSAGE_STYLES.EMOTE` on v14 and `CONST.CHAT_MESSAGE_TYPES.EMOTE` on v13 and earlier. (Later found to still need the `style`/`type` field split above.)

---

## [1.2.23] - 2026-03-29

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
