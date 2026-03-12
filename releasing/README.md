# Releasing

This folder contains scripts and instructions for releasing images and manifests
for the components of this repository.

## Steps for releasing

### Prepare (MINOR RELEASE)

1. Create a new release branch from `notebooks-v2`:

```sh
RELEASE_BRANCH="v2.0-alpha-branch" # for an alpha release
#RELEASE_BRANCH="v2.0-branch"      # for a GA release
git checkout -b $RELEASE_BRANCH origin/notebooks-v2
# OR: git checkout -b $RELEASE_BRANCH upstream/notebooks-v2

# push the release branch to the upstream repository
git push origin $RELEASE_BRANCH
# OR: git push upstream $RELEASE_BRANCH
```

### Prepare (PATCH RELEASE)

1. Check out the release branch for the version you are releasing:

```sh
git checkout $RELEASE_BRANCH
```

2. Cherry-pick the changes you want to include in the patch release (if they have not been added via a PR):

```sh
# cherry-pick the commit
# NOTE: you could also use an IDE to make this easier
git cherry-pick HASH_OF_COMMIT

# push the changes to the release branch
git push origin $RELEASE_BRANCH
# OR: git push upstream $RELEASE_BRANCH
```

### Create Release (ALL RELEASES)

1. Bump version in `releasing/version/VERSION` file:

```sh
VERSION="v2.0.0-alpha.0" # for an alpha release
#VERSION="v2.0.0-rc.0"   # for a release candidate
#VERSION="v2.0.0"        # for a GA release
echo "$VERSION" > releasing/version/VERSION
```

2. Update the image tags in the manifests to the new version:

```sh
# Ensure required Python dependency is installed
pip install ruamel.yaml

# Run the release script
python3 releasing/update-manifests-images.py
```

3. Create a PR into the release branch with the changes from steps 1 and 2:

   - The PR should be titled `chore: Release vX.X.X-rc.X` or `chore: Release vX.X.X`.
   - This is to trigger the GitHub Actions tests, and ensure a release is possible.
   - The only changes should be the image tags in the manifests and the VERSION bump.
   - Once the tests pass, merge the PR (this will trigger the release builds).

4. Create a tag in the release branch:

```sh
# check out the release branch at the commit that was merged
git checkout $RELEASE_BRANCH
# NOTE: make sure you are at the current HEAD of the release branch
#       which should be the commit from the PR merged in the previous step

# create the tag
# NOTE: this is a signed tag, so you must have set up your GPG key
git tag -s "$VERSION" -m "$VERSION"

# verify the tag signature
git verify-tag "$VERSION"

# push the tag
git push origin "$VERSION"
# OR: git push upstream "$VERSION"
```

5. Create a new release on GitHub:

    - Go to the [releases page](https://github.com/kubeflow/notebooks/releases).
    - Click `"Draft a new release"`.
    - Enter the tag you just created in the `"Choose a tag"` box.
    - If this is an RC release:
       - check the `"This is a pre-release"` box
       - make a basic description of the release but don't include the full release notes.
    - If this is a final release:
       - Set the `"Previous tag"` to the previous non-RC release and click `"Generate release notes"`.
       - Try and format the release notes like the previous releases.
    - Click `"Publish release"`.

## Components Updated by Script

The `update-manifests-images.py` script updates image tags for the following Notebooks v2 components:

- **Workspaces Controller** - `workspaces/controller/manifests/kustomize/base/manager/kustomization.yaml`
- **Workspaces Backend** - `workspaces/backend/manifests/kustomize/base/kustomization.yaml`
- **Workspaces Frontend** - `workspaces/frontend/manifests/kustomize/base/kustomization.yaml`
