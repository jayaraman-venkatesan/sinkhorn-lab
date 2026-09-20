# Third-party notices and audit record

This file records the dependency and artifact audit performed on 2026-09-20. It preserves notices and source pointers; it is not a general legal-clearance claim. Exact versions remain authoritative in `web/package-lock.json`, the NuGet `packages.lock.json` files, and the immutable image manifests in `Dockerfile`.

## Python Optimal Transport (POT)

The pinned C# library is a translation of the single-target dense `sinkhorn_knopp` and `sinkhorn_log` routines from Python Optimal Transport (POT) 0.9.6.post1, commit `85113e9a380f5fcf684c50c73c1ff6a164a7366e`, file `ot/bregman/_sinkhorn.py`, Git blob `cf5efadfc0f33300899d9b8a20f762e5f96a2759`. Upstream credits Remi Flamary, Nicolas Courty, Titouan Vayer, Alexander Tong, and Quang Huy Tran. The local C# translation adds explicit validation, observation, and result assessment outside the preserved updates.

POT is distributed under the MIT License:

> MIT License
>
> Copyright (c) 2016-2023 POT contributors
>
> Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
>
> The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
>
> THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

Sources: [POT at the pinned commit](https://github.com/PythonOT/POT/tree/85113e9a380f5fcf684c50c73c1ff6a164a7366e), [POT license](https://github.com/PythonOT/POT/blob/85113e9a380f5fcf684c50c73c1ff6a164a7366e/LICENSE), [Cuturi 2013](https://arxiv.org/abs/1306.0895), and [Feydy et al. 2019](https://proceedings.mlr.press/v89/feydy19a.html).

## Bundled website dependencies and assets

The lock contains 320 dependency records. `npm ci` installed 296 host-relevant packages plus the root project; all installed `package.json` license fields were inspected. The 24 non-host optional native-binding lock records were checked against their recorded upstream parent projects: Rolldown is MIT and Lightning CSS is MPL-2.0. They were not installed or inspected as local artifacts. The npm production dependency graph contains 126 packages: 123 MIT, two ISC (`@ungap/structured-clone` 1.4.0 and `hast-util-from-dom` 5.0.1), and one BSD-2-Clause (`entities` 6.0.1). Vite tree-shakes and combines modules, so this graph is deliberately not claimed to be a one-to-one inventory of bytes in the emitted JavaScript.

Direct bundled packages are React 19.3.0, React DOM 19.3.0, KaTeX 0.16.22, react-markdown 10.1.0, rehype-katex 7.0.1, remark-gfm 4.0.1, and remark-math 6.0.0; all report MIT. KaTeX's bundled TTF/WOFF/WOFF2 files are covered by the KaTeX MIT `LICENSE` (Copyright 2013–2020 Khan Academy and contributors) and are emitted unchanged by Vite.

The 194 host-installed build/test dependency graph entries are not copied as executable packages into the final image. Their observed SPDX expressions were MIT, ISC, BSD-2-Clause, BSD-3-Clause, Apache-2.0, BlueOak-1.0.0, CC-BY-4.0, and MPL-2.0. Notable non-permissive/data records are build-only: `caniuse-lite` 1.0.30001810 (CC-BY-4.0) informs browser transforms and is not copied as a database; `lightningcss` 1.33.0 and its native binding (MPL-2.0) perform the build and are absent from the runtime. TypeScript 5.9.3 and Playwright 1.63.0 are Apache-2.0 build/test tools. This distinction does not relicense their source or data. For auditable distribution evidence, the final image retains the exact npm lockfile and every license/copying/notice file present in the host-relevant `npm ci` tree under `/app/licenses/npm/`.

The SVG figures and PNG screenshots in `content/figures/` and `docs/images/` are original synthetic project assets covered by the repository license. No paper figures, stock photographs, or remote fonts are included.

## NuGet and .NET

The API, library, and lesson example have only project references; there is no third-party NuGet package copied beside the application. The test graph is build/test-only. Every locked `.nuspec` license expression was inspected: Microsoft test/runtime packages and Newtonsoft.Json are MIT; xUnit 3.2.2, its runner/analyzers, and their xUnit transitive packages are Apache-2.0. Exact versions are in `tests/Api.Tests/packages.lock.json` and `vendor/sinkhorn/tests/Sinkhorn.Tests/packages.lock.json`.

The final ASP.NET 10.0.3 image retains `/usr/share/dotnet/LICENSE.txt` and `/usr/share/dotnet/ThirdPartyNotices.txt`. On the inspected arm64 image their SHA-256 values were `cfc21f5e8bd655ae997eec916138b707b1d290b83272c02a95c9f821b8c87310` and `2dc8f8c5a39401e928b5784ab564eb8b3ceb99ead3df8f260e0cab7e0bbecc7a` respectively.

## Container bases and operating-system notices

The Node 24.19.0 Bookworm image is build-only. The .NET SDK 10.0.201 image is build-only. The final ASP.NET 10.0.3 image is Ubuntu 24.04 (Noble). `Dockerfile` pins these multi-platform manifest-list digests:

| Role | Image | Manifest digest |
| --- | --- | --- |
| Build only | `node:24.19.0-bookworm-slim` | `sha256:a9f5f7c91a432850b2a8a7797adf5eadb6c733ceed61167806cee7ea7fbc29df` |
| Build only | `mcr.microsoft.com/dotnet/sdk:10.0.201` | `sha256:127d7d4d601ae26b8e04c54efb37e9ce8766931bded0ee59fcd799afd21d6850` |
| Shipped runtime | `mcr.microsoft.com/dotnet/aspnet:10.0.3` | `sha256:aec87aa74ddf129da573fa69f42f229a23c953a1c6fdecedea1aa6b1fe147d76` |

The inspected final image retained 93 Ubuntu copyright files under `/usr/share/doc/*/copyright`; the exact installed package/version inventory is recorded in `docs/verification.md`. Those files and the .NET notices remain in the image. The repository also copies this file and `LICENSE` into `/app/licenses/`.

## Continuous-integration actions

The workflow uses `actions/checkout` 7.0.1, `actions/setup-node` 6.0.0, and `actions/setup-dotnet` 6.0.0. They are CI-only and not copied into the runtime. The three action repositories publish MIT licenses.
