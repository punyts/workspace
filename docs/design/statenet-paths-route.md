# Bytes by statenet path: the `/paths` route

Status: designed 2026-11-22; the files part built 2026-11-22, tiles not yet. The route is built on the tower (the owner's other machine, where statenet networking is
built), not in this workspace. The clients are built here: `map` takes a `tiles` template that is a path of the app's
own origin, `mediaPlayer` takes a `src` of the app's own origin, and uploads accept audio and video
([stateui-component-gaps.md](stateui-component-gaps.md), C7).

Asked on 2026-11-22, about where a map's tiles come from: "Is there a way we can use the same statenet path pattern?"
The owner then chose "Design here, route on tower", a tile provider that is "Configurable, decide later", and for
uploads "Audio and short video, 10 MiB".

## The design

Bytes that browsers cache (map tiles, uploaded files, recorded media) have statenet paths like any state, and are read
over HTTP on our own origin at `/paths/<the path, its segments joined by slashes>`. The state transport never carries
them ([statenet-direction.md](statenet-direction.md), "Not on this transport").

| Bytes | Statenet path | URL |
|-------|---------------|-----|
| A map tile | `[business].data.maps.<map>.tiles.<z>.<x>.<y>` | `/paths/<business>/data/maps/<map>/tiles/<z>/<x>/<y>` |
| An uploaded file | `[owner].apps.<app>.files.<id>` | `/paths/<owner>/apps/<app>/files/<id>` |

A document names the URL: a `map`'s `tiles` is `/paths/<business>/data/maps/city/tiles/{z}/{x}/{y}`, and a
`mediaPlayer`'s `src` is a file's path. The browser contacts only our origin.

### Path patterns pick the source and the permission

The route uses the same matcher as the four path-pattern tables of the direction (permissions, versioning, relays,
logic), with one more table: **sources**, from a path pattern to where the bytes come from.

| Pattern | Source |
|---------|--------|
| `*.data.maps.*.tiles.*.*.*` | The tile provider: our server fetches the tile and caches it |
| `*.apps.*.files.*` | The app's file store (stateui-mcp's files folder; Magnetic's file storage) |

Read permission is the permissions table's answer for the same path. A business can make a map's tiles readable by
everyone; a persona's files are readable by those the owner grants. A path no source matches is `404`, and a path the
reader may not read is `404` too, so the route does not reveal which paths exist.

### The reader

A page of our origin sends its session cookie. The runtime frame is sandboxed with an opaque origin, so its image and
media requests carry no cookie. A view therefore gets a **read grant** with its document: a token the server signs for
the path patterns that view may read, valid for minutes and renewed with the view's session. The frame appends it to a
`/paths` URL as `?g=<grant>`. The server checks the signature, the expiry and that the path matches a granted pattern.
Paths that everyone may read need no grant. Query strings of `/paths` are not logged.

### The tile provider

The provider is MapTiler (owner, 2026-11-22), configured rather than written into code: an XYZ URL template with
`{z}`, `{x}`, `{y}` and `{key}`, and the key. MapTiler's raster tiles of 256 pixels match `map`'s tile size:

```
MAP_TILES_URL=https://api.maptiler.com/maps/streets-v2/256/{z}/{x}/{y}.png?key={key}
```

