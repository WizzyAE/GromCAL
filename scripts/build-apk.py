"""Replace only GromCAL's web assets, then align and sign an Android APK.

The base APK and signing keystore are local inputs and must never be committed.
"""
from pathlib import Path
import argparse
import os
import re
import struct
import subprocess
import zipfile

ROOT = Path(__file__).resolve().parent.parent


def update_manifest(raw):
    data = bytearray(raw)
    strings = []
    locations = []
    offset = struct.unpack_from('<H', data, 2)[0]
    changed = set()
    while offset < len(data):
        kind, header, size = struct.unpack_from('<HHI', data, offset)
        if not size:
            raise ValueError('Invalid Android manifest chunk')
        if kind == 1:
            count, _, flags, start, _ = struct.unpack_from('<IIIII', data, offset + 8)
            for i in range(count):
                at = offset + start + struct.unpack_from('<I', data, offset + header + i * 4)[0]
                if flags & 0x100:
                    # Two length prefixes: UTF-16 characters, then UTF-8 bytes.
                    def length(pos):
                        value = data[pos]
                        return (((value & 0x7f) << 8) | data[pos + 1], pos + 2) if value & 0x80 else (value, pos + 1)
                    _, pos = length(at)
                    n, pos = length(pos)
                    strings.append(bytes(data[pos:pos + n]).decode('utf-8'))
                    locations.append((pos, n, 'utf-8'))
                else:
                    n = struct.unpack_from('<H', data, at)[0]
                    if n & 0x8000:
                        raise ValueError('Unexpected long manifest string')
                    strings.append(bytes(data[at + 2:at + 2 + n * 2]).decode('utf-16-le'))
                    locations.append((at + 2, n * 2, 'utf-16-le'))
        elif kind == 0x102:
            attr_start, attr_size, attr_count = struct.unpack_from('<HHH', data, offset + 24)
            for i in range(attr_count):
                at = offset + 16 + attr_start + i * attr_size
                name = strings[struct.unpack_from('<I', data, at + 4)[0]]
                if name == 'versionCode':
                    if data[at + 15] != 0x10:
                        raise ValueError('Unexpected versionCode type')
                    struct.pack_into('<I', data, at + 16, 2)
                    changed.add(name)
                if name == 'versionName':
                    index = struct.unpack_from('<I', data, at + 8)[0]
                    if index == 0xffffffff:
                        index = struct.unpack_from('<I', data, at + 16)[0]
                    pos, length, encoding = locations[index]
                    value = '1.2'.encode(encoding)
                    if len(value) != length:
                        raise ValueError('Base APK must have a three-character versionName')
                    data[pos:pos + length] = value
                    changed.add(name)
        offset += size
    if changed != {'versionName', 'versionCode'}:
        raise ValueError('Missing Android version attributes')
    return bytes(data)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--base', type=Path, required=True)
    parser.add_argument('--keystore', type=Path, required=True)
    parser.add_argument('--alias', default='androiddebugkey')
    parser.add_argument('--build-tools', type=Path, required=True)
    parser.add_argument('--java-home', type=Path, required=True)
    args = parser.parse_args()
    if not os.environ.get('GROMCAL_KEYSTORE_PASSWORD'):
        raise ValueError('Set GROMCAL_KEYSTORE_PASSWORD in the local environment')
    out = ROOT / '.local-release'
    out.mkdir(exist_ok=True)
    unsigned, aligned, signed = (out / name for name in ['unsigned.apk', 'aligned.apk', 'GromCAL-1.2.apk'])
    with zipfile.ZipFile(args.base) as source:
        legacy = source.read('assets/public/assets/index-DwIbDUhG.js').decode('utf-8')
        known_keys = [s.encode() for s in re.findall(r'(?:Ud|Bd)=\(\)=>on\(\)\.settings\.(?:openaiKey|apiKey)\|\|"([^"]+)"', legacy)]
        with zipfile.ZipFile(unsigned, 'w') as target:
            for info in source.infolist():
                if info.filename.startswith('assets/public/') or re.match(r'META-INF/(?:MANIFEST\.MF|[^/]+\.(?:RSA|DSA|EC|SF))$', info.filename, re.I):
                    continue
                content = source.read(info)
                if info.filename == 'AndroidManifest.xml':
                    content = update_manifest(content)
                target.writestr(info, content)
            for file in sorted((ROOT / 'dist').rglob('*')):
                if file.is_file():
                    target.writestr('assets/public/' + file.relative_to(ROOT / 'dist').as_posix(), file.read_bytes(), compress_type=zipfile.ZIP_DEFLATED)
    # Scan decompressed entries. Merely scanning the compressed APK misses keys.
    with zipfile.ZipFile(unsigned) as apk:
        for entry in apk.infolist():
            content = apk.read(entry)
            if any(key in content for key in known_keys) or re.search(rb'\b(?:sk-|AIza|AQ\.)[A-Za-z0-9_.-]{30,}', content):
                raise ValueError('Potential API credential in APK entry: ' + entry.filename)
        assert apk.testzip() is None
    env = {**os.environ, 'JAVA_HOME': str(args.java_home)}
    subprocess.run([str(args.build_tools / 'zipalign.exe'), '-f', '-p', '4', str(unsigned), str(aligned)], check=True, env=env)
    signer = args.build_tools / 'apksigner.bat'
    subprocess.run([str(signer), 'sign', '--ks', str(args.keystore), '--ks-key-alias', args.alias, '--ks-pass', 'env:GROMCAL_KEYSTORE_PASSWORD', '--out', str(signed), str(aligned)], check=True, env=env)
    subprocess.run([str(signer), 'verify', '--verbose', str(signed)], check=True, env=env, stdout=subprocess.DEVNULL)
    subprocess.run([str(args.build_tools / 'zipalign.exe'), '-c', '-p', '4', str(signed)], check=True, env=env)
    print('PASS: sanitized APK, manifest 1.2/code 2, alignment and signature:', signed)


if __name__ == '__main__':
    main()
