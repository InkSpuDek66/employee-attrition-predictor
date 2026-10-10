"""สร้าง logo.svg (favicon) + Logo.jsx (โลโก้ในเว็บ เปลี่ยนสีตามโหมด) จากภาพต้นฉบับ logo-source.png

รัน (จากโฟลเดอร์นี้): python vectorize_logo.py logo-source.png .
- ชิ้นรูปทรงอิสระ (คน, คนเดิน, เส้นโค้ง, ลูกศร) ลอกขอบจากสีในภาพ แล้วลดจุด + ทำเส้นโค้งให้เรียบ
- ชิ้นเรขาคณิต (ตัว HR, ประตู, กราฟแท่ง) วาดจากพิกัดที่วัดจากภาพ ใน GEOM ด้านล่าง เพื่อให้ขอบเรียบ
- สีแต่ละชิ้นดูดจากภาพเป็น gradient, สีที่เปลี่ยนตามโหมดอยู่ใน ROLE / ตัวแปร --logo-* ใน src/index.css
ใช้ numpy, scipy, contourpy, matplotlib, pillow ที่มีใน .venv อยู่แล้ว
"""
import sys

import contourpy
import numpy as np
from PIL import Image
from scipy import ndimage

SRC, OUT = sys.argv[1], sys.argv[2]
im = np.asarray(Image.open(SRC).convert('RGBA')).astype(int)
R, G, B, A = (im[..., i] for i in range(4))
blue = (B - R > 60) & (A > 200)
navy = blue & (B < 215) & (R < 70)
light = blue & ~navy


def components(mask, min_px=2000):
    lab, n = ndimage.label(mask)
    out = []
    for i, sl in enumerate(ndimage.find_objects(lab)):
        m = lab == i + 1
        if m.sum() >= min_px:
            out.append(m)
    return out


def bbox(m):
    ys, xs = np.nonzero(m)
    return xs.min(), xs.max(), ys.min(), ys.max()


def rdp(pts, eps):
    if len(pts) < 3:
        return pts
    a, b = pts[0], pts[-1]
    ab = b - a
    n = np.hypot(*ab) or 1e-9
    w = pts - a
    d = np.abs(ab[0] * w[:, 1] - ab[1] * w[:, 0]) / n
    i = int(np.argmax(d))
    if d[i] > eps:
        return np.vstack([rdp(pts[: i + 1], eps)[:-1], rdp(pts[i:], eps)])
    return np.vstack([a, b])


def simplify_closed(xy, eps):
    """RDP for a closed ring: split at the point farthest from the start so both halves are open polylines"""
    if np.allclose(xy[0], xy[-1]):
        xy = xy[:-1]
    i = int(np.argmax(np.hypot(*(xy - xy[0]).T)))
    a = rdp(xy[: i + 1], eps)
    b = rdp(np.vstack([xy[i:], xy[:1]]), eps)
    return np.vstack([a[:-1], b])


def smooth_path(pts):
    """closed polygon -> smooth cubic Bézier (Catmull-Rom, tension 0.5), corners kept sharp when the turn is tight"""
    pts = pts[:-1] if np.allclose(pts[0], pts[-1]) else pts
    n = len(pts)
    f = lambda p: f"{p[0]:.0f} {p[1]:.0f}"
    d = [f"M{f(pts[0])}"]
    for i in range(n):
        p0, p1, p2, p3 = pts[i - 1], pts[i], pts[(i + 1) % n], pts[(i + 2) % n]
        v1, v2 = p1 - p0, p2 - p1
        v3 = p3 - p2
        ang1 = np.degrees(np.arccos(np.clip(np.dot(v1, v2) / ((np.hypot(*v1) * np.hypot(*v2)) or 1), -1, 1)))
        ang2 = np.degrees(np.arccos(np.clip(np.dot(v2, v3) / ((np.hypot(*v2) * np.hypot(*v3)) or 1), -1, 1)))
        c1 = p1 + (p2 - p0) / 6 if ang1 < 50 else p1 + v2 / 3
        c2 = p2 - (p3 - p1) / 6 if ang2 < 50 else p2 - v2 / 3
        d.append(f"C{f(c1)} {f(c2)} {f(p2)}")
    return ''.join(d) + 'Z'


