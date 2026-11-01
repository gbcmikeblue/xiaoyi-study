"""统计 APK 体积构成。"""
import os
import zipfile

APK = "android/app/build/outputs/apk/debug/app-debug.apk"
z = zipfile.ZipFile(APK)
info = z.infolist()


def part(pred):
    sel = [i for i in info if pred(i.filename)]
    return len(sel), sum(i.file_size for i in sel), sum(i.compress_size for i in sel)


groups = [
    ("flac 音频", lambda n: n.endswith(".flac")),
    ("webp 插图", lambda n: n.endswith(".webp")),
    ("js/css/html", lambda n: n.endswith((".js", ".css", ".html"))),
    ("内容 json", lambda n: n.endswith(".json") and "content" in n),
    ("dex/so/arsc", lambda n: n.endswith((".dex", ".so", ".arsc"))),
]

print("类别          个数    原始MB   压缩后MB")
for name, pred in groups:
    c, raw, comp = part(pred)
    print(f"{name:<12} {c:>6} {raw / 1048576:>9.1f} {comp / 1048576:>10.1f}")

c, raw, comp = part(lambda n: True)
print(f"{'合计':<12} {c:>6} {raw / 1048576:>9.1f} {comp / 1048576:>10.1f}")
print(f"{'APK 文件':<12} {'':>6} {'':>9} {os.path.getsize(APK) / 1048576:>10.1f}")
