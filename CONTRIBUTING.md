# Contributing to Kubeflow Notebooks

Welcome to the Kubeflow Notebooks project! 
Contributions are welcome via GitHub pull requests.

Please see the [Contributing to Kubeflow](https://www.kubeflow.org/docs/about/contributing/) page for more information.

## Sign Your Work

To certify you agree to the [Developer Certificate of Origin](https://developercertificate.org/) you must sign-off each commit message using `git commit --signoff`, or manually write the following:

```text
feat(ws): my commit message`

Signed-off-by: John Smith <john-smith@users.noreply.github.com>
```

## Use Semantic Commits

We use [semantic commits](https://www.conventionalcommits.org/en/v1.0.0/) to help us automatically generate changelogs and release notes.

### Prefixes

A semantic commit message must start with one of the following __prefixes__:

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

### Scopes

You may optionally include a __scope__ after the prefix, for example:

- `nb` (changes to notebooks - web-app, controller, images)
- `pvc` (changes to volumes - web-app, controller)
- `tb` (changes to tensorboards - web-app, controller)
- `ws` (changes to workspaces - frontend, backend, controller, images)

### Examples

Here are some examples of semantic commit messages:

- `fix(nb): something that was broken`
- `feat(ws): a new feature`
- `improve: a general improvement`
- `chore: update readme`
