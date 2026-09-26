"""Small, side-effect-free security helpers used by the desktop bridge."""

from __future__ import annotations

import ipaddress
import os
import re
import socket
import sys
import uuid
from urllib.parse import urlsplit, urlunsplit


SECRET_SETTING_FIELDS = (
    "ai_api_key",
    "ai_task_api_key",
    "ai_learning_api_key",
    "weather_api_key",
)
SECRET_SETTING_PLACEHOLDER = "__SPARK_SCHEDULE_SECRET_REDACTED__"
MAX_SETTINGS_IMPORT_BYTES = 1024 * 1024


def redact_settings(settings: dict) -> dict:
    """Return a copy with secret values replaced by a fixed, non-reversible marker."""
    safe = dict(settings) if isinstance(settings, dict) else {}
    for field in SECRET_SETTING_FIELDS:
        value = safe.get(field)
        safe[field] = SECRET_SETTING_PLACEHOLDER if value else ""
    return safe


def redact_sensitive_payload(value):
    """Recursively redact secret-key values in a signal or response payload."""
    if isinstance(value, dict):
        result = {}
        for key, item in value.items():
            if key in SECRET_SETTING_FIELDS:
                result[key] = SECRET_SETTING_PLACEHOLDER if item else ""
            else:
                result[key] = redact_sensitive_payload(item)
        return result
    if isinstance(value, list):
        return [redact_sensitive_payload(item) for item in value]
    if isinstance(value, tuple):
        return tuple(redact_sensitive_payload(item) for item in value)
    return value


def restore_secret_placeholders(updates: dict, current_settings: dict) -> dict:
    """Preserve stored keys when the settings UI submits our fixed mask unchanged."""
    safe = dict(updates) if isinstance(updates, dict) else {}
    current = current_settings if isinstance(current_settings, dict) else {}
    for field in SECRET_SETTING_FIELDS:
        if safe.get(field) == SECRET_SETTING_PLACEHOLDER:
            safe[field] = current.get(field, "")
    return safe


def normalize_ai_endpoint(base_url: str) -> str:
    """Build a chat endpoint, requiring HTTPS except for loopback development hosts."""
    value = str(base_url or "").strip()
    if not value:
        raise ValueError("AI endpoint is missing")
    try:
        parsed = urlsplit(value)
        host = parsed.hostname
        port = parsed.port  # validates malformed/out-of-range ports
    except ValueError as exc:
        raise ValueError("AI endpoint is invalid") from exc

    scheme = parsed.scheme.lower()
    if scheme not in {"https", "http"} or not host:
        raise ValueError("AI endpoint must use HTTPS")
    if parsed.username is not None or parsed.password is not None or "@" in parsed.netloc:
        raise ValueError("AI endpoint credentials are not allowed in the URL")
    if parsed.query or parsed.fragment:
        raise ValueError("AI endpoint query and fragment components are not allowed")

    is_loopback = host.lower() == "localhost"
    if not is_loopback:
        try:
            is_loopback = ipaddress.ip_address(host).is_loopback
        except ValueError:
            is_loopback = False
    if scheme == "http" and not is_loopback:
        raise ValueError("AI API keys may only be sent over HTTPS")

    path = parsed.path.rstrip("/")
    lower_path = path.lower()
    if not any(lower_path.endswith(suffix) for suffix in ("/chat/completions", "/v1/chat", "/api/chat")):
        if not lower_path.endswith("/v1"):
            path = f"{path}/v1" if path else "/v1"
        path = f"{path}/chat/completions"

    netloc = host
    if ":" in host and not host.startswith("["):
        netloc = f"[{host}]"
    if port is not None:
        netloc = f"{netloc}:{port}"
    return urlunsplit((scheme, netloc, path, "", ""))


def post_ai_request(
    requests_module,
    base_url: str,
    api_key: str,
    payload: dict,
    timeout: int = 30,
    approved_endpoints=None,
    confirm_callback=None,
):
    """Send an authenticated request only to a native-approved exact endpoint."""
    endpoint = normalize_ai_endpoint(base_url)
    if approved_endpoints is None:
        raise RuntimeError("AI endpoint approval registry is required")
    if endpoint not in approved_endpoints:
        if confirm_callback is None or not confirm_callback(endpoint):
            raise RuntimeError("AI endpoint approval is required")
        approved_endpoints.add(endpoint)
    response = requests_module.post(
        endpoint,
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        json=payload,
        timeout=timeout,
        allow_redirects=False,
    )
    status = int(getattr(response, "status_code", 0))
    if 300 <= status < 400:
        raise RuntimeError("AI endpoint redirects are not allowed")
    return response


