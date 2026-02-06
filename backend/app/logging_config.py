import logging
import os
from pythonjsonlogger import jsonlogger

def configure_logging() -> None:
    level = os.environ.get("SPONSOR_OPS_LOG_LEVEL", "INFO").upper()
    root = logging.getLogger()
    if root.handlers:
        return
    handler = logging.StreamHandler()
    formatter = jsonlogger.JsonFormatter("%(asctime)s %(levelname)s %(name)s %(message)s")
    handler.setFormatter(formatter)
    root.addHandler(handler)
    root.setLevel(level)
