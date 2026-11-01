#!/usr/bin/env python3
"""Build and verify a deterministic local candidate; never upload or publish."""

import argparse
import hashlib
import io
import json
from pathlib import Path
import re
import stat
import struct
import sys
import zipfile


ROOT = Path(__file__).resolve().parent.parent
ICONS = {str(size): "img/icon/icon{}.png".format(size) for size in (16, 32, 48, 128)}
FILES = tuple(sorted(("manifest.json", "js/content.js", "js/service-worker.js",
                      "popup.html", "css/popup.css", "js/popup.js",
                      "LICENSE", *ICONS.values())))
STAMP = (1980, 1, 1, 0, 0, 0)


def require(condition, message):
    if not condition:
        raise ValueError(message)


def read_inputs():
    files = {}
    for name in FILES:
        path = ROOT
        for component in Path(name).parts:
            path = path / component
            require(not path.is_symlink(), "Symlink is not a release input: " + name)
        require(path.is_file(), "Missing release input: " + name)
        files[name] = path.read_bytes()
        require(files[name], "Empty release input: " + name)
    return files


def validate(files):
    require(set(files) == set(FILES), "Unexpected release file set")
    manifest = json.loads(files["manifest.json"])
    require(isinstance(manifest, dict), "Manifest must be an object")
    require(set(manifest) == {"manifest_version", "name", "description", "version",
                             "short_name", "icons", "action", "permissions",
                             "background", "commands"},
            "Manifest keys changed; review the release allowlist/configuration")
    require(manifest["manifest_version"] == 3, "Manifest V3 is required")
    version = manifest["version"]
    require(isinstance(version, str) and re.fullmatch(
        r"(0|[1-9][0-9]*)(\.(0|[1-9][0-9]*)){0,3}", version), "Invalid Chrome version")
    parts = [int(part) for part in version.split('.')]
    require(any(parts) and all(part <= 65535 for part in parts), "Invalid version components")
    for key, limit in (("name", 75), ("description", 132), ("short_name", 12)):
        require(isinstance(manifest[key], str) and 0 < len(manifest[key]) <= limit,
                "Invalid manifest " + key)
    require(manifest["permissions"] == ["activeTab", "scripting"],
            "Unexpected permissions")
    require(manifest["background"] == {"service_worker": "js/service-worker.js"},
            "Unexpected service-worker configuration")
    require(manifest["commands"] == {
        "focus-search-field": {
            "suggested_key": {"default": "Ctrl+Space", "mac": "MacCtrl+Space"},
            "description": "Focus the page’s search field"
        }
    }, "Unexpected command configuration")
    require(manifest["icons"] == ICONS, "Unexpected icon references")
    require(manifest["action"] == {
        "default_icon": ICONS, "default_title": "View or change your shortcut",
        "default_popup": "popup.html"
    }, "Unexpected toolbar action configuration")
    for size, name in ICONS.items():
        data = files[name]
        require(len(data) >= 33 and data[:8] == b'\x89PNG\r\n\x1a\n'
                and data[8:16] == b'\x00\x00\x00\rIHDR', "Invalid PNG header: " + name)
        require(struct.unpack('>II', data[16:24]) == (int(size), int(size)),
                "Incorrect icon dimensions: " + name)
    # Deliberately narrow to the current worker; changes require packaging review.
    worker = files["js/service-worker.js"].decode('utf-8')
    injections = re.findall(r"\bfiles\s*:\s*\[([^\]]*)\]", worker)
    require(len(injections) == 1 and re.fullmatch(
        r"\s*(['\"])js/content\.js\1\s*", injections[0]),
        "Expected exactly one bundled content-script reference")
    files["js/content.js"].decode('utf-8')
    return version


def make_archive(files):
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, 'w', compression=zipfile.ZIP_STORED) as archive:
        for name in FILES:
            entry = zipfile.ZipInfo(name, STAMP)
            entry.create_system = 3
            entry.external_attr = (stat.S_IFREG | 0o644) << 16
            entry.compress_type = zipfile.ZIP_STORED
            archive.writestr(entry, files[name])
    return buffer.getvalue()


def verify_archive(data, files, version):
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        require(archive.namelist() == list(FILES), "Unexpected archive membership/order")
        require(archive.testzip() is None, "Archive CRC check failed")
        require(not archive.comment, "Unexpected archive comment")
        archived = {}
        for entry in archive.infolist():
            require(entry.date_time == STAMP and entry.compress_type == zipfile.ZIP_STORED
                    and entry.create_system == 3
                    and entry.external_attr == (stat.S_IFREG | 0o644) << 16
                    and not entry.extra and not entry.comment,
                    "Unexpected ZIP metadata: " + entry.filename)
            archived[entry.filename] = archive.read(entry.filename)
            require(archived[entry.filename] == files[entry.filename],
                    "Archived bytes differ: " + entry.filename)
        require(validate(archived) == version, "Archived version mismatch")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output-dir', type=Path, default=ROOT / 'dist')
    args = parser.parse_args()
    try:
        files = read_inputs()
        version = validate(files)
        data = make_archive(files)
        verify_archive(data, files, version)
        output = args.output_dir.resolve()
        package = output / ("focus-search-bar-{}-rc.zip".format(version))
        checksum = package.with_suffix('.zip.sha256')
        require(not package.is_symlink() and not checksum.is_symlink(),
                "Refusing symlink output files")
        output.mkdir(parents=True, exist_ok=True)
        package.write_bytes(data)
        # Reopen the actual on-disk artifact, not only the in-memory candidate.
        verify_archive(package.read_bytes(), files, version)
        digest = hashlib.sha256(data).hexdigest()
        checksum.write_bytes((digest + '  ' + package.name + '\n').encode('ascii'))
        print("UNVERIFIED RELEASE CANDIDATE " + version)
        print("Package: " + str(package))
        print("SHA-256: " + digest)
        print("Checksum: " + str(checksum))
        print("Verified {} files; manual installation/upgrade checks remain pending.".format(len(FILES)))
    except (OSError, ValueError, TypeError, KeyError, zipfile.BadZipFile) as error:
        print("Packaging failed: " + str(error), file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
