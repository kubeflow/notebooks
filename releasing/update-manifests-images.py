#!/usr/bin/env python3

import argparse
import logging
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

applications = [
    {
        "name": "Jupyter Web App",
        "kustomization": (
            "components/crud-web-apps/jupyter/"
            "manifests/base/kustomization.yaml"
        ),
        "images": [
            {
                "name": "ghcr.io/kubeflow/notebooks/jupyter-web-app",
                "newName": "ghcr.io/kubeflow/notebooks/jupyter-web-app",
            },
        ],
    },
    {
        "name": "Tensorboards Web App",
        "kustomization": (
            "components/crud-web-apps/tensorboards/"
            "manifests/base/kustomization.yaml"
        ),
        "images": [
            {
                "name": "ghcr.io/kubeflow/kubeflow/tensorboards-web-app",
                "newName": "ghcr.io/kubeflow/kubeflow/tensorboards-web-app",
            },
        ],
    },
    {
        "name": "Volumes Web App",
        "kustomization": (
            "components/crud-web-apps/volumes/"
            "manifests/base/kustomization.yaml"
        ),
        "images": [
            {
                "name": "ghcr.io/kubeflow/kubeflow/volumes-web-app",
                "newName": "ghcr.io/kubeflow/kubeflow/volumes-web-app",
            },
        ],
    },
    {
        "name": "Notebook Controller",
        "kustomization": (
            "components/notebook-controller/"
            "config/base/kustomization.yaml"
        ),
        "images": [
            {
                "name": "ghcr.io/kubeflow/kubeflow/notebook-controller",
                "newName": "ghcr.io/kubeflow/kubeflow/notebook-controller",
            },
        ],
    },
    {
        "name": "PVC Viewer Controller",
        "kustomization": (
            "components/pvcviewer-controller/"
            "config/base/kustomization.yaml"
        ),
        "images": [
            {
                "name": "ghcr.io/kubeflow/kubeflow/pvcviewer-controller",
                "newName": "ghcr.io/kubeflow/kubeflow/pvcviewer-controller",
            },
        ],
    },
    {
        "name": "Tensorboard Controller",
        "kustomization": (
            "components/tensorboard-controller/"
            "config/base/kustomization.yaml"
        ),
        "images": [
            {
                "name": "ghcr.io/kubeflow/kubeflow/tensorboard-controller",
                "newName": "ghcr.io/kubeflow/kubeflow/tensorboard-controller",
            },
        ],
    },
]


def update_manifests_images(applications, tag):
    for application in applications:
        log.info("Updating manifests for app %s", application["name"])
        with open(application["kustomization"], "r") as file:
            kustomize = yaml.load(file)

        images = kustomize.get("images", [])
        for target_image in application["images"]:
            found = False
            for image in images:
                if image["name"] == target_image["name"]:
                    image["newName"] = target_image["newName"]
                    image["newTag"] = tag
                    found = True
                    break
            if not found:
                images.append({
                    "name": target_image["name"],
                    "newName": target_image["newName"],
                    "newTag": tag})
        kustomize["images"] = images

        with open(application["kustomization"], "w") as file:
            yaml.dump(kustomize, file)


def parse_args():
    parser = argparse.ArgumentParser("Update image tags in manifests.")
    parser.add_argument("tag", type=str, help="Image tag to use.")
    return parser.parse_args()


def main():
    logging.basicConfig(level=logging.INFO)
    args = parse_args()
    update_manifests_images(applications, args.tag)


if __name__ == "__main__":
    sys.exit(main())