def normalize_weather_host(host: str) -> str:
    """Validate a host-only weather endpoint (HTTPS is constructed by the caller)."""
    value = str(host or "").strip()
    if not value or "://" in value or any(char in value for char in "/\\\\?#@"):
        raise ValueError("Weather API host must be a hostname only")
    try:
        parsed = urlsplit(f"//{value}")
        hostname = parsed.hostname
        port = parsed.port
    except ValueError as exc:
        raise ValueError("Weather API host is invalid") from exc
    if not hostname or port is not None or parsed.path or parsed.query or parsed.fragment:
        raise ValueError("Weather API host must not include a port, path, or credentials")

    hostname = hostname.rstrip(".").lower()
    try:
        ip = ipaddress.ip_address(hostname)
    except ValueError:
        try:
            hostname = hostname.encode("idna").decode("ascii")
        except UnicodeError as exc:
            raise ValueError("Weather API host is invalid") from exc
        if len(hostname) > 253 or "." not in hostname:
            raise ValueError("Weather API host must be a fully qualified public hostname")
        labels = hostname.split(".")
        if any(not re.fullmatch(r"[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?", label) for label in labels):
            raise ValueError("Weather API host is invalid")
        if hostname.endswith((".localhost", ".local", ".internal", ".test", ".invalid", ".example", ".onion")):
            raise ValueError("Private and special-use weather hosts are not allowed")
        return hostname
    if not ip.is_global:
        raise ValueError("Private and reserved weather IP addresses are not allowed")
    return hostname


def validate_public_weather_host(host: str, resolver=None) -> str:
    """Reject weather hostnames that resolve to any private or reserved address."""
    hostname = normalize_weather_host(host)
    try:
        ip = ipaddress.ip_address(hostname)
        resolved = [ip]
    except ValueError:
        lookup = resolver or socket.getaddrinfo
        try:
            records = lookup(hostname, 443, type=socket.SOCK_STREAM)
            resolved = [ipaddress.ip_address(record[4][0].split("%", 1)[0]) for record in records]
        except Exception as exc:
            raise ValueError("Weather API host could not be safely resolved") from exc
    if not resolved or any(not address.is_global for address in resolved):
        raise ValueError("Weather API host resolves to a private or reserved address")
    return hostname


def get_weather_request(
    requests_module,
    host: str,
    endpoint_path: str,
    api_key: str,
    params: dict,
    timeout: int = 10,
    resolver=None,
):
    """Call one fixed weather route over HTTPS and refuse redirects before key leakage."""
    allowed_paths = {"/geo/v2/city/lookup", "/v7/weather/now"}
    if endpoint_path not in allowed_paths:
        raise ValueError("Weather API endpoint path is not allowed")
    safe_host = validate_public_weather_host(host, resolver=resolver)
    request_params = dict(params) if isinstance(params, dict) else {}
    request_params["key"] = api_key
    response = requests_module.get(
        f"https://{safe_host}{endpoint_path}",
        params=request_params,
        timeout=timeout,
        allow_redirects=False,
    )
    status = int(getattr(response, "status_code", 0))
    if 300 <= status < 400:
        raise RuntimeError("Weather API redirects are not allowed")
    return response


def validate_settings_file_path(path: str, data_dir: str, *, for_export: bool) -> str:
    """Validate a local JSON settings file path without reading or writing it."""
    if not isinstance(path, str) or not path.strip():
        raise ValueError("A local JSON file path is required")
    raw_path = path.strip()
    if "://" in raw_path or raw_path.startswith(("\\\\", "//")):
        raise ValueError("Network and URL paths are not allowed")
    if not os.path.isabs(raw_path):
        raise ValueError("The selected path must be absolute")
    if os.path.splitext(raw_path)[1].lower() != ".json":
        raise ValueError("Settings files must use the .json extension")
    if os.path.islink(raw_path):
        raise ValueError("Symbolic-link settings paths are not allowed")

    resolved = os.path.realpath(os.path.abspath(raw_path))
    data_root = os.path.realpath(os.path.abspath(data_dir))
    try:
        common = os.path.commonpath((resolved, data_root))
        if os.path.normcase(common) == os.path.normcase(data_root):
            raise ValueError("Settings import/export inside application data is not allowed")
    except ValueError as exc:
        if str(exc).startswith("Settings import/export"):
            raise
        # Different volumes do not overlap.

    if for_export:
        parent = os.path.dirname(resolved)
        if not os.path.isdir(parent):
            raise ValueError("The destination directory must already exist")
        if os.path.exists(resolved) and not os.path.isfile(resolved):
            raise ValueError("The destination must be a regular file")
    else:
        if not os.path.isfile(resolved):
            raise ValueError("The selected settings file does not exist")
        if os.path.getsize(resolved) > MAX_SETTINGS_IMPORT_BYTES:
            raise ValueError("The settings file is too large")
    return resolved


