"""Background freshness monitor. Run one worker; safe across multiple workers on PostgreSQL."""

import argparse
import time

from sqlalchemy import select

from . import models as m
from .config import Settings
from .db import database, now
from .services import publish, reconcile_alerts, snapshot


def tick(sessions, settings, current):
    with sessions() as session:
        farms = list(session.scalars(select(m.Farm.id).order_by(m.Farm.id)))
    for farm_id in farms:
        with sessions.begin() as session:
            data = snapshot(session, farm_id, settings, current)
            if reconcile_alerts(session, farm_id, data, current):
                publish(session, farm_id, "alerts.changed")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--interval", type=float, default=15)
    parser.add_argument("--once", action="store_true")
    args = parser.parse_args()
    if args.interval < 1:
        parser.error("interval >= 1 giây")
    settings = Settings()
    engine, sessions = database(settings.database_url)
    try:
        while True:
            tick(sessions, settings, now())
            if args.once:
                return
            time.sleep(args.interval)
    except KeyboardInterrupt:
        return
    finally:
        engine.dispose()


if __name__ == "__main__":
    main()
