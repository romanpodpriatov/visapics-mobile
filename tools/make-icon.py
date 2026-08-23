"""Draw the VisaPics app icon.

One idea, legible at 40px: a passport photo. A white card in the document's
own 35:45 proportion, a head framed inside it the way the app frames one, and
the crop marks the product uses everywhere as its mark of compliance.

Rendered at 4x and downsampled, because Pillow has no anti-aliasing of its own.
"""
from PIL import Image, ImageDraw

S = 4  # supersample
SIZE = 1024 * S

BRAND = (30, 58, 138)        # #1E3A8A
BRAND_DEEP = (23, 45, 110)
PAPER = (250, 250, 245)      # #FAFAF5
INK = (11, 17, 32)           # #0B1120 — reads against the blue, which the brand blue did not
ACCENT = (194, 65, 12)       # #C2410C


def card_geometry(canvas, height_share):
    """The photo card: the document's own 35:45 proportion, centred."""
    h = int(canvas * height_share)
    w = int(h * 35 / 45)
    x = (canvas - w) // 2
    y = (canvas - h) // 2
    return x, y, w, h


def draw_portrait(d, x, y, w, h):
    """A head and shoulders, framed as a passport photo frames them."""
    # Head: centred, occupying the upper half, the way the guide asks for.
    head_d = int(h * 0.42)
    head_x = x + (w - head_d) // 2
    head_y = y + int(h * 0.15)
    d.ellipse([head_x, head_y, head_x + head_d, head_y + head_d], fill=INK)

    # Shoulders: a wide arc rising from the bottom edge, clipped by the card.
    sh_w = int(w * 1.30)
    sh_h = int(h * 0.40)
    sh_x = x + (w - sh_w) // 2
    sh_y = y + h - int(sh_h * 0.55)
    d.ellipse([sh_x, sh_y, sh_x + sh_w, sh_y + sh_h], fill=INK)


def draw_head_mark(d, x, y, w, h):
    """The head-height bar the capture guide draws, in miniature.

    It is what separates this from a contact avatar: the photograph is
    measured against a document, and the icon says so.
    """
    top = y + int(h * 0.15)
    bottom = y + int(h * 0.15) + int(h * 0.42)
    bar_x = x + int(w * 0.115)
    weight = max(1, int(w * 0.022))
    arm = int(w * 0.085)
    d.rectangle([bar_x, top, bar_x + weight, bottom], fill=ACCENT)
    d.rectangle([bar_x - arm // 2, top, bar_x + arm, top + weight], fill=ACCENT)
    d.rectangle([bar_x - arm // 2, bottom - weight, bar_x + arm, bottom], fill=ACCENT)


def draw_crop_marks(d, x, y, w, h, gap, arm, weight):
    """Two registration brackets, the product's own mark of framing."""
    # Top-left
    d.rectangle([x - gap - weight, y - gap - weight, x - gap, y - gap + arm], fill=ACCENT)
    d.rectangle([x - gap - weight, y - gap - weight, x - gap + arm, y - gap], fill=ACCENT)
    # Bottom-right
    d.rectangle([x + w + gap, y + h + gap - arm, x + w + gap + weight, y + h + gap + weight], fill=ACCENT)
    d.rectangle([x + w + gap - arm, y + h + gap, x + w + gap + weight, y + h + gap + weight], fill=ACCENT)


def compose(canvas, height_share, background, marks=True, mono=False):
    img = Image.new('RGBA', (canvas, canvas), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    if background:
        # A quiet vertical gradient: flat blue looks dead at large sizes.
        for row in range(canvas):
            t = row / canvas
            d.line(
                [(0, row), (canvas, row)],
                fill=tuple(
                    int(BRAND[i] + (BRAND_DEEP[i] - BRAND[i]) * t) for i in range(3)
                ) + (255,),
            )

    x, y, w, h = card_geometry(canvas, height_share)
    radius = int(w * 0.055)

    paper = (255, 255, 255, 255) if mono else PAPER + (255,)
    ink = (255, 255, 255, 255) if mono else INK + (255,)

    if mono:
        # Themed icons are one colour on transparency: the card is the shape,
        # and the head is knocked out of it.
        d.rounded_rectangle([x, y, x + w, y + h], radius=radius, fill=paper)
        cut = Image.new('RGBA', (canvas, canvas), (0, 0, 0, 0))
        ImageDraw.Draw(cut).rounded_rectangle([x, y, x + w, y + h], radius=radius, fill=(0, 0, 0, 0))
        knock = Image.new('RGBA', (canvas, canvas), (0, 0, 0, 0))
        draw_portrait(ImageDraw.Draw(knock), x, y, w, h)
        img.paste((0, 0, 0, 0), (0, 0), knock)
        return img

    d.rounded_rectangle([x, y, x + w, y + h], radius=radius, fill=paper)

    portrait = Image.new('RGBA', (canvas, canvas), (0, 0, 0, 0))
    draw_portrait(ImageDraw.Draw(portrait), x, y, w, h)
    mask = Image.new('L', (canvas, canvas), 0)
    ImageDraw.Draw(mask).rounded_rectangle([x, y, x + w, y + h], radius=radius, fill=255)
    img.paste(Image.new('RGBA', (canvas, canvas), ink), (0, 0),
              Image.composite(portrait.split()[3], Image.new('L', (canvas, canvas), 0), mask))

    if marks:
        draw_head_mark(d, x, y, w, h)
        draw_crop_marks(d, x, y, w, h, gap=int(w * 0.10), arm=int(w * 0.24), weight=int(w * 0.045))

    return img


def save(img, path, size, opaque_on=None):
    out = img.resize((size, size), Image.LANCZOS)
    if opaque_on:
        flat = Image.new('RGB', (size, size), opaque_on)
        flat.paste(out, (0, 0), out)
        out = flat
    out.save(path)
    print(path, out.size, out.mode)


BASE = '/opt/visapics-mobile/assets/'

# iOS and the store: square, opaque, no alpha — Apple applies its own mask.
save(compose(SIZE, 0.60, background=True), BASE + 'icon.png', 1024, opaque_on=BRAND)

# Android adaptive: the art lives inside the safe zone, on its own layer.
save(compose(SIZE, 0.60 * 0.80, background=False), BASE + 'android-icon-foreground.png', 1024)
save(compose(SIZE, 0.0, background=True), BASE + 'android-icon-background.png', 1024, opaque_on=BRAND)
save(compose(SIZE, 0.60 * 0.80, background=False, marks=False, mono=True),
     BASE + 'android-icon-monochrome.png', 1024)

# Web.
save(compose(SIZE, 0.60, background=True), BASE + 'favicon.png', 48, opaque_on=BRAND)
