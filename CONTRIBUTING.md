# Kubeflow Notebooks Contributor Guide

Welcome to the Kubeflow Notebooks project! We'd love to accept your patches and 
contributions to this project. Please read the 
[contributor's guide in our docs](https://www.kubeflow.org/docs/about/contributing/).

The contributor's guide

* shows you where to find the Contributor License Agreement (CLA) that you need 
  to sign,
* helps you get started with your first contribution to Kubeflow,
* and describes the pull request and review workflow in detail, including the
  OWNERS files and automated workflow tool.

## Use Semantic Commits

We use [semantic commits](https://www.conventionalcommits.org/en/v1.0.0/) to help us automatically generate changelogs and release notes.

__The name of your PR must be a semantic commit message__, with one of the following prefixes:

- `fix:` (bug fixes)
- `feat:` (new features)
- `improve:` (improvements to existing features)
- `refactor:` (code changes that neither fixes a bug nor adds a feature)
- `revert:` (reverts a previous commit)
- `test:` (adding missing tests, refactoring tests; no production code change)
- `ci:` (changes to CI configuration or build scripts)
- `docs:` (documentation only changes)
- `chore:` (ignored in changelog)

To indicate a breaking change, add `!` after the prefix, e.g. `feat!: my commit message`.

Please do NOT include a scope, as we do not use them, for example `feat(feature_name): my commit message`.

## Sign Your Work

To certify you agree to the [Developer Certificate of Origin](https://developercertificate.org/) you must sign-off each commit message using `git commit --signoff`, or manually write the following:
```text
This is my commit message

Signed-off-by: John Smith <john-smith@users.noreply.github.com>
```