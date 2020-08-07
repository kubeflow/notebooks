import logging

from flask import Flask
from flask_cors import CORS

from .authn import bp as authn_bp
from .config import Config, DevConfig
from .errors import bp as errors_bp
from .probes import bp as probes_bp
from .routes import bp as base_routes_bp
from .serving import bp as serving_bp

LOG_FORMAT = "%(asctime)s | %(name)s | %(levelname)s | %(message)s"


def create_app(name, static_folder, config_class=Config):
    config = config_class()
    logging.basicConfig(format=LOG_FORMAT, level=config.LOG_LEVEL)
    log = logging.getLogger(__name__)

    app = Flask(name, static_folder=static_folder)
    app.config.from_object(config)

    if config_class == DevConfig:
        log.warn("RUNNING IN DEVELOPMENT MODE")
        CORS(app)

    # Register all the blueprints
    app.register_blueprint(authn_bp)
    app.register_blueprint(errors_bp)
    app.register_blueprint(probes_bp)
    app.register_blueprint(serving_bp)
    app.register_blueprint(base_routes_bp)

    return app
