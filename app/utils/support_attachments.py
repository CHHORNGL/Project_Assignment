"""Safe, predictable storage for support-chat attachments.

Voice blobs come from different browser encoders (WebM/Opus, Ogg/Opus,
MP4/AAC, and occasionally WAV).  Keep the extension aligned with the MIME
type so Flask and browsers can decode the file when it is played back.
"""

import os
import uuid

from werkzeug.utils import secure_filename


MAX_SUPPORT_ATTACHMENT_BYTES = 10 * 1024 * 1024

_IMAGE_TYPES = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/gif": "gif",
    "image/webp": "webp",
}
_AUDIO_TYPES = {
    "audio/webm": "webm",
    "audio/ogg": "ogg",
    "audio/mp4": "m4a",
    "audio/mpeg": "mp3",
    "audio/wav": "wav",
    "audio/x-wav": "wav",
    "audio/aac": "aac",
    "audio/3gpp": "3gp",
    "audio/opus": "opus",
}


def _sniff_audio_mime(payload):
    """Return a conservative MIME correction for common browser blob headers."""
    if payload.startswith(b"\x1a\x45\xdf\xa3"):
        return "audio/webm"
    if payload.startswith(b"OggS"):
        return "audio/ogg"
    if len(payload) >= 12 and payload[:4] == b"RIFF" and payload[8:12] == b"WAVE":
        return "audio/wav"
    if len(payload) >= 12 and payload[4:8] == b"ftyp":
        return "audio/mp4"
    return None


class SupportAttachmentError(ValueError):
    """An attachment cannot be accepted by support chat."""

    status_code = 400

    def __init__(self, message, status_code=400):
        super().__init__(message)
        self.status_code = status_code


def save_support_attachment(file_storage, upload_dir):
    """Validate and save one image/audio upload.

    Returns ``(filename, mime_type)``.  The stream is read once and rewound so
    the stored bytes are exactly what the browser sent, without a lossy server
    re-encode.
    """

    if not file_storage or not file_storage.filename:
        raise SupportAttachmentError("No selected file")

    mime_type = (file_storage.mimetype or "").split(";", 1)[0].strip().lower()
    # A few mobile browsers label camera/microphone blobs as generic binary;
    # allow the narrow extension fallback below for those clients.
    if mime_type in {"application/octet-stream", "binary/octet-stream"}:
        mime_type = ""
    original_name = secure_filename(file_storage.filename)
    original_ext = original_name.rsplit(".", 1)[-1].lower() if "." in original_name else ""

    # Some mobile browsers omit a MIME type.  Only infer from a narrow list of
    # safe extensions; arbitrary uploads must never become public static files.
    if not mime_type:
        mime_type = {
            "jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png",
            "gif": "image/gif", "webp": "image/webp", "webm": "audio/webm",
            "weba": "audio/webm", "ogg": "audio/ogg", "oga": "audio/ogg",
            "m4a": "audio/mp4", "mp4": "audio/mp4", "mp3": "audio/mpeg",
            "wav": "audio/wav", "aac": "audio/aac", "opus": "audio/opus",
            "3gp": "audio/3gpp",
        }.get(original_ext, "")

    extension = _IMAGE_TYPES.get(mime_type) or _AUDIO_TYPES.get(mime_type)
    if not extension:
        raise SupportAttachmentError("Unsupported image or audio format", 415)

    stream = getattr(file_storage, "stream", file_storage)
    payload = stream.read(MAX_SUPPORT_ATTACHMENT_BYTES + 1)
    if len(payload) > MAX_SUPPORT_ATTACHMENT_BYTES:
        raise SupportAttachmentError("Attachment is too large (maximum 10 MB)", 413)
    if not payload:
        raise SupportAttachmentError("The uploaded file is empty")
    stream.seek(0)

    # A few WebKit versions report application/octet-stream or audio/mp4 while
    # producing a WebM blob. Correcting from the container header prevents a
    # valid recording from being served with an undecodable extension/MIME.
    sniffed_mime = _sniff_audio_mime(payload) if mime_type.startswith("audio/") or not mime_type else None
    if sniffed_mime:
        mime_type = sniffed_mime
        extension = _AUDIO_TYPES[mime_type]

    os.makedirs(upload_dir, exist_ok=True)
    filename = f"{uuid.uuid4().hex}.{extension}"
    destination = os.path.join(upload_dir, filename)
    with open(destination, "wb") as output:
        output.write(payload)
    return filename, mime_type
