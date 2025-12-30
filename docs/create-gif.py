#!/usr/bin/env python3
"""
Create animated GIF showing context management problem
Requires: Pillow (pip install Pillow)
"""

try:
    from PIL import Image, ImageDraw, ImageFont
    import os
except ImportError:
    print("❌ Pillow not installed. Install with: pip install Pillow")
    print("   Or use the HTML file: open docs/create-gif.html")
    exit(1)

def create_frame(step, tokens, strategy, status, is_with_cm=False):
    """Create a single frame of the animation"""
    width, height = 1200, 200
    img = Image.new('RGB', (width, height), color='#1e1e1e')
    draw = ImageDraw.Draw(img)

    # Try to use a monospace font
    try:
        font = ImageFont.truetype("/System/Library/Fonts/Menlo.ttc", 20)
        font_bold = ImageFont.truetype("/System/Library/Fonts/Menlo.ttc", 24)
    except:
        font = ImageFont.load_default()
        font_bold = ImageFont.load_default()

    # Title
    title = "✅ WITH Context Management" if is_with_cm else "❌ WITHOUT Context Management"
    title_color = "#4ec9b0" if is_with_cm else "#f48771"
    draw.text((20, 20), title, fill=title_color, font=font_bold)

    # Step info
    step_text = f"Step {step:2d} | Tokens: {tokens:>7,}"
    draw.text((20, 60), step_text, fill="#d4d4d4", font=font)

    # Strategy
    if strategy:
        strategy_text = f"Strategy: {strategy}"
        draw.text((20, 90), strategy_text, fill="#569cd6", font=font)

    # Status
    status_color = "#4ec9b0" if status == "OK" else "#f48771" if status == "FAILED" else "#dcdcaa"
    status_text = f"Status: {status}"
    draw.text((20, 120), status_text, fill=status_color, font=font)

    # Progress bar
    bar_width = 1100
    bar_height = 30
    bar_x, bar_y = 20, 150
    max_tokens = 100000

    # Draw background bar
    draw.rectangle([bar_x, bar_y, bar_x + bar_width, bar_y + bar_height], fill="#3e3e42")

    # Draw filled portion
    fill_width = min(int((tokens / max_tokens) * bar_width), bar_width)
    if tokens > 80000:
        fill_color = "#f48771"  # Red
    elif tokens > 50000:
        fill_color = "#dcdcaa"  # Yellow
    else:
        fill_color = "#4ec9b0"  # Green

    if fill_width > 0:
        draw.rectangle([bar_x, bar_y, bar_x + fill_width, bar_y + bar_height], fill=fill_color)

    # Token limit line
    limit_x = bar_x + int((80000 / max_tokens) * bar_width)
    draw.line([limit_x, bar_y - 5, limit_x, bar_y + bar_height + 5], fill="#ce9178", width=2)
    draw.text((limit_x + 5, bar_y + 5), "80k limit", fill="#ce9178", font=font)

    return img

def main():
    print("🎬 Creating animated GIF...")

    frames = []

    # Without CM - tokens grow unbounded
    tokens = 1000
    for step in range(1, 21):
        tokens += 1500 + (step * 100)  # Growing tokens
        status = "FAILED" if tokens > 100000 else "WARNING" if tokens > 80000 else "OK"
        frames.append(create_frame(step, tokens, None, status, False))
        if tokens > 100000:
            break

    # With CM - tokens controlled
    tokens = 1000
    for step in range(1, 21):
        tokens += 1500 + (step * 100)
        strategy = None

        if tokens > 60000 and step >= 5:
            tokens = int(tokens * 0.85)
            strategy = "💾 OFFLOAD"
        elif tokens > 50000 and step % 5 == 0:
            tokens = int(tokens * 0.75)
            strategy = "📝 SUMMARIZE"
        elif tokens > 40000 and step >= 3:
            tokens = int(tokens * 0.60)
            strategy = "📦 COMPACT"
        elif tokens > 30000:
            tokens = int(tokens * 0.75)
            strategy = "🔍 FILTER"

        status = "FAILED" if tokens > 100000 else "WARNING" if tokens > 80000 else "OK"
        frames.append(create_frame(step, tokens, strategy, status, True))

    # Save as GIF
    output_path = os.path.join(os.path.dirname(__file__), 'context-problem-demo.gif')
    frames[0].save(
        output_path,
        save_all=True,
        append_images=frames[1:],
        duration=300,  # 300ms per frame
        loop=0
    )

    print(f"✅ GIF created: {output_path}")
    print(f"   {len(frames)} frames, {len(frames) * 0.3:.1f}s total")

if __name__ == "__main__":
    main()

