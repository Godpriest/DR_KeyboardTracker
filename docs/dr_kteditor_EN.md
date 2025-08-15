## DR Keyboard Tracker Editor – Sidebar Guide (English)

This editor lets you design a keyboard layout for the OBS plugin (DR_KeyboardTracker). The LEFT sidebar is where you configure almost everything. Below is a concise guide to each group and control on the left.

### Start
- **Import .json**: Load a previously exported project. Canvas size/theme and all keys will be restored.
- **Fix .json Images**: Choose the folder containing your key sprites. The editor remaps images by filename (e.g., `left_shift.png`). Use this after import if images show as missing.
- **Import Multiple Images**: Select many sprite sheets at once. The editor creates/updates keys from filenames. If a filename matches the recommended mapping, its key id and binding are auto-assigned.
- **Download Filename Mapping**: Downloads `key_filename_mapping.txt` with the recommended naming scheme for about 104 keys, including left_/right_ prefixes and symbol hints (e.g., `grave(~)`).
  - Includes mouse buttons and wheel entries too, so bulk import can auto-bind them by filename.
- **Key Size / Key Gap / Apply Layout (Standard Keyboard)**:
  - Positions keys based on the imported images and the provided size/gap.
  - Does NOT scale or deform keys. Only positions are set (Space/Backspace/Numpad etc. keep original size).
  - Default key gap is 0.

### Canvas Settings
- **Width (px) / Height (px) + Apply Canvas Size**: Set the canvas dimensions (e.g., 1920×1080).
- **Theme**: Switch between Bright and Dark.
- **Show key IDs on canvas**: Toggle id labels on each key while editing.

### Keys
- **Add Key (64x64)**: Inserts a blank key placeholder you can move and configure.

### Properties
- When single-selecting a key:
  - **ID**: Internal id used by the editor and object list.
  - **Key Binding**: Click Start Binding, then press one key. The editor prefers sided modifiers (e.g., Left Shift). If only generic modifiers (Shift/Ctrl/Alt) are detected, you’ll be warned that OBS may not recognize them. VK is derived automatically; certain keys also include `extended: true` in export (arrows, Insert/Delete/Home/End/PageUp/PageDown, Numpad Enter, Numpad Divide, and right Ctrl/Alt).
  - **Image Path**: Use a single sprite sheet per key: top half = default, bottom half = pressed. The key size comes from the image width and half the height (odd middle pixel ignored). The button shows a file picker; the filename is shown below when valid.
  - **Position X / Position Y**: Absolute position on the canvas. Guides appear at the selected key’s top-left.
  - **Delete This Key**: Removes the selected key.
- When multi-selecting keys:
  - The Properties panel shows only group fields.
  - **Position X / Position Y**: Move the whole selection by editing top-left of the bounding box.
  - **Align to X / Align to Y**: Align all selected keys to the group’s top-left X or Y.
  - **Horizontal space / Vertical space + Apply**: Arrange keys with a fixed spacing from min X (H) or min Y (V).
  - **Delete These Keys**: Deletes all selected keys.

### Export
- Bottom of the sidebar: **Export .json** downloads the configuration as `KeboardTracker.json`.
- Each key in JSON includes `id`, `keyBinding`, `vk`, optional `extended`, `sprite` (filename only), `x/y/w/h`, and `rotation`.

### Notes
- Pan with middle mouse, zoom with wheel, drag keys to move. Arrow keys nudge by 1px when a key or group is selected.
- Undo (Ctrl+Z) supports up to 100 steps. Drags commit on mouse up; manual X/Y inputs commit after 1s of inactivity.

### Mouse buttons and wheel support
- Bindable inputs: Left, Right, Middle, X1 (Back), X2 (Forward), Wheel Up/Down.
- When Start Binding is active, clicking a mouse button once or scrolling the wheel once will set the binding and then stop binding automatically.
- While binding, middle-button panning and wheel zoom are intercepted to avoid interference.

Mapping used in JSON export (vk):
- mouseleft: 0x01 (VK_LBUTTON)
- mouseright: 0x02 (VK_RBUTTON)
- mousemiddle: 0x04 (VK_MBUTTON)
- mousex1: 0x05 (VK_XBUTTON1)
- mousex2: 0x06 (VK_XBUTTON2)
- wheelup: 0x0A01 (custom code)
- wheeldown: 0x0A02 (custom code)

Note: Mouse and wheel inputs do not use the extended flag in exported JSON.