def contours(m, eps=2.6, sigma=2.6):
    """outer + inner contours of a mask, simplified; returns list of (path, area)
    เปิด/ปิด mask แล้วเบลอก่อนหาเส้นขอบ ตัดรอยหยักจากขอบเรืองแสงของภาพต้นฉบับ"""
    m = ndimage.binary_closing(ndimage.binary_opening(m, iterations=2), iterations=2)
    z = ndimage.gaussian_filter(m.astype(float), sigma)
    lines = contourpy.contour_generator(z=z).lines(0.5)
    res = []
    for ln in lines:
        if len(ln) < 8:
            continue
        xy = np.asarray(ln)  # (x=col, y=row)
        area = 0.5 * np.sum(xy[:-1, 0] * xy[1:, 1] - xy[1:, 0] * xy[:-1, 1])
        if abs(area) < 150:
            continue
        res.append((smooth_path(simplify_closed(xy, eps)), abs(area)))
    res.sort(key=lambda t: -t[1])
    return res


def grad(m, axis):
    """colour at the start/end of the shape along an axis (0 = top->bottom, 1 = left->right)"""
    ys, xs = np.nonzero(m)
    key = ys if axis == 0 else xs
    lo, hi = np.percentile(key, [12, 88])
    c = lambda sel: '#%02x%02x%02x' % tuple(int(v) for v in im[ys[sel], xs[sel], :3].mean(0))
    return c(key <= lo), c(key >= hi)


navy_parts = components(navy)
light_parts = components(light)
by_x = lambda parts: sorted(parts, key=lambda m: bbox(m)[0])

# navy: door (largest), H, R, walker body, walker head
navy_parts.sort(key=lambda m: -m.sum())
door, *rest = navy_parts
letters = by_x([m for m in rest if bbox(m)[3] < 600])
H, Rr = letters[:2]
walker = [m for m in rest if bbox(m)[2] >= 700]
walker_body = max(walker, key=lambda m: m.sum())
walker_head = min(walker, key=lambda m: m.sum())

# light: person body, swoosh, person head, 3 bars, arrow, exit arrow
light_parts.sort(key=lambda m: -m.sum())
by_bbox = {}
for m in light_parts:
    x0, x1, y0, y1 = bbox(m)
    if x0 < 250 and y1 > 1000:
        by_bbox['swoosh'] = m
    elif 280 < x0 < 320 and y0 > 800:
        by_bbox['body'] = m
    elif 340 < x0 < 380 and y0 < 620:
        by_bbox['head'] = m
    elif y1 < 480 and x1 > 950:
        by_bbox['arrow'] = m
    elif 900 < x0 < 960 and y0 > 800:
        by_bbox['exit'] = m
    elif y0 > 380 and y1 < 600 and x0 > 700:
        by_bbox.setdefault('bars', []).append(m)
bars = by_x(by_bbox['bars'])

# darker facet on the right of the person's body
body = by_bbox['body']
facet = body & (R < 80) & ndimage.binary_erosion(body, iterations=2)
facet = max(components(facet, 500), key=lambda m: m.sum()) if components(facet, 500) else None

parts = []  # (name, paths, fill_kind, gradient or colour)


def add(name, m, axis=0, evenodd=False, eps=2.6, sigma=2.6):
    cs = contours(m, eps, sigma)
    a, b = grad(m, axis)
    parts.append(dict(name=name, d=' '.join(p for p, _ in cs) if evenodd else cs[0][0], inner=[p for p, _ in cs[1:]], evenodd=evenodd, g=(a, b), axis=axis))


add('swoosh', by_bbox['swoosh'], axis=1)
add('body', body)
add('head', by_bbox['head'])
for i, m in enumerate(bars):
    add(f'bar{i}', m)
add('arrow', by_bbox['arrow'], axis=1)
add('H', H, evenodd=True, eps=3, sigma=3)
add('R', Rr, evenodd=True, eps=3, sigma=3)
add('door', door, eps=3.5, sigma=3.5)
add('exit', by_bbox['exit'])
add('walker_body', walker_body, eps=1.8, sigma=1.8)
add('walker_head', walker_head, eps=1.5, sigma=2)

# door opening (light panel): inside the door's convex hull but not door/exit-arrow pixels
from matplotlib.path import Path as MPath
from scipy.spatial import ConvexHull

ys, xs = np.nonzero(door)
pts = np.c_[xs, ys]
hull = MPath(pts[ConvexHull(pts).vertices])
yy, xx = np.mgrid[0:door.shape[0], 0:door.shape[1]]
inside = hull.contains_points(np.c_[xx.ravel(), yy.ravel()]).reshape(door.shape)
opening = inside & ~ndimage.binary_dilation(door | by_bbox['exit'], iterations=3)
opening = max(components(opening, 5000), key=lambda m: m.sum())
door_inner = contours(ndimage.binary_dilation(opening, iterations=4))[0][0]  # tuck under the frame edge

