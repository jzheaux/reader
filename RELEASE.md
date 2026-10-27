# Releasing

Each version has a milestone, titled with the version (`0.0.3`), that closes
with a review ([how it's done](REVIEWING.md); each one's report is in
[`reviews/`](reviews/)). Once its issues are closed, release it from `main`.

## 1. Bump the version

`package.json` gives the version the app, `reader --version` and the desktop
app show, and the release refuses a version it doesn't have. Bump it, with
`package-lock.json`, without npm's own commit and tag:

```console
$ npm version 0.0.3 --no-git-tag-version
$ git commit -s -am "Release 0.0.3"
$ git push
```

## 2. Run the release

Run the [Release](.github/workflows/release.yml) workflow on `main` with the
same version:

```console
$ gh workflow run release.yml -f version=0.0.3
```

It checks that `package.json` says that version, that it isn't tagged yet, and
that its milestone has no open issues. Then it tags `main` as `v0.0.3` and
publishes a release listing the issues it addresses: the milestone's, less its
review, and those a commit since the last tag closes.

## What follows

It pushes the image, built from the tag, to Docker Hub as
`jzheaux/reader:0.0.3` ([Docker](.github/workflows/docker.yml); run that by
hand with a released version to push it again). Only the newest `vX.Y.Z` tag
also moves `:latest` and writes [`docs/docker.md`](docs/docker.md) as the
overview, however the workflow was started, so pushing an older release again
leaves them where they are. The Docker workflow signs in with the repository's
`DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN` secrets, the token a Docker Hub
access token with Read, Write and Delete.

And it builds the desktop app's installers on macOS, Windows and Linux and
adds them to the release ([Desktop](.github/workflows/desktop.yml); run that
by hand with a released version to build them again).
