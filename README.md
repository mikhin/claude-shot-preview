# Claude Shot Preview

A Claude Code mod for the reply that says `Screenshot: /var/folders/…/screenshot-1791286907506-0.jpg` and leaves you to go find the file. It draws a thumbnail of that image right under the reply, with **↗ open** to see it full size.

## Install

Inside Claude Code, run:

```
/plugin marketplace add mikhin/claude-shot-preview
/plugin install shot-preview
/reload-plugins
```

## Requirements

- A terminal that draws images through the kitty graphics protocol: Ghostty, kitty, WezTerm. Elsewhere the thumbnail is drawn as its path, and **↗ open** still works.
- macOS for JPEG thumbnails. The terminal draws PNG only, and the mod turns a JPEG into PNG with `sips`, which only macOS has. On Linux and Windows a PNG gets a thumbnail and a JPEG gets only **↗ open**.
- **↗ open** is pressed with a click, which Claude Code reports in fullscreen mode.

## What you see

```
● Screenshot: /var/folders/…/screenshot-1791286907506-0.jpg

  (thumbnail)
  ↗ open
```

- The thumbnail is at most 36 columns by 10 rows and keeps the image's proportions.
- A reply that names several images gets a thumbnail for each, side by side.
- **↗ open** opens the file in the system's default viewer.

## How it works

1. A `session.append` hook reads each reply of the main conversation as it is stored and finds paths ending in `.png`, `.jpg` or `.jpeg`: absolute, `~/`-relative or `C:\`-style. A path in backticks is taken whole, so `` `~/Scans/passport (1).jpg` `` works; a bare one ends at the first space.
2. For each path that exists, it makes a preview: a PNG is used as is; a JPEG is turned into an 800 px PNG in `$TMPDIR/claude-shots/`, named by a hash of its path and modification time (macOS).
3. A `ui.render` hook on the reply draws the reply as Claude Code does, then the thumbnails under it with Claude Code's `Image` element.

Only replies written in the current session get a thumbnail: the mod remembers previews for the session alone, so a resumed conversation shows its old paths as text. Subagent replies are skipped.

## What it runs and sends

The mod runs when Claude Code stores a reply and when you press **↗ open**.

- **Programs it starts**, all on your machine:
  - `uname`, once, to tell macOS from Linux
  - `mkdir -p $TMPDIR/claude-shots` makes the folder previews go to (macOS)
  - `sips -s format png -Z 800 <image> --out <preview>.png` turns a JPEG into a PNG preview (macOS)
  - `sips -g pixelWidth -g pixelHeight <preview>.png` reads the preview's size (macOS)
  - on **↗ open**: `open <image>` on macOS, `xdg-open <image>` on Linux, `cmd /c start "" <image>` on Windows
- **Files it reads and writes:** it reads the `OS`, `TMPDIR`, `HOME` and `USERPROFILE` environment variables, checks that each path named in a reply exists and reads its modification time, and writes `<hash>.png` previews to `$TMPDIR/claude-shots/`. It never deletes them; macOS clears that folder.
- **What it changes in your messages:** nothing. It adds thumbnails to how a reply is drawn; what Claude and you sent is stored unchanged.
- **What it sends over the network:** nothing. The mod opens no connections.

## License

MIT
