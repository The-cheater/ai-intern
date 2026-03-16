"""Cloudinary client for NeuroSync AI — upload, download, delete.

Design goals:
 - No persistent local media storage (uploads use in-memory bytes)
 - Deterministic naming (public_id) so we can index by session/question
 - Folder organization: candidates/<login_id>/sessions/<session_id>/
"""

from __future__ import annotations

import os
from typing import Dict, Optional

import cloudinary
import cloudinary.api
import cloudinary.uploader
from dotenv import load_dotenv

load_dotenv()


def _config() -> None:
    # Cloudinary Python SDK supports either:
    # - CLOUDINARY_URL, or
    # - cloud_name + api_key + api_secret.
    #
    # This repo currently has CLOUDINARY_API_KEY/SECRET in .env, so we also
    # require CLOUDINARY_CLOUD_NAME unless CLOUDINARY_URL is provided.
    cloudinary_url = os.getenv("CLOUDINARY_URL", "").strip()
    if cloudinary_url:
        cloudinary.config(cloudinary_url=cloudinary_url, secure=True)
        return

    cloud_name = os.getenv("CLOUDINARY_CLOUD_NAME", "").strip()
    api_key = os.getenv("CLOUDINARY_API_KEY", "").strip()
    api_secret = os.getenv("CLOUDINARY_API_SECRET", "").strip()
    if not cloud_name or not api_key or not api_secret:
        raise RuntimeError(
            "Cloudinary config missing. Set CLOUDINARY_URL or "
            "CLOUDINARY_CLOUD_NAME + CLOUDINARY_API_KEY + CLOUDINARY_API_SECRET."
        )
    cloudinary.config(cloud_name=cloud_name, api_key=api_key, api_secret=api_secret, secure=True)


def build_session_folder(login_id: str, session_id: str) -> str:
    login_id = (login_id or "unknown").strip()
    session_id = (session_id or "unknown").strip()
    return f"candidates/{login_id}/sessions/{session_id}"


def upload_bytes(
    *,
    data: bytes,
    public_id: str,
    folder: str,
    resource_type: str,
    overwrite: bool = True,
    tags: Optional[list[str]] = None,
    context: Optional[Dict[str, str]] = None,
) -> Dict:
    """Upload bytes to Cloudinary with deterministic `public_id`.

    Returns the full Cloudinary upload response dict (includes secure_url, public_id, etc).
    """
    _config()
    resp = cloudinary.uploader.upload(
        data,
        resource_type=resource_type,  # "video" works for mp4/webm and wav in practice
        public_id=public_id,
        folder=folder,
        overwrite=overwrite,
        unique_filename=False,
        use_filename=False,
        tags=tags or [],
        context=context or {},
    )
    return resp


def destroy(*, public_id: str, resource_type: str = "video") -> None:
    _config()
    try:
        cloudinary.uploader.destroy(public_id, resource_type=resource_type, invalidate=True)
    except Exception:
        # Best-effort delete; DB delete should still proceed.
        pass


def delete_by_prefix(*, prefix: str, resource_type: str = "video") -> int:
    """Delete all Cloudinary resources whose public_id starts with *prefix*.

    Loops through paginated results (up to 500 per page) until exhausted.
    Returns the total count of resources deleted.
    """
    _config()
    deleted = 0
    try:
        result = cloudinary.api.delete_resources_by_prefix(
            prefix,
            resource_type=resource_type,
            invalidate=True,
        )
        deleted += len(result.get("deleted", {}))
        print(f"[VidyaAI][Cloudinary] delete_by_prefix prefix={prefix!r} resource_type={resource_type} → {deleted} deleted")
    except Exception as e:
        print(f"[VidyaAI][Cloudinary] delete_by_prefix failed: {e}")
    return deleted


def build_public_id(*, login_id: str, session_id: str, question_number: int, kind: str) -> str:
    """kind: 'video' | 'audio' | 'calibration' etc."""
    lid = (login_id or "unknown").strip()
    sid = (session_id or "unknown").strip()
    qn = int(question_number)
    kind = (kind or "media").strip()
    # Matches requested convention closely; extension is managed by Cloudinary.
    return f"{lid}_{sid}_q{qn}_{kind}"

