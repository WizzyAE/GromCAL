"""Independently inspect source and decompressed APK entries for credentials.

Optionally compare exact legacy credentials from a private, local APK. Values
are never printed or written to the audit report.
"""
from pathlib import Path
import argparse
import hashlib
import json
import re
import zipfile

ROOT = Path(__file__).resolve().parent.parent
PATTERN = re.compile(rb'\b(?:sk-|AIza|AQ\.)[A-Za-z0-9_.-]{30,}')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apk', type=Path, required=True)
    parser.add_argument('--known-source', type=Path)
    parser.add_argument('--local-state', type=Path)
    parser.add_argument('--report', type=Path, required=True)
    args = parser.parse_args()
    known = set()
    if args.known_source:
        with zipfile.ZipFile(args.known_source) as apk:
            original = apk.read('assets/public/assets/index-DwIbDUhG.js')
            known.update(re.findall(rb'(?:Ud|Bd)=\(\)=>on\(\)\.settings\.(?:openaiKey|apiKey)\|\|"([^"]+)"', original))
        if len(known) < 2:
            raise ValueError('Expected both legacy fallback credentials in the private original')
    if args.local_state:
        state = json.loads(args.local_state.read_text(encoding='utf-8'))
        for name in ['apiKey', 'openaiKey']:
            value = state.get('settings', {}).get(name)
            if isinstance(value, str) and value.strip():
                known.add(value.strip().encode())
    public = []
    for folder in ['dist', 'src', 'scripts', 'tests', 'integrations']:
        for file in (ROOT / folder).rglob('*'):
            if file.is_file() and not file.relative_to(ROOT).as_posix().startswith('integrations/staged/'):
                public.append(file)
    for name in ['.gitignore', 'README.md', 'Start-GromCAL.ps1', 'capacitor.config.json', 'package.json', 'package-lock.json']:
        public.append(ROOT / name)
    failures = []
    def inspect(label, data):
        if any(key in data for key in known):
            failures.append({'file': label, 'check': 'exact-owner-credential'})
        if PATTERN.search(data):
            failures.append({'file': label, 'check': 'credential-pattern'})
    for file in public:
        inspect(file.relative_to(ROOT).as_posix(), file.read_bytes())
    with zipfile.ZipFile(args.apk) as apk:
        entries = apk.infolist()
        assert apk.testzip() is None
        for entry in entries:
            inspect('APK/' + entry.filename, apk.read(entry))
        for file in (ROOT / 'dist').rglob('*'):
            if file.is_file():
                assert apk.read('assets/public/' + file.relative_to(ROOT / 'dist').as_posix()) == file.read_bytes()
    report = {
        'sourceFiles': len(public), 'apkEntries': len(entries),
        'knownOwnerCredentialsCompared': len(known),
        'exactOwnerCredentialMatches': sum(f['check'] == 'exact-owner-credential' for f in failures),
        'credentialPatternMatches': sum(f['check'] == 'credential-pattern' for f in failures),
        'apkWebAssetsMatchCurrentBuild': True,
        'apkSha256': hashlib.sha256(args.apk.read_bytes()).hexdigest(),
        'failures': failures,
    }
    args.report.write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
    if failures:
        raise ValueError('Credential audit failed; file names only are in the local report')
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
