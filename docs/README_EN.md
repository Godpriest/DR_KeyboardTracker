# DR_KeyboardTracker

[English](README.md) | [中文](README_zh-TW.md)

A powerful OBS Studio plugin for tracking and displaying keyboard and mouse input states in real-time. Perfect for streamers, content creators, and anyone who wants to showcase their input operations during live broadcasts or recordings.

## Features

- **Real-time Input Tracking**: Monitors keyboard and mouse input using low-level hooks
- **Dynamic Visual Feedback**: Displays pressed/unpressed states with custom images
- **Flexible Layout System**: JSON-based configuration for custom key arrangements
- **Mouse Support**: Tracks mouse buttons (left, right, middle, X1, X2) and scroll wheel
- **Extended Key Support**: Handles extended keys like arrow keys, numpad Enter, right modifiers
- **Multi-language Support**: Built-in localization (English, Traditional Chinese, Japanese)
- **External Tools Integration**: Built-in buttons to open editor and generator tools

## Installation

### Prerequisites
- OBS Studio 28.0 or later
- Windows 10/11 (64-bit)
- Visual Studio 2022 (for building from source)

### Build from Source

1. Clone the repository:
```bash
git clone https://github.com/Godpriest/DR_KeyboardTracker.git
cd DR_KeyboardTracker
```

2. Build using CMake:
```bash
mkdir build
cd build
cmake .. -G "Visual Studio 17 2022" -A x64
cmake --build . --config Release
```

3. Install to OBS:
   - Copy `DR_KeyboardTracker.dll` to your OBS plugins directory
   - Copy the `data` folder contents to your OBS data directory
   - Restart OBS Studio

### Quick Build Script
Use the provided `build.bat` script for Windows:
```bash
build.bat
```

## Usage

### Basic Setup

1. In OBS Studio, add a new source: **Sources** → **Add** → **Keyboard Tracker**
2. Select your layout JSON file in the plugin properties
3. The plugin will automatically load images and display keys according to your configuration

### JSON Configuration

The plugin reads a JSON file that defines the keyboard layout:

```json
{
  "canvas": {
    "width": 1920,
    "height": 1080
  },
  "keys": [
    {
      "id": "shift",
      "keyBinding": "shift",
      "vk": 16,
      "extended": false,
      "sprite": "shift.png",
      "x": 100,
      "y": 200,
      "w": 64,
      "h": 64
    }
  ]
}
```

### Key Properties

- **id**: Unique identifier for the key
- **keyBinding**: Human-readable key name (e.g., "shift", "enter", "space")
- **vk**: Virtual Key code (optional, auto-detected if not provided)
- **extended**: Whether this is an extended key (e.g., right Ctrl, arrow keys)
- **sprite**: Image file path (relative to JSON file)
- **x, y**: Position coordinates
- **w, h**: Width and height
- **rotation**: Rotation angle (optional)

### Image Requirements

- **Format**: PNG, JPG, JPEG, WebP, BMP
- **Structure**: Each image should contain two states:
  - Top half: Unpressed state
  - Bottom half: Pressed state
- **Transparency**: Full alpha channel support
- **Naming**: Use descriptive names or let the plugin auto-detect extensions

## Supported Input Types

### Keyboard Keys
- All standard keys (A-Z, 0-9, function keys, etc.)
- Modifier keys (Shift, Ctrl, Alt)
- Special keys (Enter, Space, Backspace, etc.)
- Extended keys (arrow keys, numpad keys, right modifiers)

### Mouse Events
- **Buttons**: Left, Right, Middle, X1 (forward), X2 (back)
- **Scroll**: Wheel up/down with visual feedback

### Key Binding Examples

| Key | Binding | VK Code |
|-----|---------|---------|
| Shift | `shift` | 16 |
| Enter | `enter` | 13 |
| Space | `space` | 32 |
| Arrow Up | `up` | 38 |
| Mouse Left | `mouseleft` | 1 |
| Wheel Up | `wheelup` | 0x0A01 |

## External Tools

The plugin includes buttons to open external tools:

- **Editor**: Open the keyboard layout editor (`dr_kteditor/index.html`)
- **Generator**: Open the image generator tool (`dr_ktgenerator/index.html`)

These tools help you create and modify layouts without manually editing JSON files.

## Localization

The plugin supports multiple languages:
- **English (en-US)**: Default language
- **Traditional Chinese (zh-TW)**: 繁體中文
- **Japanese (ja-JP)**: 日本語

Language selection follows your OBS Studio language settings.

## Troubleshooting

### Common Issues

1. **No Display**: Check JSON file path and image file existence
2. **Wrong Colors**: Ensure images are in correct format (PNG with transparency recommended)
3. **Keys Not Responding**: Verify VK codes and extended flags in JSON
4. **Build Errors**: Ensure Visual Studio 2022 and CMake are properly installed

### Debug Information

Check OBS Studio logs for detailed error messages:
- **File**: `%APPDATA%\obs-studio\logs\`
- **Look for**: "DR_KeyboardTracker" entries

## Development

### Project Structure
```
DR_KeyboardTracker/
├── src/                    # Source code
├── cmake/                  # CMake configuration
├── data/                   # Localization files
├── dr_kteditor/           # Layout editor tool
├── dr_ktgenerator/        # Image generator tool
└── CMakeLists.txt         # Build configuration
```

### Dependencies
- **libobs**: OBS Studio plugin API
- **nlohmann/json**: JSON parsing library
- **Windows WIC**: Image loading and processing
- **Windows Hooks**: Input event monitoring

### Building
The project uses CMake with Visual Studio 2022 generator. Key build options:
- **C++17**: Required for modern C++ features
- **UTF-8**: Source files encoded in UTF-8
- **MSVC**: Microsoft Visual C++ compiler

## License

Copyright © 2025 Godpriest. All rights reserved.

## Contributing

Contributions are welcome! Please feel free to submit issues, feature requests, or pull requests.

## Support

For support and questions:
- Create an issue on GitHub
- Check the troubleshooting section above
- Review OBS Studio logs for error details

---

**Note**: This plugin requires administrative privileges to install low-level input hooks. Ensure OBS Studio is running with appropriate permissions.
