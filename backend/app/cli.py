import argparse
import logging
import os

import psycopg

from app.arcgis import download_kalimantan_peat
from app.backfill import run_backfill
from app.boundaries import load_boundaries_from_zip
from app.config import load_settings
from app.ingestion import run_ingestion, run_on_schedule
from app.knowledge import KnowledgeError, load_knowledge
from app.peatlands import load_peatlands_from_file


def evaluate_model(model_name: str | None, verbose: bool) -> None:
    """Run the evaluation questions through the model configured in LLM_* and print how it did."""
    from datetime import datetime, timezone

    from app.chat.model_http import OpenAICompatibleClient
    from app.model_eval import default_cases, format_report, run_cases

    settings = load_settings()
    name = model_name or settings.llm_model
    if not settings.llm_base_url or not name:
        raise SystemExit("Set LLM_BASE_URL and LLM_MODEL (or pass --model) to say which model to evaluate.")
    model = OpenAICompatibleClient(settings.llm_base_url, name, settings.llm_api_key, settings.llm_timeout_seconds)
    try:
        with psycopg.connect(settings.database_url) as conn:
            load_knowledge(conn, settings.knowledge_dir)  # the questions are asked of the real documents
            results = run_cases(conn, model, default_cases(), datetime.now(timezone.utc))
    except KnowledgeError as error:
        raise SystemExit(f"Knowledge not loaded: {error}")
    print(format_report(name, results, verbose))


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    parser = argparse.ArgumentParser(prog="python -m app.cli")
    commands = parser.add_subparsers(dest="command", required=True)

    boundaries = commands.add_parser(
        "load-boundaries", help="Load Province and Regency boundaries from the HDX COD-AB zip"
    )
    boundaries.add_argument("archive", help="Path to idn_admin_boundaries.geojson.zip")

    fetch_peat = commands.add_parser(
        "fetch-peat", help="Download the Kementan 1:50,000 peat map of Kalimantan from BIG Satu Peta"
    )
    fetch_peat.add_argument("out", help="Where to write the GeoJSON file")

    peat = commands.add_parser(
        "load-peat", help="Replace the Peatland polygons from a GeoJSON file or zipped shapefile"
    )
    peat.add_argument("file", help="Path to a .geojson, .json or zipped shapefile (.zip)")
    peat.add_argument(
        "--srid", type=int, default=4326, help="EPSG code of the file (default 4326, WGS84)"
    )

    commands.add_parser(
        "backfill",
        help="Recompute Province, Regency and Peat Hotspot for stored Hotspots after a dataset change",
    )

    knowledge = commands.add_parser(
        "load-knowledge",
        help="Check and load the reviewed documents the chat may quote (the API also does this at start)",
    )
    knowledge.add_argument(
        "directory", nargs="?", help="Folder of .md documents (default: KNOWLEDGE_DIR or backend/knowledge)"
    )

    evaluate = commands.add_parser(
        "evaluate-model",
        help="Run the chat questions through the configured language model and report how it did (manual, not CI)",
    )
    evaluate.add_argument("--model", help="Model name to use instead of LLM_MODEL")
    evaluate.add_argument("--verbose", action="store_true", help="List every question, not only the ones that went wrong")

    ingest = commands.add_parser("ingest", help="Fetch Hotspots from NASA FIRMS")
    ingest.add_argument(
        "--loop", action="store_true", help="Run every 30 minutes instead of once"
    )

    args = parser.parse_args()
    if args.command == "load-boundaries":
        with psycopg.connect(os.environ["DATABASE_URL"]) as conn:
            load_boundaries_from_zip(conn, args.archive)
        print("Boundaries loaded.")
    elif args.command == "fetch-peat":
        count = download_kalimantan_peat(args.out)
        print(f"Wrote {count} peat polygons to {args.out}.")
    elif args.command == "load-peat":
        with psycopg.connect(os.environ["DATABASE_URL"]) as conn:
            load_peatlands_from_file(conn, args.file, srid=args.srid)
        print("Peatland loaded. Run the backfill to update Hotspots stored earlier.")
    elif args.command == "backfill":
        with psycopg.connect(os.environ["DATABASE_URL"]) as conn:
            result = run_backfill(conn)
        print(
            f"Backfill done: {result.total} Hotspots checked, {result.changed} changed, "
            f"{result.outside_region} outside every Province (left untouched)."
        )
    elif args.command == "load-knowledge":
        directory = args.directory or load_settings().knowledge_dir
        try:
            with psycopg.connect(os.environ["DATABASE_URL"]) as conn:
                count = load_knowledge(conn, directory)
        except KnowledgeError as error:
            raise SystemExit(f"Knowledge not loaded: {error}")
        print(f"Loaded {count} passages from {directory}.")
    elif args.command == "evaluate-model":
        evaluate_model(args.model, args.verbose)
    elif args.command == "ingest":
        settings = load_settings()
        if args.loop:
            run_on_schedule(settings)
        else:
            result = run_ingestion(settings)
            print(f"Fetched {result.fetched} detections, stored {result.stored} new Hotspots.")


if __name__ == "__main__":
    main()
