## DR Keyboard Tracker Generator – Feature Description (English)

This generator tool is used to create keyboard key images that meet the requirements for the OBS plugin (DR_KeyboardTracker). It supports multi-scale image import, individual key font style settings, and batch export functionality.

### Base Images (Multi-Scale)

- **Default Unit (1x Width)**: Set the base image dimensions, with options for 64 or 128 pixel width
- **Multi-Scale Image Import**: Supports different scales including 1x, 1.25x, 1.5x, 1.75x, 2x, 2.25x, 2.75x, and 6.25x
  - 1x: Standard letter keys (A, S, D, etc.)
  - 1.25x: Commonly used for Shift, Ctrl, Alt, Windows keys, etc.
  - 1.5x: Used for Tab, Backslash, etc.
  - 1.75x: Used for Caps Lock, etc.
  - 2x: Commonly used for Backspace, etc.
  - 2.25x: Commonly used for Enter, Left Shift, etc.
  - 2.75x: Commonly used for Right Shift, etc.
  - 6.25x: Commonly used for Spacebar, etc.
- **Supports Arbitrary Dimensions**: Output will be fixed as upper and lower halves (unpressed/pressed)

### Basic Settings

- **Key Selection**: Choose the key to configure from the right-side key list
- **Text Override**: Customize the text or symbol displayed on the key, with automatic default symbols
- **Image Selection**: Choose the base image scale to use for the selected key

### Upper Font & Style (Unpressed State)

- **Font Selection**: Built-in fonts including Noto Sans TC, Segoe UI, Arial, Microsoft JhengHei, etc.
- **Import Font Files**: Support for importing custom font files in TTF, OTF, WOFF, WOFF2 formats (multi-select supported)
- **Font Size**: Set text size in pixels
- **Font Weight**: Three options: Regular, SemiBold, Bold
- **Text Color**: Customize text color
- **Stroke Settings**: Stroke width and color settings

### Lower Font & Style (Pressed State)

- **Independent Style Settings**: Can set completely different font styles for the pressed state compared to the unpressed state
- **Font Selection**: Supports built-in fonts and custom imported fonts
- **Font Size**: Independently set text size for the pressed state
- **Font Weight**: Independently set font weight for the pressed state
- **Text Color**: Default is golden yellow (#ffd54f), customizable
- **Stroke Settings**: Independently set stroke style for the pressed state

### Preview Function

- **Real-time Preview**: Right side displays the final two-part composite image of the currently configured key
- **Canvas Information**: Shows detailed information including image dimensions, key information, and the image scale being used

### Key List (Right Side)

- **Key Display**: Shows in "Key / Text" format (e.g., grave / ~)
- **Multi-selection**: Hold Ctrl key to select multiple keys for batch style configuration
- **Select All Button**: One-click selection of all keys for convenient batch configuration

### Export Function

- **Batch Export**: Output PNG images according to each key's configured scale and style
- **Direct Output**: Prioritizes using "Select Folder" function to output directly to specified folder
- **ZIP Download**: If browser doesn't support File System Access API, will automatically download ZIP archive
- **Smart Reminders**:
  - If no images are imported, will ask whether to export blank background images
  - If some images are missing, will list missing items and ask for handling method

### Language Support

- **Bilingual Interface**: Supports English (EN) and Traditional Chinese (中文) switching
- **Default Language**: Page loads with English interface by default

### Usage Workflow

1. **Import Base Images**: Select required scale images (recommended to start with 1x)
2. **Set Font Styles**: Adjust font settings for upper (unpressed) and lower (pressed) states
3. **Select Keys**: Choose keys to configure from the right-side list
4. **Preview Effects**: View final results in the right-side preview area
5. **Batch Configuration**: Use multi-selection to configure multiple keys at once
6. **Export Images**: Choose output folder or download ZIP file

### Important Notes

- Supports arbitrary dimensions for base images, output will automatically adjust to upper/lower half format
- If single image, lower half will apply independent font styles
- Font import supports multi-selection and automatically adds to font dropdown menus
- Export will automatically check image completeness and provide appropriate reminders
- Recommended to place exported images and JSON configuration files in the same folder