GEOM = {
    # H / R: ขนาดวัดจากภาพ หดเข้า 6px แล้วเติมเส้นขอบหนา 12 ให้มุมมน
    'H': 'M227 320H276V544H227ZM371 320H430V544H371ZM227 414H430V456H227Z',
    'R': 'M473 319H522V543H473ZM473 319H583A77 77 0 0 1 583 473H473ZM522 358V427H575.5A34.5 34.5 0 0 0 575.5 358ZM560 476H619L654 543H604Z',
    'door': 'M706 697L982 609Q1024 597 1024 630V842L1068 876L1024 910V1096Q1024 1110 1010 1110L944 1101Q932 1099 932 1088V677L741 708V958L706 967Z',
    'bar0': 'M724 494H784Q796 494 796 506V577Q796 589 784 589H724Q712 589 712 577V506Q712 494 724 494Z',
    'bar1': 'M828 450H885Q897 450 897 462V577Q897 589 885 589H828Q816 589 816 577V462Q816 450 828 450Z',
    'bar2': 'M928 392H984Q996 392 996 404V570Q996 582 984 582H928Q916 582 916 570V404Q916 392 928 392Z',
}
STROKED = {'H', 'R', 'door'}
for p in parts:
    if p['name'] in GEOM:
        p['d'], p['evenodd'] = GEOM[p['name']], False  # R: ช่องในตัว R วนทวนเข็ม = เป็นรูด้วย nonzero
door_inner = 'M746 703L927 672V1104H746Z'
# เงาเฉียงด้านขวาของตัวคน (ตัดให้อยู่ในตัวคนด้วย clipPath)
FACET = 'M552 828C522 868 498 930 482 1000H650V820Z'
body_d = parts[[p['name'] for p in parts].index('body')]['d']  # ช่องประตูสีอ่อน วาดก่อนกรอบประตู ให้กรอบทับขอบ

VIEWBOX = '37 52 1180 1180'
TILE = dict(x=77, y=92, w=1100, h=1100, rx=240)

# themable roles (Logo.jsx reads --logo-* vars); everything else keeps its sampled gradient
ROLE = {'H': 'ink', 'R': 'ink', 'walker_body': 'walker', 'walker_head': 'walker', 'exit': 'exit', 'arrow': 'arrow'}
LIGHT_ROLE = {'ink': '#1b4f9c', 'walker': '#1d58b0', 'exit': '#a3cdf8', 'arrow': '#3a86e3'}


def svg_file():
    defs, body = [], []
    for p in parts:
        if p['name'] in ROLE:
            fill = LIGHT_ROLE[ROLE[p['name']]]
        else:
            a, b = p['g']
            x2, y2 = ('1', '0') if p['axis'] == 1 else ('0', '1')
            stop_b = f'<stop offset="1" stop-color="{b}" stop-opacity="0"/>' if p['name'] == 'swoosh' else f'<stop offset="1" stop-color="{b}"/>'
            defs.append(f'<linearGradient id="g-{p["name"]}" x1="0" y1="0" x2="{x2}" y2="{y2}"><stop offset="0" stop-color="{a}"/>{stop_b}</linearGradient>')
            fill = f'url(#g-{p["name"]})'
        rule = ' fill-rule="evenodd"' if p['evenodd'] else ''
        stroke = f' stroke="{fill}" stroke-width="{10 if p["name"] == "door" else 12}" stroke-linejoin="round"' if p['name'] in STROKED else ''
        if p['name'] == 'door':
            body.append(f'<path d="{door_inner}" fill="#f3f7fd"/>')
        body.append(f'<path d="{p["d"]}" fill="{fill}"{rule}{stroke}/>')
        if p['name'] == 'body':
            defs.append(f'<clipPath id="body-clip"><path d="{body_d}"/></clipPath>')
            body.append(f'<path d="{FACET}" fill="#3f8ae6" opacity="0.35" clip-path="url(#body-clip)"/>')
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{VIEWBOX}" role="img" aria-label="Attrition Predictor">'
        '<title>Attrition Predictor</title>'
        f'<defs>{"".join(defs)}<filter id="glow" x="-10%" y="-10%" width="120%" height="120%">'
        '<feDropShadow dx="0" dy="0" stdDeviation="22" flood-color="#a9d1fb" flood-opacity="0.9"/></filter></defs>'
        f'<rect x="{TILE["x"]}" y="{TILE["y"]}" width="{TILE["w"]}" height="{TILE["h"]}" rx="{TILE["rx"]}" fill="#ffffff" filter="url(#glow)"/>'
        + ''.join(body) + '</svg>\n'
    )


