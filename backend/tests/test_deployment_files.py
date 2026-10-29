"""The Vercel deployment reads its packages from pyproject.toml, while Docker installs requirements.txt.
They are two lists of one thing, so the first must never name a package the second lacks."""

import re
import tomllib
from pathlib import Path

BACKEND = Path(__file__).resolve().parent.parent


def package_name(requirement: str) -> str:
    return re.split(r"[\[<>=!~ ;]", requirement, maxsplit=1)[0].lower().replace("_", "-")


def test_every_package_the_deployment_installs_is_also_in_requirements_txt():
    project = tomllib.loads((BACKEND / "pyproject.toml").read_text(encoding="utf-8"))["project"]
    deployed = {package_name(r) for r in project["dependencies"]}
    local = {
        package_name(line)
        for line in (BACKEND / "requirements.txt").read_text(encoding="utf-8").splitlines()
        if line.strip() and not line.startswith("#")
    }

    assert deployed <= local, f"in pyproject.toml but not in requirements.txt: {sorted(deployed - local)}"


def test_the_deployment_does_not_ship_test_or_dev_server_packages():
    project = tomllib.loads((BACKEND / "pyproject.toml").read_text(encoding="utf-8"))["project"]
    deployed = {package_name(r) for r in project["dependencies"]}

    assert not deployed & {"pytest", "uvicorn"}