Another MapTiler map id (or another provider) is a change of configuration only. Locally the template and key are
`MAP_TILES_URL` and `MAP_TILES_KEY` in `.env`; hosted they are the SSM parameters `/magnetic/map-tiles-url` and
`/magnetic/map-tiles-key` (us-east-1), which the owner sets. Without them the tile source answers `404` and a map shows
its background. The provider's terms decide caching and attribution; the attribution is the map's `_attribution`
(MapTiler's and OpenStreetMap's contributors'). OpenStreetMap's public tile servers forbid proxied use and are not an
option.

The server fetches a tile once and keeps it in a disk cache with a size cap, least recently used out. Concurrent misses
for one tile share one upstream fetch. Zooms outside the provider's range and coordinates outside `0 .. 2^z - 1` are
refused before any fetch.

### Files

Files are built before tiles, which wait for MapTiler's terms (owner, 2026-11-22: "Yes, files first").

**A file belongs to an app.** An upload is stored, counted against the quota, referenced and released per app
(`UiFileRepository`, `UiFileStore`), and only the app's owner adds or removes one. Its path is therefore the app's, under
the instance address the statenet already uses (`<owner number>/apps/<appId>`): `[owner].apps.<app>.files.<id>`. A
persona's own files (an upload by someone who uses a shared app) are not a thing today; when they are, they get a path
under the persona and a row in the sources table.

**The route lives in stateui-mcp's HTTP server**, beside the app routes, so stateui-mcp alone and Magnetic serve it the
same way. The server holds the sources table: a list of `{ pattern, read }`, where `pattern` is compiled with the logic
engine's `compilePattern` (`@punyts/stateui-app/core`, `src/core/logic/pattern.ts`) and a request's path is the
statenet path `$.<segment>.<segment>…`. A path matches a pattern only when it has exactly the pattern's steps (the
engine's matcher also matches above and below, for changes; the route takes only an exact match). The files source is
`$.{owner}.apps.{app}.files.{file}`; Magnetic adds the tile source later.

**Who may read.** The permissions table of the direction is not built, so the files source asks what the app routes ask
today: whoever may open the app may read its files. With a session cookie the server resolves the tenant as for
`GET /apps/<app>` (the owner, an org member, a person with a live `use` or `view` link) and checks that the tenant's
owner number is the path's `owner`. Without a cookie it needs a grant. A revoked or deleted app answers `404`, as does an
unknown file and a file of another app.

**The read grant.** The runtime frame's requests carry no cookie, so the host page hands the frame a grant with the
document:

- A grant names one owner, one app and an expiry 15 minutes ahead: `base64url(owner "." app "." expiry) "." base64url(mac)`,
  where `mac` is HMAC-SHA-256 over the first part with the server's grant key. It grants every file of that app and
  nothing else.
- The key is derived from Magnetic's `secretKey` (HKDF, label `paths-grant`), so both of the host's servers accept each
  other's grants. stateui-mcp alone makes a random key at start; a restart ends its grants, and the frame's next
  renewal replaces them.
- The app page carries the first grant (`data-grant`). The host page sends a new one to the frame every 10 minutes
  through the view's event stream, which already proves the session; a closed or revoked view gets none.
- The frame appends `?g=<grant>` to the `/paths` URLs it sets on `img`, `audio`, `video` and `track`. A grant in the URL
  can leak through a copied link for at most 15 minutes and only reaches that app's files, which the person could read
  anyway.
- Only the query's `g` is read; any other query answers `400`. Query strings of `/paths` are not logged.

**The response.**

- `GET` and `HEAD` only. `200` with the stored, sniffed type (ADR-0017), `Content-Length`, `X-Content-Type-Options:
  nosniff`, `Content-Security-Policy: sandbox; default-src 'none'` (`FILE_CSP`), and `Content-Disposition: inline` for
  `image/*`, `audio/*` and `video/*` and `attachment; filename*=…` for the rest. An SVG is served as an attachment: it
  is a document, not a picture.
- `Accept-Ranges: bytes`; one range of `Range: bytes=a-b`, `a-` or `-n` answers `206` with `Content-Range`; an
  unsatisfiable range answers `416`; several ranges are served as the whole file (`200`). `UiFileStore.open` gains a
  range, `{ start, end }` inclusive, so neither store reads more than it sends.
- `Cache-Control: private, max-age=31536000, immutable` and an `ETag` of the stored SHA-256. The URL with its grant
  changes every renewal, so a browser that cached the bytes under an old grant asks again; the `ETag` makes that a
  `304`.

**It replaces the download route.** `GET /apps/<app>/files/<id>` is removed; the host page's `fileRead` fetches the
`/paths` URL with its cookie. Upload (`POST /apps/<app>/files`) and release (`DELETE /apps/<app>/files/<id>`) stay
where they are: they change an app, and `/paths` only reads.

**The frame's policy.** `runtimeCsp` and `APP_PAGE_CSP` allow `img-src` and `media-src` of `https:` today. They gain
the main origin (`hostOrigin`), so a `/paths` URL also loads over `http://localhost` in development. The frame builds
absolute URLs from the main origin it is given; its own opaque origin cannot resolve a relative one.

**Who builds what.** The tower builds the route, the sources table, the grant (signing, checking, the page's first
grant and the renewal message), ranges in both file stores, the removal of the download route with `fileRead` moved
over, and the policies. The UI machine builds the frame's side: keeping the grant, appending it to the URLs it sets, and
`mediaPlayer`'s file source ([../work-split.md](../work-split.md)).

### Responses

- Files: as above. A file id is never reused, so the answer is `Cache-Control: private, max-age=31536000, immutable`.
- Tiles: `image/png` or `image/jpeg` as the provider sends them, `Cache-Control: public, max-age=86400`.
- A versioned path (`…@2.3.0+2`) never changes and is `immutable`.

## Rules and Constraints

- Cacheable bytes go over HTTP from our own origin, never over the state transport.
- The browser contacts our origin only. A provider sees our server, never a user's address.
- The provider key is never in a document, a response, a URL the browser sees or a log line; the upstream URL is not
  logged.
- Every segment is checked before it reaches a file system path or an upstream URL: an owner number, UUIDs for an app
  and a file, integers for `z`, `x` and `y`. A file name is never part of a path.
- A grant reaches one app's files for at most 15 minutes, and only a view whose session is live receives a new one.
- A grant, a key and a file's bytes are never logged; a read is reported with the app and file ids and the byte count.
- One path pattern matcher serves sources and permissions, the same one the direction names.
- The runtime frame's policy allows `img-src` and `media-src` of the app's origin for `/paths`; nothing else of the
  network opens.

## Decisions

- Bytes are addressed by their statenet path, not by a route per kind (`/tiles`, `/files`) (owner, 2026-11-22).
- The route is built on the tower; this workspace builds its clients (owner, 2026-11-22).
- The tile provider is configuration: a URL template and a key in env or SSM (owner, 2026-11-22). The provider is
  MapTiler (owner, 2026-11-22: "Let's go with MapTiler"). That its terms allow the server's proxy and disk cache is to
  be confirmed before the route is built.
- Audio and video uploads stay under the 10 MiB file limit, so only short clips fit (owner, 2026-11-22).
- The frame reads with a short-lived signed grant in the query, because its sandboxed requests carry no cookie.
- Files are built first; tiles wait for MapTiler's terms (owner, 2026-11-22: "Yes, files first").
- A file's path is its app's, `[owner].apps.<app>.files.<id>`, not a persona's: files are stored, counted and released
  per app (owner, 2026-11-22: "Yes, build it").
- Whoever may open an app may read its files, until the permissions table exists.
- A grant covers one app for 15 minutes, renewed every 10 through the view's event stream.
- `/paths` replaces `GET /apps/<app>/files/<id>`; upload and release stay on the app's routes.

## As built

Files, 2026-11-22. Tiles are not built; the clients are listed in [stateui-component-gaps.md](stateui-component-gaps.md),
C7, and the frame's use of the grant is the UI machine's ([../work-split.md](../work-split.md)).

- **stateui-mcp**: the route, its sources table and `fileSource` in `src/infrastructure/http/HttpServer.ts`
  (`pathsRoute`, `readerOf`, `appPaths`, options `ownerTenant` and `pathGrantKey`); the grants in
  `src/infrastructure/http/PathGrants.ts`; `Range` in `src/infrastructure/http/byteRange.ts`; `ByteRange` and
  `UiFileStore.open` (`src/application/ports/UiFileStore.ts`, `src/infrastructure/storage/FsUiFileStore.ts`); `PickBytes`
  in `src/application/use-cases/ReadFile.ts`; `InstanceViews.owner`; the `grant` view message
  (`src/infrastructure/preview/PreviewHub.ts`), `data-paths` and `data-grant` (`src/infrastructure/http/pages.ts`), kept
  by the host (`src/browser/host.ts`); `readStoredFile` and `directChannel` on the files URL (`src/browser/fileRead.ts`,
  `src/browser/viewChannel.ts`); the policies in `src/infrastructure/http/security.ts`. The statenet views keep their
  relayed file requests (`StatenetViews`), which are not HTTP. Tests: `test/http.test.ts` ("GET
  /paths/<owner>/apps/:appId/files/:fileId"), `src/infrastructure/http/PathGrants.test.ts`,
  `src/infrastructure/http/byteRange.test.ts`, `src/infrastructure/http/security.test.ts`, `test/hostFileRead.test.ts`,
  `test/fileSweep.test.ts`.
- **stateui-pg**: `PgUiFileStore.open` with a range (`src/workspace/PgUiFileStore.ts`). Test:
  `src/workspace/workspaceStorage.test.ts` ("should open a range of a file, cut in the database, and the whole file
  without one").
- **Magnetic**: `APP_PATH` takes `/paths/<owner>/apps/<id>/…`, and `startHttpServer` gets `ownerTenant` (the
  workspace of an owner number) and `pathGrantKey` from `secretKey` (`src/server/startMagnetic.ts`). Tests:
  `src/server/sharing.test.ts` ("should let whoever may open an app read its files by /paths, with the session or the
  page's grant, and no one else"), `src/server/startMagnetic.test.ts`.
