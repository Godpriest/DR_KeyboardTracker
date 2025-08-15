# DR_KeyboardTracker

### [**Language: English | [簡介語言:繁體中文](README.md)**]

DR_KeyboardTracker is a powerful OBS Studio plugin for real-time tracking and displaying keyboard and mouse input states. Designed for streamers, content creators, and anyone who wants to showcase input operations during live streaming or recording.

## Features

- **Real-time Input Tracking**: Uses low-level hooks to monitor keyboard and mouse input
- **Dynamic Visual Feedback**: Displays custom images for pressed/unpressed states
- **Flexible Layout System**: JSON-based custom key arrangement configuration
- **Mouse Support**: Tracks mouse buttons (left, right, middle, X1, X2) and scroll wheel
- **Extended Key Support**: Handles extended keys such as arrow keys, numpad Enter, and right-side modifier keys
- **External Tool Integration**: Built-in buttons to open editor and generator tools

## Use Cases
- Teaching operation demonstrations and keyboard operation displays
- Keyboard visualization in game streaming
- Product demonstrations and UI/UX behavior showcases

## Installation
1. Download or extract the plugin archive (containing `data/` and `obs-plugins/` folders).
2. Overwrite these two folders directly to the "OBS Studio installation root directory".
   - Example: `C:/Program Files/obs-studio/`
3. Restart OBS and select "DR 鍵盤追蹤器 / DR KeyboardTracker Tracker" from the "Add Source" list.

## Basic Setup
1. In OBS Studio, add a source: **Sources** → **Add** → **DR Keyboard Tracker**
2. Select your layout configuration JSON file in the plugin properties
3. The plugin will automatically load images and display keys according to your configuration

### Image Requirements
- ### [**[Key Dilename Mapping](key_filename_mapping.md)**]
- **Format**: PNG
- **Structure**: Each image should contain two states:
  - Upper half: Unpressed state
  - Lower half: Pressed state
- **Transparency**: Full alpha channel support
- **Naming**: Use descriptive names or let the plugin automatically detect file extensions

## Keyboard Keys
- All standard keys (A-Z, 0-9, function keys, etc.)
- Modifier keys (Shift, Ctrl, Alt)
- Special keys (Enter, Space, Backspace, etc.)
- Extended keys (arrow keys, numpad keys, right-side modifier keys)

## Mouse Events
- Left, right, middle, X1 (forward), X2 (backward) buttons

## External Tools

The plugin includes buttons to open external tools:

- **Editor**: Opens the keyboard layout editor (`dr_kteditor/index.html`)
- ### [**[Editor Feature Description](dr_kteditor_EN.md)**]
- **Generator**: Opens the image generator tool (`dr_ktgenerator/index.html`)
- ### [**[Generator Feature Description](dr_ktgenerator_EN.md)**]

These tools help you create and modify layout configurations without manually editing JSON files.

## License and Copyright
- Copyright © Demon Realm / Godpriest

## AI Assistance
Portions of this plugin's code and documentation were generated and revised with AI assistance, with final content reviewed and integrated by the author.

---

**Note**: This plugin requires administrator privileges to use low-level input hooks. Ensure OBS Studio is running with administrator privileges.

### System Log Output
When using this plugin, OBS Studio may continuously output the following messages in system logs:
- `refresh_locale_list`: Could not find keyboard map for locale
- `get_keyboard_layout_file`: RegOpenKeyEx failed to open key

**These log outputs are normal behavior** and will not affect plugin functionality or system performance. This is expected behavior from OBS Studio's core system when processing low-level keyboard hooks, and no action is required.