def jsx_file():
    defs, body = [], []
    for p in parts:
        n = p['name']
        if n in ROLE:
            style = f"{{{{ fill: v('{ROLE[n]}') }}}}"
            fill_attr = f'style={style}'
        elif n == 'door':
            defs.append(
                "        <linearGradient id={`${id}door`} x1=\"0\" y1=\"0\" x2=\"0\" y2=\"1\">\n"
                "          <stop offset=\"0\" style={{ stopColor: v('door-a') }} />\n"
                "          <stop offset=\"1\" style={{ stopColor: v('door-b') }} />\n"
                "        </linearGradient>"
            )
            fill_attr = "fill={`url(#${id}door)`}"
        else:
            a, b = p['g']
            x2, y2 = ('1', '0') if p['axis'] == 1 else ('0', '1')
            op = ' stopOpacity="0"' if n == 'swoosh' else ''
            defs.append(
                f"        <linearGradient id={{`${{id}}{n}`}} x1=\"0\" y1=\"0\" x2=\"{x2}\" y2=\"{y2}\">\n"
                f"          <stop offset=\"0\" stopColor=\"{a}\" />\n"
                f"          <stop offset=\"1\" stopColor=\"{b}\"{op} />\n"
                "        </linearGradient>"
            )
            fill_attr = f"fill={{`url(#${{id}}{n})`}}"
        rule = ' fillRule="evenodd"' if p['evenodd'] else ''
        if n in STROKED:
            paint = f"`url(#${{id}}door)`" if n == 'door' else f"v('{ROLE[n]}')"
            fill_attr = f"style={{{{ fill: {paint}, stroke: {paint} }}}}" if n != 'door' else f"fill={{{paint}}} stroke={{{paint}}}"
            rule += f' strokeWidth="{10 if n == "door" else 12}" strokeLinejoin="round"'
        if n == 'door':
            body.append(f"      <path d=\"{door_inner}\" style={{{{ fill: v('door-inner') }}}} />")
        body.append(f'      <path d="{p["d"]}" {fill_attr}{rule} />')
        if n == 'body':
            defs.append(f'        <clipPath id={{`${{id}}bodyclip`}}>\n          <path d="{body_d}" />\n        </clipPath>')
            body.append(f'      <path d="{FACET}" fill="#3f8ae6" opacity="0.35" clipPath={{`url(#${{id}}bodyclip)`}} />')
    return f'''// โลโก้ที่เปลี่ยนสีตามโหมดมืด/สว่าง (สีมาจากตัวแปร --logo-* ใน src/index.css)
// รูปทรงลอกจากไฟล์ภาพต้นฉบับด้วยสคริปต์ (vectorize) ไฟล์ logo.svg สร้างจากข้อมูลชุดเดียวกัน ใช้เป็น favicon
// แก้รูปทรง: แก้ภาพต้นฉบับแล้วสร้างทั้งสองไฟล์ใหม่ อย่าแก้ path ด้วยมือ
import {{ useId }} from 'react'

const v = (name) => `var(--logo-${{name}})`

export default function Logo({{ className = '' }}) {{
  const id = useId() // id ของ gradient ไม่ชนกันถ้ามีโลโก้หลายอันในหน้า
  return (
    <svg viewBox="{VIEWBOX}" className={{className}} aria-hidden="true">
      <defs>
{chr(10).join(defs)}
        <filter id={{`${{id}}glow`}} x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="0" stdDeviation="22" style={{{{ floodColor: v('glow') }}}} floodOpacity="0.9" />
        </filter>
      </defs>
      <rect x="{TILE['x']}" y="{TILE['y']}" width="{TILE['w']}" height="{TILE['h']}" rx="{TILE['rx']}" style={{{{ fill: v('tile') }}}} filter={{`url(#${{id}}glow)`}} />
{chr(10).join(body)}
    </svg>
  )
}}
'''


open(f'{OUT}/logo.svg', 'w', encoding='utf-8').write(svg_file())
open(f'{OUT}/Logo.jsx', 'w', encoding='utf-8').write(jsx_file())
print('parts:', [p['name'] for p in parts], '| door gradient', parts[[p['name'] for p in parts].index('door')]['g'])
