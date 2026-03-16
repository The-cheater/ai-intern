"""Google Drive client for NeuroSync AI — uploads and deletes session media files."""

import os
from typing import Optional

from dotenv import load_dotenv
from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload

load_dotenv()

_SCOPES = ["https://www.googleapis.com/auth/drive"]
_SERVICE_ACCOUNT_FILE: str = os.getenv("GOOGLE_SERVICE_ACCOUNT_FILE", "credentials.json")
_DRIVE_FOLDER_ID: Optional[str] = os.getenv("GOOGLE_DRIVE_FOLDER_ID")

_drive_service = None


def _get_drive():
    global _drive_service
    if _drive_service is None:
        creds = Credentials.from_service_account_file(_SERVICE_ACCOUNT_FILE, scopes=_SCOPES)
        _drive_service = build("drive", "v3", credentials=creds, cache_discovery=False)
    return _drive_service


def _get_or_create_subfolder(session_folder_name: str) -> str:
    """Return the Drive folder ID for *session_folder_name* under the root drive folder.

    Creates the subfolder if it does not already exist.
    """
    drive = _get_drive()
    # Escape single quotes in the folder name for the query string
    safe_name = session_folder_name.replace("'", "\\'")
    query = (
        f"name='{safe_name}' and "
        f"'{_DRIVE_FOLDER_ID}' in parents and "
        f"mimeType='application/vnd.google-apps.folder' and "
        f"trashed=false"
    )
    results = drive.files().list(q=query, fields="files(id)", pageSize=1).execute()
    files = results.get("files", [])
    if files:
        return files[0]["id"]

    # Create the subfolder
    metadata = {
        "name": session_folder_name,
        "mimeType": "application/vnd.google-apps.folder",
        "parents": [_DRIVE_FOLDER_ID],
    }
    folder = drive.files().create(body=metadata, fields="id").execute()
    return folder["id"]


_MIME_MAP = {
    ".mp4":  "video/mp4",
    ".webm": "video/webm",
    ".wav":  "audio/wav",
    ".json": "application/json",
}


def upload_file(local_path: str, filename: str, session_folder_id: str) -> str:
    """Upload a media or calibration file to the session subfolder on Google Drive.

    Args:
        local_path: Absolute path to the local file.
        filename: Desired filename on Drive (.mp4, .webm, .wav, or .json).
        session_folder_id: Session identifier used as the subfolder name under
            GOOGLE_DRIVE_FOLDER_ID. The subfolder is created automatically if
            it does not already exist.

    Returns:
        The Drive file_id of the uploaded file.
    """
    ext = os.path.splitext(filename)[1].lower()
    mime_type = _MIME_MAP.get(ext)
    if not mime_type:
        raise ValueError(f"Unsupported file type '{ext}'. Allowed: {list(_MIME_MAP)}")

    folder_id = _get_or_create_subfolder(session_folder_id)

    file_metadata = {"name": filename, "parents": [folder_id]}
    media = MediaFileUpload(local_path, mimetype=mime_type, resumable=True)

    drive = _get_drive()
    uploaded = (
        drive.files()
        .create(body=file_metadata, media_body=media, fields="id")
        .execute()
    )
    return uploaded["id"]


def download_file(file_id: str, local_path: str) -> None:
    """Download a file from Google Drive to *local_path*."""
    from googleapiclient.http import MediaIoBaseDownload
    drive = _get_drive()
    request = drive.files().get_media(fileId=file_id)
    with open(local_path, "wb") as fh:
        downloader = MediaIoBaseDownload(fh, request)
        done = False
        while not done:
            _, done = downloader.next_chunk()


def delete_file(file_id: str) -> None:
    """Permanently delete a file from Google Drive by its file_id."""
    drive = _get_drive()
    drive.files().delete(fileId=file_id).execute()
