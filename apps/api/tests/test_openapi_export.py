from __future__ import annotations

import json

from quakecurrent.openapi_export import (
    main,
    render_openapi_document,
    write_if_changed,
)


def test_openapi_export_is_deterministic() -> None:
    first = render_openapi_document()
    second = render_openapi_document()

    assert first == second
    assert first.endswith("\n")
    assert json.loads(first)["info"]["title"] == "QuakeCurrent API"


def test_openapi_export_writes_only_changed_content(tmp_path) -> None:
    output = tmp_path / "openapi.json"
    contents = render_openapi_document()

    assert write_if_changed(output, contents) is True
    assert write_if_changed(output, contents) is False

    changed = contents.replace("QuakeCurrent API", "Changed API", 1)
    assert write_if_changed(output, changed) is True
    assert output.read_text(encoding="utf-8") == changed


def test_openapi_export_check_detects_drift(tmp_path, capsys) -> None:
    output = tmp_path / "openapi.json"
    contents = render_openapi_document()
    output.write_text(contents, encoding="utf-8")

    assert main(["--check", str(output)]) == 0
    assert "일치합니다" in capsys.readouterr().out

    output.write_text(
        contents.replace("QuakeCurrent API", "Changed API", 1),
        encoding="utf-8",
    )
    assert main(["--check", str(output)]) == 1
    assert "drift" in capsys.readouterr().err
