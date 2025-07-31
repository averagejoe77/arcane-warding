# Arcane Warding Module for Foundry VTT

A Foundry VTT module that automates the Abjurer wizard's Arcane Ward feature from D&D 5e.

## Features

- **Automatic Detection**: Detects when an actor is a wizard with the Abjurer subclass
- **Spell Monitoring**: Automatically detects when Abjuration spells are cast
- **Arcane Ward Management**: Creates and manages Arcane Ward HP based on wizard level + INT modifier
- **Smart Healing**: Calculates healing as spell level × 2 and applies it to the ward
- **Visual Feedback**: Shows ward HP on token HUD and provides chat notifications
- **User Choice**: Prompts players to create Arcane Ward when casting their first Abjuration spell

## Installation

1. Download this module folder
2. Place it in your Foundry VTT `Data/modules/` directory
3. Enable the module in your Foundry VTT world settings
4. Restart your Foundry VTT server

## How It Works

### Arcane Ward Detection
The module automatically detects if an actor is:
- A wizard class character
- Has the Abjurer subclass

### Spell Casting Monitoring
When a spell is cast, the module:
1. Checks if the caster is an Abjurer wizard
2. Determines if the spell is an Abjuration spell
3. If it's an Abjuration spell, processes the Arcane Ward mechanics

### Arcane Ward Mechanics
- **Max HP**: Wizard level + Intelligence modifier
- **Healing**: Spell level × 2 HP restored to the ward
- **Overhealing**: If healing would exceed max HP, only heals up to the maximum

### User Interface
- **Token HUD**: Shows current ward HP below the token
- **Chat Notifications**: Displays healing messages in chat
- **Context Menu**: Right-click on actor to manually initialize Arcane Ward
- **Dialog Prompts**: Asks if player wants to create ward when casting first Abjuration spell

## Usage

### Automatic Operation
The module works automatically once enabled. When an Abjurer wizard casts an Abjuration spell:

1. If no Arcane Ward exists, a dialog appears asking if they want to create one
2. If they choose yes, the ward is created with max HP = wizard level + INT modifier
3. The spell heals the ward for (spell level × 2) HP
4. A chat message shows the healing amount and current ward HP

### Manual Control
- Right-click on an Abjurer wizard actor in the actor directory
- Select "Initialize Arcane Ward" to manually create a ward

### Visual Indicators
- Ward HP is displayed below the token on the map
- Blue HP bar shows current ward health
- Text shows "Ward: current/max" format

## Technical Details

### Data Storage
Arcane Ward data is stored as actor flags:
```javascript
{
  currentHP: number,
  maxHP: number,
  isActive: boolean
}
```

### Spell Detection
The module detects Abjuration spells by checking the spell school property. Compatible with D&D 5e system.

### Compatibility
- Foundry VTT v10+
- D&D 5e system
- Compatible with most other modules

## Troubleshooting

### Ward Not Appearing
1. Ensure the actor is a wizard with Abjurer subclass
2. Check that the module is enabled in world settings
3. Try manually initializing the ward via context menu

### Spell Not Detected
1. Verify the spell has the correct school (Abjuration)
2. Check that the spell is being cast by the Abjurer wizard
3. Ensure the spell is being cast through the proper system

### HP Calculation Issues
1. Verify the wizard level is set correctly
2. Check that Intelligence modifier is calculated properly
3. Review the console for any error messages

## Support

For issues or questions:
1. Check the browser console for error messages
2. Verify module compatibility with your Foundry VTT version
3. Ensure all prerequisites are met

## License

This module is provided as-is for use with Foundry VTT. Feel free to modify and distribute as needed.

## Version History

**v1.0.0**: Initial release with basic Arcane Ward functionality