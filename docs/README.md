# Documentation Assets

## Creating the Context Problem Demo GIF

### Option 1: Record HTML Animation (Recommended)

1. Open `docs/create-gif.html` in your browser
2. Use screen recording software (macOS: Cmd+Shift+5, Windows: Win+G, Linux: SimpleScreenRecorder)
3. Record the animation as it plays
4. Convert video to GIF using:
   - Online: https://ezgif.com/video-to-gif
   - CLI: `ffmpeg -i input.mp4 -vf "fps=10,scale=1200:-1" context-problem-demo.gif`
5. Save as `context-problem-demo.gif` in this directory

### Option 2: Use Terminal Recording

1. Run: `bun run packages/context-manager/scripts/visualize-context-problem.ts`
2. Record terminal output using:
   - `asciinema rec demo.cast` (then convert to GIF)
   - `terminalizer record demo` (then convert to GIF)
3. Save as `context-problem-demo.gif`

### Option 3: Use Python Script (Recommended for regeneration)

1. Install Pillow: `pip3 install Pillow`
2. Run: `python3 docs/create-gif.py`
3. This creates the GIF directly: `docs/context-problem-demo.gif`