def backup_key_path() -> str:
    """Return a per-user key location separate from the application's backup folder."""
    if os.name == "nt":
        base = os.environ.get("LOCALAPPDATA") or os.path.join(os.path.expanduser("~"), "AppData", "Local")
        return os.path.join(base, "SparkSchedule", "Security", "backup.key")
    if sys.platform == "darwin":
        base = os.path.join(os.path.expanduser("~"), "Library", "Application Support")
    else:
        base = os.environ.get("XDG_DATA_HOME") or os.path.join(os.path.expanduser("~"), ".local", "share")
    return os.path.join(base, "SparkSchedule", "security", "backup.key")


def _write_private_key(path: str, key: bytes) -> bool:
    """Create a private key file exclusively; return False if another writer won."""
    flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL
    if hasattr(os, "O_BINARY"):
        flags |= os.O_BINARY
    try:
        descriptor = os.open(path, flags, 0o600)
    except FileExistsError:
        return False
    try:
        with os.fdopen(descriptor, "wb") as key_stream:
            key_stream.write(key)
            key_stream.flush()
            os.fsync(key_stream.fileno())
    except Exception:
        try:
            os.remove(path)
        except OSError:
            pass
        raise
    return True


def _protect_key_file(path: str) -> None:
    if os.name != "nt":
        try:
            os.chmod(path, 0o600)
        except OSError as exc:
            raise RuntimeError("Could not protect the backup key file") from exc


def encrypt_backup_payload(
    raw_bytes: bytes,
    key_file: str,
    backup_dir: str,
    legacy_key_file: str | None = None,
) -> bytes:
    """Encrypt with Fernet; migrate an old backup key out of the backup folder."""
    try:
        from cryptography.fernet import Fernet
    except ImportError:
        raise RuntimeError("cryptography is required for encrypted backups") from None

    key_parent = os.path.realpath(os.path.dirname(os.path.abspath(key_file)))
    backup_root = os.path.realpath(os.path.abspath(backup_dir))
    try:
        common_root = os.path.commonpath((key_parent, backup_root))
    except ValueError:
        common_root = ""
    if os.path.normcase(common_root) == os.path.normcase(backup_root):
        raise RuntimeError("Backup key must be stored outside the backup directory")
    if os.path.islink(key_file):
        raise RuntimeError("Backup key file must not be a symbolic link")
    if legacy_key_file and os.path.realpath(os.path.abspath(legacy_key_file)) == os.path.realpath(os.path.abspath(key_file)):
        raise RuntimeError("Legacy backup key path is invalid")
    if legacy_key_file and os.path.islink(legacy_key_file):
        raise RuntimeError("Legacy backup key must not be a symbolic link")

    os.makedirs(key_parent, mode=0o700, exist_ok=True)
    if os.name != "nt":
        try:
            os.chmod(key_parent, 0o700)
        except OSError as exc:
            raise RuntimeError("Could not protect the backup key directory") from exc

    legacy_key = None
    if legacy_key_file and os.path.exists(legacy_key_file):
        if not os.path.isfile(legacy_key_file):
            raise RuntimeError("Legacy backup key is not a regular file")
        with open(legacy_key_file, "rb") as key_stream:
            legacy_key = key_stream.read()
        try:
            Fernet(legacy_key)
        except Exception as exc:
            raise RuntimeError("Legacy backup key is invalid") from exc

    if os.path.exists(key_file):
        with open(key_file, "rb") as key_stream:
            key = key_stream.read()
        try:
            Fernet(key)
        except Exception as exc:
            raise RuntimeError("Backup key is invalid") from exc
    else:
        key = legacy_key or Fernet.generate_key()
        if not _write_private_key(key_file, key):
            with open(key_file, "rb") as key_stream:
                key = key_stream.read()
            try:
                Fernet(key)
            except Exception as exc:
                raise RuntimeError("Backup key is invalid") from exc

    _protect_key_file(key_file)

    if legacy_key_file and legacy_key is not None:
        if legacy_key != key:
            archived = False
            for _ in range(3):
                legacy_destination = os.path.join(key_parent, f"backup.legacy.{uuid.uuid4().hex}.key")
                if _write_private_key(legacy_destination, legacy_key):
                    _protect_key_file(legacy_destination)
                    archived = True
                    break
            if not archived:
                raise RuntimeError("Could not move the legacy backup key to private storage")
        try:
            os.remove(legacy_key_file)
        except OSError as exc:
            raise RuntimeError("Could not remove the legacy backup key from the backup directory") from exc

    try:
        return Fernet(key).encrypt(raw_bytes)
    except Exception as exc:
        raise RuntimeError("Could not encrypt the backup payload") from exc
