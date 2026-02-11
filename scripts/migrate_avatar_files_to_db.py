"""
One-time helper: move existing file-based user avatars (User.avatar_path) into DB
(User.avatar_data/avatar_mimetype) and optionally delete the files.

Run after applying the migration that adds the avatar_data/avatar_mimetype columns.
"""

import os
import sys
from pathlib import Path

# Allow running as `python scripts/migrate_avatar_files_to_db.py`
ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app import create_app
from app.extensions import db
from app.models.user import User


MIME_BY_EXT = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
}


def main(delete_files: bool = True, dry_run: bool = False) -> int:
    app = create_app()
    migrated = 0

    with app.app_context():
        users = User.query.filter(User.avatar_path.isnot(None)).all()
        for u in users:
            if not u.avatar_path:
                continue
            if getattr(u, "avatar_data", None):
                continue

            full_path = os.path.join(app.root_path, "static", u.avatar_path)
            if not os.path.isfile(full_path):
                continue

            ext = os.path.splitext(full_path)[1].lower()
            mimetype = MIME_BY_EXT.get(ext, "image/jpeg")
            data = Path(full_path).read_bytes()
            if not data:
                continue

            u.avatar_data = data
            u.avatar_mimetype = mimetype
            u.avatar_path = None
            migrated += 1

            if delete_files and not dry_run:
                try:
                    os.remove(full_path)
                except OSError:
                    pass

        if not dry_run:
            db.session.commit()

    print(f"Migrated avatars: {migrated}")
    return migrated


if __name__ == "__main__":
    main()
