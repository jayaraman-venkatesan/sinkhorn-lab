# Verification record

Evidence date: 2026-09-20. This record distinguishes native execution from cross-build evidence and does not claim publication, a remote CI result, or a release.

## Reproducible verification commands

```sh
git submodule update --init --recursive
git submodule status
dotnet restore --locked-mode
dotnet test -c Release --no-restore
dotnet format --verify-no-changes --no-restore
dotnet build -c Release --no-restore
dotnet run --project examples/LessonUsage/LessonUsage.csproj -c Release --no-restore

cd web
npm ci
npm test -- --run
npm run typecheck
npm run lint
npm run build
npm run test:e2e
cd ..

node scripts/verify-content.mjs
docker compose up --build --detach
cd web
PLAYWRIGHT_BASE_URL=http://127.0.0.1:8080 npm run test:deployment
cd ..
docker compose down
```

The host's port 8080 was already occupied during this verification, so the real Compose run used the documented override `APP_PORT=18080`; the application mapping remained `127.0.0.1:18080->8080` and the deployment test used that base URL. Default configuration remains 8080.

## Container and architecture evidence

Docker Desktop 4.44.3 reported Docker Engine 28.3.2 on Linux arm64. The native `linux/arm64` image ran as `uid=1654(app)`, reported ASP.NET/.NET 10.0.3 `linux-arm64`, contained no Node executable or SDK, and passed the one-origin deployment acceptance. The final image retained 93 Ubuntu copyright files plus .NET license/notices.

The final native image was `sha256:721ea70c941275319085437600bd08e6b58161ce83425194e6131ad4ea185c1c` (`linux/arm64`). The separately built image was `sha256:54cb7beda44a9309a4a323357c183948ebef17b66c75add750dc7b8e1ea0b122` (`linux/amd64`). Docker Desktop started the latter under emulation on the arm64 host; it reported .NET RID `linux-x64`, ran as `app`, and passed the same deployment acceptance at loopback port 18081. This is emulated amd64 runtime evidence, not native amd64 evidence. The pinned base manifest lists advertise both architectures, but that advertisement alone is not counted as build or runtime proof.

## Final-image Ubuntu package inventory

The inspected native runtime contained: apt 2.8.3; base-files 13ubuntu10.4; base-passwd 3.6.3build1; bash 5.2.21-2ubuntu4; bsdutils 2.39.3-9ubuntu6.4; ca-certificates 20240203; coreutils 9.4-3ubuntu6.1; dash 0.5.12-6ubuntu5; debconf 1.5.86ubuntu1; debianutils 5.17build1; diffutils 3.10-1build1; dpkg 1.22.6ubuntu6.5; e2fsprogs 1.47.0-2.4~exp1ubuntu4.1; findutils 4.9.0-5build1; gcc-14-base 14.2.0-4ubuntu2~24.04.1; gpgv 2.4.4-2ubuntu17.4; grep 3.11-4build1; gzip 1.12-1ubuntu3.1; hostname 3.23+nmu2ubuntu2; init-system-helpers 1.66ubuntu1; libacl1 2.3.2-1build1.1; libapt-pkg6.0t64 2.8.3; libassuan0 2.5.6-1build1; libattr1 2.5.2-1build1.1; libaudit-common/libaudit1 3.1.2-2.1build1.1; libblkid1 2.39.3-9ubuntu6.4; libbz2-1.0 1.0.8-5.1build0.1; libc-bin/libc6 2.39-0ubuntu8.7; libcap-ng0 0.8.4-2build2; libcap2 2.66-5ubuntu2.2; libcom-err2/libext2fs2t64/libss2/logsave 1.47.0-2.4~exp1ubuntu4.1; libcrypt1 4.4.36-4build1; libdb5.3t64 5.3.28+dfsg2-7; libdebconfclient0 0.271ubuntu3; libffi8 3.4.6-1build1; libgcc-s1/libstdc++6 14.2.0-4ubuntu2~24.04.1; libgcrypt20 1.10.3-2build1; libgmp10 6.3.0+dfsg-2ubuntu6.1; libgnutls30t64 3.8.3-1.1ubuntu3.5; libgpg-error0 1.47-3build2.1; libhogweed6t64/libnettle8t64 3.9.1-2.2build1.1; libicu74 74.2-1ubuntu3.1; libidn2-0 2.3.7-2build1.1; liblz4-1 1.9.4-1build1.1; liblzma5 5.4.5-1ubuntu0.2; libmd0 1.1.0-2build1.1; libmount1/libsmartcols1/libuuid1 2.39.3-9ubuntu6.4; libncursesw6/libtinfo6/ncurses-base/ncurses-bin 6.4+20240113-1ubuntu2; libnpth0t64 1.6-3.1build1; libp11-kit0 0.25.3-4ubuntu2.1; libpam modules/runtime 1.5.3-5ubuntu5.5; libpcre2-8-0 10.42-4ubuntu2.1; libproc2-0/procps 4.0.4-4ubuntu3.2; libseccomp2 2.5.5-1ubuntu3.1; libselinux1 3.5-2ubuntu2.1; libsemanage-common/libsemanage2 3.5-1build5; libsepol2 3.5-2build1; libssl3t64/openssl 3.0.13-0ubuntu3.7; libsystemd0/libudev1 255.4-1ubuntu8.12; libtasn1-6 4.19.0-3ubuntu0.24.04.2; libunistring5 1.1-2build1.1; libxxhash0 0.8.2-2build1; libzstd1 1.5.5+dfsg2-2build1.1; login/passwd 4.13+dfsg1-4ubuntu3.2; mawk 1.3.4.20240123-1build1; mount 2.39.3-9ubuntu6.4; perl-base 5.38.2-3.2ubuntu0.2; sed 4.9-2build1; sensible-utils 0.0.22; sysvinit-utils 3.08-6ubuntu3; tar 1.35+dfsg-3build1; tzdata/tzdata-legacy 2025b-0ubuntu0.24.04.1; ubuntu-keyring 2023.11.28.1; unminimize 0.2.1; util-linux 2.39.3-9ubuntu6.4; and zlib1g 1.3.dfsg-3.1ubuntu2.1.

## Screenshots and limitations

- [Packaged course opening](images/course.png), 1280×2790.
- [Packaged experiment lab](images/lab.png), 1280×2240.

Both were captured from the real loopback Compose service, not a mocked API. Automated browser acceptance uses Chromium. Visual inspection covered these desktop captures and earlier mobile/reduced-motion captures; manual screen-reader use, Firefox/WebKit, and a formal WCAG audit remain outside the evidence. The application is local educational software, not a publicly deployed or production-validated logistics service.

## Clean recursive checkout

The documented recursive-clone path is verified from a temporary local clone so no app repository is published or pushed. The procedure records the checked app commit, confirms the submodule line exactly equals `5bc2a85fe1856fd9352af8cddca59d8ebda81d4d`, runs locked restores/builds/tests/content checks, and builds/runs the packaged service. Local-clone success does not imply remote CI success; no remote app commit or CI run was created by this task.
