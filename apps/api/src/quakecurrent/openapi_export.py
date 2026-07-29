"""FastAPI OpenAPI 문서를 결정론적인 JSON으로 내보낸다."""

from __future__ import annotations

import argparse
import json
import sys
from collections.abc import Sequence
from pathlib import Path

from quakecurrent.main import app


def render_openapi_document() -> str:
    """키 순서와 줄 끝을 고정한 OpenAPI JSON을 반환한다."""

    return (
        json.dumps(
            app.openapi(),
            ensure_ascii=False,
            indent=2,
            sort_keys=True,
        )
        + "\n"
    )


def write_if_changed(path: Path, contents: str) -> bool:
    """내용이 달라질 때만 파일을 기록하고 변경 여부를 반환한다."""

    if path.exists() and path.read_text(encoding="utf-8") == contents:
        return False

    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(contents, encoding="utf-8", newline="\n")
    return True


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="QuakeCurrent FastAPI OpenAPI 문서를 JSON으로 내보냅니다.",
    )
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument(
        "--output",
        type=Path,
        help="출력 경로입니다. 생략하면 표준 출력으로 보냅니다.",
    )
    mode.add_argument(
        "--check",
        type=Path,
        help="지정한 스냅샷이 현재 OpenAPI 문서와 일치하는지 확인합니다.",
    )
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    contents = render_openapi_document()

    if args.check is not None:
        current = (
            args.check.read_text(encoding="utf-8")
            if args.check.exists()
            else ""
        )
        if current.replace("\r\n", "\n") != contents:
            sys.stderr.write(
                "OpenAPI 스냅샷 drift를 감지했습니다. "
                "`npm run generate:api-contract`를 실행하세요.\n"
            )
            return 1
        sys.stdout.write("FastAPI OpenAPI 문서와 스냅샷이 일치합니다.\n")
        return 0

    if args.output is None:
        sys.stdout.write(contents)
        return 0

    write_if_changed(args.output, contents)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
