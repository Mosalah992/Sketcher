# Sepia Sketcher

Turns any picture into a sepia pencil sketch on aged paper — the same filter the
Bruma Joint Archives uses for its wanted-poster portraits.

![Sepia Sketcher icon](resources/icons/appIcon.png)

## Download and set up

**Needs:** Windows 10 or 11 (64-bit). There is nothing to install: the app is one file.

### 1. Download

**[⬇ Download SepiaSketcher.exe](https://github.com/Mosalah992/Sketcher/raw/main/release/SepiaSketcher.exe)** (about 3 MB)

Or, on this page, open the **`release`** folder, click **`SepiaSketcher.exe`**,
then the **Download raw file** button (the ⬇ icon at the top right of the file view).

If your browser warns that the file "isn't commonly downloaded":

- **Edge:** hover over the download, click **⋯ → Keep**, then **Show more → Keep anyway**.
- **Chrome:** click **Keep** (or open the Downloads page and choose **Keep dangerous file**).

### 2. Put it somewhere permanent (optional)

The file lands in your **Downloads** folder. It runs from anywhere, but you may
want to move it, for example to `Documents\Sepia Sketcher\`. To get a desktop
shortcut, right-click `SepiaSketcher.exe` → **Show more options → Send to →
Desktop (create shortcut)**. To pin it, right-click → **Pin to Start** or
**Pin to taskbar**.

### 3. First run

Double-click `SepiaSketcher.exe`. Because the app is not code-signed, Windows
SmartScreen may show **"Windows protected your PC"**. Click **More info**, then
**Run anyway**. This only happens the first time.

If instead the window stays blank or a message mentions **WebView2**, your
Windows is missing Microsoft's WebView2 Runtime (it comes with up-to-date
Windows 10 and 11). Install the **Evergreen Bootstrapper** from
[Microsoft's WebView2 page](https://developer.microsoft.com/microsoft-edge/webview2/)
and open the app again.

### Updating and uninstalling

- **Update:** download the new `SepiaSketcher.exe` and replace the old one.
- **Uninstall:** delete `SepiaSketcher.exe` (and any shortcuts). To remove the
  little settings folder Windows' web view keeps, also delete
  `%APPDATA%\SepiaSketcher.exe` (paste that into the Explorer address bar).

## Using it

1. Drop pictures on the window, click **Choose pictures**, or paste one with **Ctrl+V**.
2. Pick the options:
   - **Frame** — *Wanted poster* crops to the archive's 10:11 portrait frame (faces kept high); *Whole picture* keeps the full image.
   - **Size** — *Standard* is 450 × 495, exactly as on the archive; *Large* and *Huge* are 2× and 3×.
   - **Save as** — PNG, JPEG or WebP.
3. Click a sketch to view it larger (and compare with the original), then **Save…**, or **Save all…** to a folder.

Everything happens on your computer; pictures are never uploaded.

## How the filter works

A colour-dodge pencil blend (the grey image divided by a blurred negative of
itself), with Sobel edges pressed in harder, inked in sepia on paper with grain,
fading out towards the margins. See [`resources/js/sketch.js`](resources/js/sketch.js).

## Building from source

Needs [Node.js](https://nodejs.org/) 20+ on Windows.

```
npm install
npm run build
```

This writes `release/SepiaSketcher.exe`. `npm run dev` runs the app without
building, and `npm run icons` redraws the icon from `scripts/`.

The app is a [Neutralinojs](https://neutralino.js.org/) window over the system's
WebView2, with its page embedded in the single exe.

## Licences

- Sepia Sketcher: MIT, see [LICENSE](LICENSE).
- Neutralinojs: MIT, see [licenses/Neutralinojs-LICENSE.txt](licenses/Neutralinojs-LICENSE.txt).
- Cinzel and EB Garamond fonts: SIL Open Font License, see [resources/fonts](resources/fonts).
