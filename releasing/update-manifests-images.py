#!/usr/bin/env python3

import logging
import os
import sys
import ruamel.yaml

log = logging.getLogger(__name__)


class YAMLEmitterNoVersionDirective(ruamel.yaml.emitter.Emitter):
    def write_version_directive(self, version_text):
        pass

    def expect_document_start(self, first=False):
        if not isinstance(self.event, ruamel.yaml.events.DocumentStartEvent):
            return super().expect_document_start(first=first)
        version = self.event.version
        self.event.version = None
        ret = super().expect_document_start(first=first)
        self.event.version = version
        return ret


class YAML(ruamel.yaml.YAML):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.version = (1, 1)
        self.Emitter = YAMLEmitterNoVersionDirective
        self.preserve_quotes = True


yaml = YAML()

COMPONENTS = [
    {
        "name": "Jupyter Web App",
        "kustomization": "components/crud-web-apps/jupyter/manifests/base/kustomization.yaml",
        "images": [
            {
                "name": "ghcr.io/kubeflow/notebooks/jupyter-web-app",
                "newName": "ghcr.io/kubeflow/notebooks/jupyter-web-app",
            },
        ],
    },
    {
        "name": "Tensorboards Web App",
        "kustomization": "components/crud-web-apps/tensorboards/manifests/base/kustomization.yaml",
        "images": [
            {
                "name": "ghcr.io/kubeflow/notebooks/tensorboards-web-app",
                "newName": "ghcr.io/kubeflow/notebooks/tensorboards-web-app",
            },
        ],
    },
    {
        "name": "Volumes Web App",
        "kustomization": "components/crud-web-apps/volumes/manifests/base/kustomization.yaml",
        "images": [
            {
                "name": "ghcr.io/kubeflow/notebooks/volumes-web-app",
                "newName": "ghcr.io/kubeflow/notebooks/volumes-web-app",
            },
        ],
    },
    {
        "name": "Notebook Controller",
        "kustomization": "components/notebook-controller/config/base/kustomization.yaml",
        "images": [
            {
                "name": "ghcr.io/kubeflow/notebooks/notebook-controller",
                "newName": "ghcr.io/kubeflow/notebooks/notebook-controller",
            },
        ],
    },
    {
        "name": "PVCViewer Controller",
        "kustomization": "components/pvcviewer-controller/config/base/kustomization.yaml",
        "images": [
            {
                "name": "ghcr.io/kubeflow/notebooks/pvcviewer-controller",
                "newName": "ghcr.io/kubeflow/notebooks/pvcviewer-controller",
            },
        ],
    },
    {
        "name": "Tensorboard Controller",
        "kustomization": "components/tensorboard-controller/config/base/kustomization.yaml",
        "images": [
            {
                "name": "ghcr.io/kubeflow/notebooks/tensorboard-controller",
                "newName": "ghcr.io/kubeflow/notebooks/tensorboard-controller",
            },
        ],
    },
]

JWA_SPAWNER_CONFIGS = [
    "components/crud-web-apps/jupyter/manifests/base/configs/spawner_ui_config.yaml",
]


def update_manifests_images(components, tag):
    for component in components:
        log.info("Updating manifests for Dashboard component `%s`", component["name"])
        with open(component["kustomization"], "r") as file:
            kustomize = yaml.load(file)

        images = kustomize.get("images", [])
        for target_image in component["images"]:
            found = False
            for image in images:
                if image["name"] == target_image["name"]:
                    image["newName"] = target_image["newName"]
                    image["newTag"] = tag
                    found = True
                    break
            if not found:
                images.append(
                    {
                        "name": target_image["name"],
                        "newName": target_image["newName"],
                        "newTag": tag,
                    }
                )
        kustomize["images"] = images

        with open(component["kustomization"], "w") as file:
            yaml.dump(kustomize, file)


def update_jwa_spawner_config(config_path, tag):
    log.info("Updating JWA Spawner config `%s`", config_path)
    with open(config_path, "r") as file:
        jwa_config = yaml.load(file)

    # loop over each image type
    for nb_type in ["image", "imageGroupTwo", "imageGroupOne"]:
        image_config = jwa_config["spawnerFormDefaults"][nb_type]

        # change the default image
        old_image = image_config["value"]
        image_config["value"] = _replace_image_tag(old_image, tag)

        # change the image in each option
        for i in range(len(image_config["options"])):
            old_option_image = image_config["options"][i]
            image_config["options"][i] = _replace_image_tag(old_option_image, tag)

    with open(config_path, "w") as file:
        yaml.dump(jwa_config, file)


def _replace_image_tag(image_string, new_tag):
    parts = image_string.split(":")
    if len(parts) != 2:
        raise RuntimeError("Image `%s` doesn't have expected format <img>:<tag>")
    return parts[0] + ":" + new_tag


def main():
    logging.basicConfig(level=logging.INFO)

    # read the tag from the VERSION file
    base_dir = os.path.dirname(os.path.abspath(__file__))
    version_file_path = os.path.join(base_dir, "./version/VERSION")
    with open(version_file_path, "r") as file:
        version = file.read().strip()

    # Update Kustomize manifests with new image tags
    update_manifests_images(COMPONENTS, version)

    # Update JWA Spawner Configs with new image tags
    for config_path in JWA_SPAWNER_CONFIGS:
        update_jwa_spawner_config(config_path, version)


if __name__ == "__main__":
    sys.exit(main())
