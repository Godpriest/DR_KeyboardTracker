## DR Keyboard Tracker Editor – Left Panel Description (English)

This editor is used to design keyboard layouts for the OBS plugin (DR_KeyboardTracker). The left panel contains most of the settings. Below is a description of the purpose of each group and control item on the left side.

### Getting Started
- **Import .json**: Load previously exported projects. This will restore canvas dimensions/theme and all keys.
- **Complete .json Images**: Select a folder containing key images, and the editor will match images based on filenames (e.g., `left_shift.png`). If images are missing after import, use this function to complete them.
- **Import Multiple Images**: Select multiple sprite images at once. The editor will create/update keys based on filenames; if filenames match suggested mappings, it will automatically set key IDs and bindings.
- **Download Filename Mapping**: Download `key_filename_mapping.txt`, which lists suggested names for approximately 104 keys (including left_/right_ prefixes and punctuation hints, e.g., `grave(~)`).
  - Also includes mouse buttons and scroll wheel items for convenient automatic binding when importing in bulk.
- **Key Size / Key Spacing / Apply (Standard Keyboard)**:
  - Arrange imported key images to standard keyboard positions based on input size and spacing.
  - Does not scale or distort keys, only sets coordinates (Space/Backspace/Numpad, etc. maintain original dimensions).
  - Default key spacing is 0.

### Canvas Settings
- **Width (px) / Height (px) + Apply Canvas Size**: Set canvas dimensions (e.g., 1920×1080), which affects the canvas size displayed in OBS.
- **Theme**: Toggle between light/dark themes, you know, if needed...
- **Show Key IDs on Canvas**: Toggle whether to display IDs on each key during editing.

### Keys
- **Add Key (64x64)**: Insert a blank key that can later be dragged, moved, and configured.

### Properties
- When selecting a single key:
  - **ID**: Internal identifier used by the editor and object list.
  - **Key Binding**: After clicking "Start Binding", press a physical key once. The editor will prioritize left/right-specific modifier keys (e.g., Left Shift). If only generic modifier keys (Shift/Ctrl/Alt) are detected, a warning will appear as OBS may not be able to identify them.
  - **Image Path**: Each key uses a single sprite image: upper half for unpressed, lower half for pressed. Key dimensions are taken from the image width and half height (if height is odd, the middle 1px is ignored). Click the button to select a file; if valid, the filename will be displayed below.
  - **Position X / Position Y**: Absolute position on the canvas. Alignment guides are displayed when selected.
  - **Delete This Key**: Delete the current key.
- When selecting multiple keys:
  - The properties panel only displays group-related fields.
  - **Position X / Position Y**: Input the top-left corner of the group bounding box to move all keys at once.
  - **Align to X / Align to Y**: Align all selected keys to the X or Y of the group's top-left corner.
  - **Horizontal Spacing / Vertical Spacing + Apply**: Arrange from the minimum X (horizontal) or minimum Y (vertical) with fixed spacing.
  - **Delete These Keys**: Delete all selected keys at once.

### Export
- **Export .json** at the bottom left will download as `KeboardTracker.json`.
- Each key in the JSON contains `id`, `keyBinding`, `vk`, (if necessary) `extended`, `sprite` (filename only), `x/y/w/h`, and `rotation`.
- **Please place the .json file and images in the same folder for easy reading by the OBS plugin**.

### Notes
- Middle mouse button drag for panning, scroll wheel for zooming, drag keys to move; use arrow keys for 1px fine-tuning when selected.
- Undo (Ctrl+Z) supports up to 100 steps. Dragging records one step when released; manual X/Y input records one step after stopping for 1 second.
