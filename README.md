# Arcane Warding Module for Foundry VTT

A Foundry VTT module that automates the Abjurer wizard's Arcane Ward feature from D&D5e 2024 (should also work for 2014 - not tested).

## General philosophy around the feature and why this module was created

According to RAW, the caster can choose to activate the ward when casting an Abjuration spell, it is not automatic. Most modules just assume that the player will only use this in combat, so it is applied automatically. If the player is in town for example, and they want to use Arcane Lock on their room door, well, now they are walking around with an Arcane Ward on them until they go to sleep for the night. There is also no mention of the ward not being visible (see the description for the Shield spell), so I assume it is visible and also does not allow for objects to pass through it. I.e. "bumping into" someone/something could lower it's HP. I know this is all academic, but I just wanted to provide players with the opportunity to have the game automation work more closely to the way the feature is written. Plus this is my first module, and I am still learning Foundry and it's API.

## Features

- **Automatic Detection**: Detects when an actor is a wizard with the Abjurer subclass (this may not work in 2014)
- **Spell Monitoring**: Automatically detects when Abjuration spells are cast
- **Smart Healing**: Calculates healing as spell level × 2 and applies it to the ward
- **Visual Feedback**: Shows ward icon when active (requires DAE and Visual Active Effects) and provides chat notifications for ward activities
- **User Choice**: Prompts players to create Arcane Ward when casting their first Abjuration spell

## Installation

Like most modules, find it in the module directory in Foundry, or use the manifest url:
https://github.com/averagejoe77/arcane-warding/releases/latest/download/module.json to install manually.

## How It Works

### Arcane Ward Detection

The module automatically detects if an actor is:

- A wizard class character
- Has the Abjurer subclass (this may not work for a D&D5e 2014 actor)

### Spell Casting Monitoring

When a spell is cast, the module:

1. Checks if the caster is an Abjurer wizard
2. Determines if the spell is an Abjuration spell
3. If it's an Abjuration spell, processes the Arcane Ward mechanics

### Arcane Ward Mechanics

- **Max HP**: Wizard level + Intelligence modifier
- **Healing**: Spell level × 2 HP restored to the ward when an Abjuraton spell is cast and the ward is active
- **Overhealing**: "I don't think so Tim." If healing would exceed max HP, only heals up to the maximum

### User Interface

- **Token HUD**: You can enable bars on your token and set one of them to the arcane ward's hp value. This bar will be the blue-ish colored one
- **Chat Notifications**: Displays chat messages on activation, damage absorbed, healing, and long resting, along with some added "flavor" in the messages. If chat bubbles are enabled, you will also get some entertaining responses from the token that is being attacked.
- **Dialog Prompts**: Asks if player wants to create the ward when casting an Abjuration spell for the first time. 

## Usage

### Automatic Operation

The module works automatically once enabled. When an Abjurer wizard casts an Abjuration spell:

1. If no Arcane Ward exists, a dialog appears asking if they want to create one
2. If they choose yes, the ward is created with max HP = wizard level + INT modifier
3. Subsequent Abjuration spell casts heal the ward for (spell level × 2) HP
4. A chat message indicates that the ward has been healed

### Visual Indicators

- With bars enabled on a token, the blue bar shows current ward health without numeric values
- When using the D&D5e PHB version of the class feature, the chracter sheet displays the wards HP as it's uses. 

## Technical Details

### Spell Detection

The module detects Abjuration spells by checking the spell school property. Compatible with D&D 5e system.

### Internationalization

Currently only English is supported. If you would like to add support for another language, feel free to add a json file for your language to the langs folder and submitt a pull request. I would be happy to have it support other languages and do not trust AI enough to get it right.

Also, there is a section in the language files for "WITTY_MESSAGES". You can add your own messages to the file and the module will automatically use them when the ward absorbs damage. No need to wait for an update to the module to get creative with your own installation. You can also make suggestion in the issues here on github.

### Compatibility

- Foundry VTT v12+
- D&D 5e system
- Midi-QOL
- DAE
- Visual Active Effects

## Support

For issues or questions:

1. Check the browser console for error messages
2. Verify module compatibility with your Foundry VTT version

## License

This module is provided as-is for use with Foundry VTT. Feel free to modify and distribute as needed.

## Version History

**v1.0.0**: Initial release with basic Arcane Ward functionality

**v1.0.1**: Fixed the module.json for dependencies so they are prompted to be installed if missing